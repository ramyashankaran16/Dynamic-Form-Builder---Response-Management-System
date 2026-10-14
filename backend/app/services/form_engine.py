"""Form engine: validates form definitions, evaluates conditional visibility,
validates/coerces submitted answers and encodes/decodes stored values.

This module is pure Python (no DB access) so it is easy to unit-test and the
same rules can be mirrored on the React side.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

from email_validator import EmailNotValidError, validate_email

from app.core.config import settings
from app.core.constants import OPTION_FIELD_TYPES, SINGLE_CHOICE_TYPES, ConditionOperator, FieldType

DEFAULT_MAX_RATING = 5
DEFAULT_TEXT_MAX_LENGTH = 5000


# --------------------------------------------------------------------------- #
# Exceptions
# --------------------------------------------------------------------------- #
class FieldDefinitionError(Exception):
    """Raised when a form's field configuration is invalid."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


class SubmissionValidationError(Exception):
    """Raised when submitted answers fail validation. errors = {field_key: message}."""

    def __init__(self, errors: dict[str, str]):
        super().__init__("Validation failed")
        self.errors = errors


# --------------------------------------------------------------------------- #
# Field spec (lightweight, DB independent view of a field)
# --------------------------------------------------------------------------- #
@dataclass
class FieldSpec:
    key: str
    label: str
    type: str
    required: bool = False
    config: dict[str, Any] = field(default_factory=dict)
    rules: dict[str, Any] | None = None
    options: list[str] = field(default_factory=list)
    option_labels: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_model(cls, f: Any) -> "FieldSpec":
        return cls(
            key=f.field_key,
            label=f.label,
            type=f.field_type,
            required=f.is_required,
            config=f.config or {},
            rules=f.visibility_rules,
            options=[o.value for o in f.options],
            option_labels={o.value: o.label for o in f.options},
        )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, dict, set)):
        return len(value) == 0
    return False


