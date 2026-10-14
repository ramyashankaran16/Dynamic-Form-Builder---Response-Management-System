"""Shared enumerations and constants."""
from enum import StrEnum


class RoleName(StrEnum):
    ADMIN = "Admin"
    USER = "User"


class FieldType(StrEnum):
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    DATE = "date"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    FILE = "file"
    RATING = "rating"


OPTION_FIELD_TYPES = {FieldType.DROPDOWN, FieldType.RADIO, FieldType.CHECKBOX}
SINGLE_CHOICE_TYPES = {FieldType.DROPDOWN, FieldType.RADIO}


class ConditionOperator(StrEnum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IN = "in"
    NOT_IN = "not_in"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    GREATER_OR_EQUAL = "greater_or_equal"
    LESS_OR_EQUAL = "less_or_equal"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"


class EntityType(StrEnum):
    USER = "user"
    FORM = "form"
    FORM_RESPONSE = "form_response"
    EXPORT = "export"


class Action(StrEnum):
    USER_REGISTERED = "USER_REGISTERED"
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    PROFILE_UPDATED = "PROFILE_UPDATED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    FORM_CREATED = "FORM_CREATED"
    FORM_UPDATED = "FORM_UPDATED"
    FORM_DELETED = "FORM_DELETED"
    FORM_ENABLED = "FORM_ENABLED"
    FORM_DISABLED = "FORM_DISABLED"
    FORM_DUPLICATED = "FORM_DUPLICATED"
    FORM_FIELDS_UPDATED = "FORM_FIELDS_UPDATED"
    RESPONSE_SUBMITTED = "RESPONSE_SUBMITTED"
    RESPONSE_UPDATED = "RESPONSE_UPDATED"
    RESPONSE_DELETED = "RESPONSE_DELETED"
    EXPORT_REQUESTED = "EXPORT_REQUESTED"
    EXPORT_DOWNLOADED = "EXPORT_DOWNLOADED"


class ExportFormat(StrEnum):
    EXCEL = "excel"
    PDF = "pdf"
