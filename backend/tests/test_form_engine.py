import pytest

from app.services.form_engine import (
    FieldDefinitionError, FieldSpec, SubmissionValidationError, compute_visibility, evaluate_condition,
    validate_field_definitions, validate_submission,
)


def test_conditions():
    assert evaluate_condition("equals", "Yes", "yes")
    assert evaluate_condition("contains", ["a", "b"], "b")
    assert evaluate_condition("greater_than", 10, "5")
    assert evaluate_condition("in", "x", ["x", "y"])
    assert evaluate_condition("is_empty", None, None)
    assert evaluate_condition("not_equals", None, "x")
    assert not evaluate_condition("equals", None, "x")


def test_cascading_visibility():
    specs = [
        FieldSpec(key="a", label="A", type="radio", options=["yes", "no"]),
        FieldSpec(key="b", label="B", type="text", rules={"conditions": [{"field_key": "a", "operator": "equals", "value": "yes"}]}),
        FieldSpec(key="c", label="C", type="text", rules={"conditions": [{"field_key": "b", "operator": "is_not_empty"}]}),
    ]
    assert compute_visibility(specs, {"a": "no", "b": "hi"}) == {"a": True, "b": False, "c": False}
    assert compute_visibility(specs, {"a": "yes", "b": "hi"}) == {"a": True, "b": True, "c": True}


def test_hidden_required_field_is_skipped():
    specs = [
        FieldSpec(key="employed", label="Employed", type="radio", required=True, options=["yes", "no"]),
        FieldSpec(key="company", label="Company", type="text", required=True,
                  rules={"conditions": [{"field_key": "employed", "operator": "equals", "value": "yes"}]}),
    ]
    assert validate_submission(specs, {"employed": "no", "company": "ignored"}, form_id=1) == {"employed": "no"}
    with pytest.raises(SubmissionValidationError) as exc:
        validate_submission(specs, {"employed": "yes"}, form_id=1)
    assert "company" in exc.value.errors


def test_type_validation():
    specs = [
        FieldSpec(key="n", label="N", type="number", config={"min": 1, "max": 10}),
        FieldSpec(key="e", label="E", type="email"),
        FieldSpec(key="d", label="D", type="date"),
        FieldSpec(key="r", label="R", type="rating", config={"max_rating": 5}),
        FieldSpec(key="c", label="C", type="checkbox", options=["x", "y"], config={"max_selected": 1}),
    ]
    with pytest.raises(SubmissionValidationError) as exc:
        validate_submission(specs, {"n": 50, "e": "bad", "d": "2024-13-01", "r": 9, "c": ["x", "y"]}, form_id=1)
    assert set(exc.value.errors) == {"n", "e", "d", "r", "c"}
    ok = validate_submission(specs, {"n": "7", "e": "A@Example.com", "d": "2024-01-31", "r": 4, "c": "x"}, form_id=1)
    assert ok["n"] == 7 and ok["r"] == 4 and ok["c"] == ["x"]


def test_definition_errors():
    with pytest.raises(FieldDefinitionError):
        validate_field_definitions([{"label": "Pick", "field_type": "dropdown", "options": []}])
    with pytest.raises(FieldDefinitionError) as exc:
        validate_field_definitions([
            {"label": "A", "field_key": "a", "field_type": "text", "visibility_rules": {"conditions": [{"field_key": "b", "operator": "is_empty"}]}},
            {"label": "B", "field_key": "b", "field_type": "text", "visibility_rules": {"conditions": [{"field_key": "a", "operator": "is_empty"}]}},
        ])
    assert "Circular" in exc.value.errors[0]
    out = validate_field_definitions([{"label": "Full Name", "field_type": "text"}, {"label": "Full Name", "field_type": "text"}])
    assert [f["field_key"] for f in out] == ["full_name", "full_name_2"]