def _norm(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip().lower()


def _to_number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(n) or math.isinf(n) else n


def _slugify_key(label: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", label).strip("_").lower()
    if not key or not key[0].isalpha():
        key = f"field_{key}" if key else "field"
    return key[:90]


def _parse_date(value: Any) -> date:
    text = str(value).strip()
    try:
        return date.fromisoformat(text)
    except ValueError:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()


# --------------------------------------------------------------------------- #
# Conditional visibility
# --------------------------------------------------------------------------- #
def evaluate_condition(operator: str, actual: Any, expected: Any) -> bool:
    op = ConditionOperator(operator)
    if op == ConditionOperator.IS_EMPTY:
        return is_empty(actual)
    if op == ConditionOperator.IS_NOT_EMPTY:
        return not is_empty(actual)

    if is_empty(actual):
        # Nothing answered: only "negative" operators can be true.
        return op in (ConditionOperator.NOT_EQUALS, ConditionOperator.NOT_CONTAINS, ConditionOperator.NOT_IN)

    if op in (ConditionOperator.EQUALS, ConditionOperator.NOT_EQUALS):
        if isinstance(actual, list):
            match = _norm(expected) in {_norm(a) for a in actual}
        else:
            match = _norm(actual) == _norm(expected)
        return match if op == ConditionOperator.EQUALS else not match

    if op in (ConditionOperator.CONTAINS, ConditionOperator.NOT_CONTAINS):
        if isinstance(actual, list):
            match = _norm(expected) in {_norm(a) for a in actual}
        else:
            match = _norm(expected) in _norm(actual)
        return match if op == ConditionOperator.CONTAINS else not match

    if op in (ConditionOperator.IN, ConditionOperator.NOT_IN):
        expected_list = expected if isinstance(expected, list) else [expected]
        expected_set = {_norm(e) for e in expected_list}
        actual_list = actual if isinstance(actual, list) else [actual]
        match = any(_norm(a) in expected_set for a in actual_list)
        return match if op == ConditionOperator.IN else not match

    # Comparisons: numeric when possible, otherwise string (works for ISO dates)
    a_num, e_num = _to_number(actual), _to_number(expected)
    a, e = (a_num, e_num) if a_num is not None and e_num is not None else (str(actual), str(expected))
    if op == ConditionOperator.GREATER_THAN:
        return a > e
    if op == ConditionOperator.LESS_THAN:
        return a < e
    if op == ConditionOperator.GREATER_OR_EQUAL:
        return a >= e
    if op == ConditionOperator.LESS_OR_EQUAL:
        return a <= e
    return False


def compute_visibility(specs: list[FieldSpec], values: dict[str, Any]) -> dict[str, bool]:
    """Return {field_key: is_visible}. A hidden field's value never satisfies
    conditions of fields that depend on it (cascading visibility)."""
    by_key = {s.key: s for s in specs}
    memo: dict[str, bool] = {}

    def visible(key: str, stack: frozenset[str]) -> bool:
        if key in memo:
            return memo[key]
        spec = by_key[key]
        rules = spec.rules
        if not rules or not rules.get("conditions"):
            memo[key] = True
            return True
        if key in stack:  # defensive: cycles are rejected at definition time
            return True
        results = []
        for cond in rules["conditions"]:
            ref = by_key.get(cond.get("field_key"))
            if ref is None:
                results.append(False)
                continue
            ref_value = values.get(ref.key) if visible(ref.key, stack | {key}) else None
            results.append(evaluate_condition(cond.get("operator", "equals"), ref_value, cond.get("value")))
        result = any(results) if rules.get("logic") == "any" else all(results)
        memo[key] = result
        return result

    return {s.key: visible(s.key, frozenset()) for s in specs}


# --------------------------------------------------------------------------- #
# Form definition validation (used when creating / editing fields)
# --------------------------------------------------------------------------- #
def validate_field_definitions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate & normalise a complete list of field definitions.

    `items` are JSON-mode dumps of FieldUpsert/FieldCreate. Returns normalised
    dicts (generated keys, option values, defaulted config). Raises
    FieldDefinitionError with human readable messages.
    """
    errors: list[str] = []
    explicit_keys = {i["field_key"].strip() for i in items if i.get("field_key")}
    used: set[str] = set()
    normalized: list[dict[str, Any]] = []

    for idx, item in enumerate(items, start=1):
        d = dict(item)
        label = (d.get("label") or "").strip()
        ftype = d.get("field_type")
        name = f"Field #{idx} ('{label}')"

        # --- key ---
        key = (d.get("field_key") or "").strip()
        if not key:
            base = _slugify_key(label)
            key, n = base, 2
            while key in used or key in explicit_keys:
                key, n = f"{base}_{n}", n + 1
        if key in used:
            errors.append(f"{name}: duplicate field key '{key}'.")
        used.add(key)

        # --- options ---
        raw_options = d.get("options") or []
        options: list[dict[str, str]] = []
        if ftype in OPTION_FIELD_TYPES:
            seen_values: set[str] = set()
            for opt in raw_options:
                opt_label = (opt.get("label") or "").strip()
                opt_value = (opt.get("value") or opt_label).strip()
                if not opt_label:
                    errors.append(f"{name}: option labels cannot be empty.")
                    continue
                if opt_value in seen_values:
                    errors.append(f"{name}: duplicate option value '{opt_value}'.")
                seen_values.add(opt_value)
                options.append({"label": opt_label, "value": opt_value})
            if ftype in SINGLE_CHOICE_TYPES and not options:
                errors.append(f"{name}: {ftype} fields need at least one option.")

        # --- type specific config ---
        config = dict(d.get("config") or {})
        try:
            config = _normalize_config(ftype, config)
        except ValueError as exc:
            errors.append(f"{name}: {exc}")

        d.update(field_key=key, label=label, options=options, config=config)
        normalized.append(d)

    # --- visibility rules ---
    deps: dict[str, set[str]] = {}
    for d in normalized:
        rules = d.get("visibility_rules")
        deps[d["field_key"]] = set()
        if not rules:
            d["visibility_rules"] = None
            continue
        for cond in rules.get("conditions", []):
            ref = cond.get("field_key")
            if ref == d["field_key"]:
                errors.append(f"Field '{d['field_key']}': a field cannot depend on itself.")
            elif ref not in used:
                errors.append(f"Field '{d['field_key']}': condition references unknown field '{ref}'.")
            else:
                deps[d["field_key"]].add(ref)

    cycle = _find_cycle(deps)
    if cycle:
        errors.append("Circular visibility rules detected: " + " -> ".join(cycle))

    if errors:
        raise FieldDefinitionError(errors)
    return normalized


def _normalize_config(ftype: str, config: dict[str, Any]) -> dict[str, Any]:
    def num(name: str) -> float | None:
        if config.get(name) is None:
            return None
        n = _to_number(config[name])
        if n is None:
            raise ValueError(f"config.{name} must be a number.")
        return n

    if ftype == FieldType.TEXT:
        lo, hi = num("min_length"), num("max_length")
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min_length cannot be greater than max_length.")
        if config.get("pattern"):
            try:
                re.compile(config["pattern"])
            except re.error as exc:
                raise ValueError(f"invalid regex pattern ({exc}).") from exc
    elif ftype == FieldType.NUMBER:
        lo, hi = num("min"), num("max")
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min cannot be greater than max.")
    elif ftype == FieldType.DATE:
        parsed = {}
        for k in ("min_date", "max_date"):
            if config.get(k):
                try:
                    parsed[k] = _parse_date(config[k])
                except ValueError as exc:
                    raise ValueError(f"config.{k} must be an ISO date (YYYY-MM-DD).") from exc
                config[k] = parsed[k].isoformat()
        if len(parsed) == 2 and parsed["min_date"] > parsed["max_date"]:
            raise ValueError("min_date cannot be after max_date.")
    elif ftype == FieldType.CHECKBOX:
        lo, hi = num("min_selected"), num("max_selected")
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min_selected cannot be greater than max_selected.")
    elif ftype == FieldType.RATING:
        max_rating = num("max_rating") or DEFAULT_MAX_RATING
        if not float(max_rating).is_integer() or not 1 <= max_rating <= 10:
            raise ValueError("max_rating must be a whole number between 1 and 10.")
        config["max_rating"] = int(max_rating)
    elif ftype == FieldType.FILE:
        exts = config.get("allowed_extensions") or settings.default_allowed_extensions
        if isinstance(exts, str):
            exts = exts.split(",")
        config["allowed_extensions"] = sorted({str(e).strip().lower().lstrip(".") for e in exts if str(e).strip()})
        max_mb = num("max_size_mb") or settings.MAX_UPLOAD_SIZE_MB
        if max_mb <= 0 or max_mb > settings.MAX_UPLOAD_SIZE_MB:
            raise ValueError(f"max_size_mb must be between 0 and {settings.MAX_UPLOAD_SIZE_MB}.")
        config["max_size_mb"] = max_mb
    return config


def _find_cycle(deps: dict[str, set[str]]) -> list[str] | None:
    WHITE, GREY, BLACK = 0, 1, 2
    color = {k: WHITE for k in deps}
    path: list[str] = []

    def dfs(node: str) -> list[str] | None:
        color[node] = GREY
        path.append(node)
        for nxt in deps.get(node, ()):
            if color.get(nxt) == GREY:
                return path[path.index(nxt):] + [nxt]
            if color.get(nxt) == WHITE:
                found = dfs(nxt)
                if found:
                    return found
        path.pop()
        color[node] = BLACK
        return None

    for k in deps:
        if color[k] == WHITE:
            found = dfs(k)
            if found:
                return found
    return None


# --------------------------------------------------------------------------- #
# Submission validation
# --------------------------------------------------------------------------- #
def _coerce(spec: FieldSpec, raw: Any, *, form_id: int, upload_dir: Path) -> Any:
    """Convert a non-empty raw value into its canonical python value or raise ValueError."""
    t, c = spec.type, spec.config

    if t == FieldType.TEXT:
        if isinstance(raw, (dict, list, bool)):
            raise ValueError("Must be text.")
        value = str(raw).strip()
        min_len, max_len = c.get("min_length"), c.get("max_length") or DEFAULT_TEXT_MAX_LENGTH
        if min_len is not None and len(value) < int(min_len):
            raise ValueError(f"Must be at least {int(min_len)} characters.")
        if len(value) > int(max_len):
            raise ValueError(f"Must be at most {int(max_len)} characters.")
        if c.get("pattern") and not re.fullmatch(c["pattern"], value):
            raise ValueError(c.get("pattern_message") or "Invalid format.")
        return value

    if t == FieldType.NUMBER:
        n = _to_number(raw)
        if n is None:
            raise ValueError("Must be a valid number.")
        if c.get("integer_only") and not n.is_integer():
            raise ValueError("Must be a whole number.")
        if c.get("min") is not None and n < float(c["min"]):
            raise ValueError(f"Must be at least {c['min']}.")
        if c.get("max") is not None and n > float(c["max"]):
            raise ValueError(f"Must be at most {c['max']}.")
        return int(n) if n.is_integer() else n

    if t == FieldType.EMAIL:
        if not isinstance(raw, str):
            raise ValueError("Must be a valid email address.")
        try:
            return validate_email(raw.strip(), check_deliverability=False).normalized
        except EmailNotValidError as exc:
            raise ValueError("Must be a valid email address.") from exc

    if t == FieldType.DATE:
        try:
            d = _parse_date(raw)
        except (ValueError, TypeError) as exc:
            raise ValueError("Must be a valid date (YYYY-MM-DD).") from exc
        if c.get("min_date") and d < _parse_date(c["min_date"]):
            raise ValueError(f"Date must be on or after {c['min_date']}.")
        if c.get("max_date") and d > _parse_date(c["max_date"]):
            raise ValueError(f"Date must be on or before {c['max_date']}.")
        return d.isoformat()

    if t in SINGLE_CHOICE_TYPES:
        if isinstance(raw, (dict, list)):
            raise ValueError("Select a single option.")
        value = _norm(raw) if isinstance(raw, bool) else str(raw).strip()
        if value not in spec.options:
            raise ValueError("Invalid option selected.")
        return value

    if t == FieldType.CHECKBOX:
        if spec.options:  # multi-select checkbox group
            values = raw if isinstance(raw, list) else [raw]
            result: list[str] = []
            for v in values:
                sv = str(v).strip()
                if sv not in spec.options:
                    raise ValueError(f"Invalid option '{sv}'.")
                if sv not in result:
                    result.append(sv)
            if c.get("min_selected") is not None and len(result) < int(c["min_selected"]):
                raise ValueError(f"Select at least {int(c['min_selected'])} option(s).")
            if c.get("max_selected") is not None and len(result) > int(c["max_selected"]):
                raise ValueError(f"Select at most {int(c['max_selected'])} option(s).")
            return result
        # single boolean checkbox (e.g. "I agree to the terms")
        if isinstance(raw, bool):
            return raw
        token = _norm(raw)
        if token in ("true", "1", "yes", "on"):
            return True
        if token in ("false", "0", "no", "off"):
            return False
        raise ValueError("Must be true or false.")

    if t == FieldType.FILE:
        path = raw.get("file_path") if isinstance(raw, dict) else raw
        if not isinstance(path, str):
            raise ValueError("Invalid file reference.")
        rel = path.replace("\\", "/").strip("/")
        parts = Path(rel).parts
        if ".." in parts or len(parts) != 2 or parts[0] != str(form_id):
            raise ValueError("Invalid file reference.")
        if not (upload_dir / rel).is_file():
            raise ValueError("Uploaded file not found. Please upload it again.")
        return rel

    if t == FieldType.RATING:
        n = _to_number(raw)
        max_rating = int(c.get("max_rating") or DEFAULT_MAX_RATING)
        if n is None or not n.is_integer() or not 1 <= n <= max_rating:
            raise ValueError(f"Rating must be a whole number between 1 and {max_rating}.")
        return int(n)

    raise ValueError(f"Unsupported field type '{t}'.")


def validate_submission(
    specs: list[FieldSpec],
    answers: dict[str, Any],
    *,
    form_id: int,
    upload_dir: Path | None = None,
) -> dict[str, Any]:
    """Validate answers against the form definition.

    Returns {field_key: cleaned_value} for every *visible* field (None when
    unanswered). Hidden fields are dropped and never required. Unknown keys
    are ignored. Raises SubmissionValidationError.
    """
    upload_dir = upload_dir or settings.upload_dir
    answers = answers or {}
    coerced: dict[str, Any] = {}
    errors: dict[str, str] = {}

    for spec in specs:
        raw = answers.get(spec.key)
        if is_empty(raw):
            coerced[spec.key] = None
            continue
        try:
            coerced[spec.key] = _coerce(spec, raw, form_id=form_id, upload_dir=upload_dir)
        except ValueError as exc:
            errors[spec.key] = str(exc)
            coerced[spec.key] = None

    visibility = compute_visibility(specs, coerced)
    cleaned: dict[str, Any] = {}
    for spec in specs:
        if not visibility[spec.key]:
            errors.pop(spec.key, None)
            continue
        value = coerced[spec.key]
        if spec.key not in errors and spec.required:
            if spec.type == FieldType.CHECKBOX and not spec.options:
                if value is not True:
                    errors[spec.key] = "This box must be checked."
            elif is_empty(value):
                errors[spec.key] = "This field is required."
        cleaned[spec.key] = value

    if errors:
        raise SubmissionValidationError(errors)
    return cleaned


# --------------------------------------------------------------------------- #
# Storage encoding
# --------------------------------------------------------------------------- #
def encode_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def decode_value(field_type: str, raw: str | None) -> Any:
    if raw is None:
        return None
    if field_type == FieldType.CHECKBOX:
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
        return raw.lower() == "true"
    if field_type == FieldType.NUMBER:
        n = _to_number(raw)
        if n is None:
            return raw
        return int(n) if n.is_integer() else n
    if field_type == FieldType.RATING:
        n = _to_number(raw)
        return int(n) if n is not None else raw
    return raw


def original_file_name(path: str) -> str:
    name = Path(path).name
    return name.split("_", 1)[1] if "_" in name else name


def display_value(field_type: str, value: Any, option_labels: dict[str, str] | None = None) -> str:
    """Human readable value for exports."""
    if value is None:
        return ""
    labels = option_labels or {}
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        return ", ".join(labels.get(str(v), str(v)) for v in value)
    if field_type in SINGLE_CHOICE_TYPES:
        return labels.get(str(value), str(value))
    if field_type == FieldType.FILE:
        return original_file_name(str(value))
    return str(value)
