"""Friendly, consistent API responses for request validation failures."""

from __future__ import annotations

import re
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

FIELD_LABELS: dict[str, str] = {
    "role": "Role",
    "position": "Position",
    "status": "Status",
    "category": "Category",
    "amount": "Amount",
    "budget": "Budget",
    "rating": "Rating",
    "title": "Title",
    "body": "Body",
    "description": "Description",
    "email": "Email",
    "password": "Password",
    "student_id": "Student ID",
    "graduation_year": "Graduation year",
    "major": "Major",
    "event_type": "Event type",
    "entry_type": "Entry type",
    "payment_method": "Payment method",
    "starts_at": "Start date",
    "due_date": "Due date",
    "max_signup_count": "Maximum signups",
    "member_ids": "Member IDs",
    "talents": "Talents",
    "refresh_token": "Refresh token",
    "token": "Token",
    "note": "Note",
    "preferred_timing": "Preferred timing",
}

LITERAL_INPUT_RE = re.compile(r"^Input should be (.+)$")


def _field_name(location: tuple[str | int, ...]) -> str:
    parts = [str(part) for part in location]
    if parts and parts[0] in {"body", "query", "path"}:
        parts = parts[1:]
    if not parts:
        return "request"
    leaf = parts[-1]
    return FIELD_LABELS.get(leaf, leaf.replace("_", " ").capitalize())


def _format_literal_options(fragment: str) -> str:
    options = re.findall(r"'([^']+)'", fragment)
    if options:
        return ", ".join(options)
    return fragment.strip("'")


def _friendly_message(error: dict[str, Any]) -> str:
    error_type = error.get("type", "")
    raw_msg = str(error.get("msg", "Invalid value"))
    field = _field_name(tuple(error.get("loc", ())))

    if error_type == "missing":
        return f"{field} is required."

    if error_type in {"enum", "literal_error"}:
        match = LITERAL_INPUT_RE.match(raw_msg)
        if match:
            options = _format_literal_options(match.group(1))
            return f"{field} must be one of: {options}."
        return f"{field} has an invalid value."

    if error_type == "string_too_long":
        max_length = error.get("ctx", {}).get("max_length")
        if max_length is not None:
            return f"{field} must be at most {max_length} characters."
        return f"{field} is too long."

    if error_type == "string_too_short":
        min_length = error.get("ctx", {}).get("min_length")
        if min_length is not None:
            return f"{field} must be at least {min_length} characters."
        return f"{field} is too short."

    if error_type in {"greater_than", "greater_than_equal"}:
        limit = error.get("ctx", {}).get("gt") or error.get("ctx", {}).get("ge")
        if limit is not None:
            comparator = "greater than" if error_type == "greater_than" else "at least"
            return f"{field} must be {comparator} {limit}."
        return f"{field} is too small."

    if error_type in {"less_than", "less_than_equal"}:
        limit = error.get("ctx", {}).get("lt") or error.get("ctx", {}).get("le")
        if limit is not None:
            comparator = "less than" if error_type == "less_than" else "at most"
            return f"{field} must be {comparator} {limit}."
        return f"{field} is too large."

    if error_type == "value_error":
        if raw_msg.startswith("Value error, "):
            return raw_msg.removeprefix("Value error, ")
        return raw_msg

    if "semo.edu" in raw_msg.lower():
        return "Email must be a valid @semo.edu address."

    if raw_msg.startswith("Input should be"):
        match = LITERAL_INPUT_RE.match(raw_msg)
        if match:
            options = _format_literal_options(match.group(1))
            return f"{field} must be one of: {options}."
        return f"{field} has an invalid value."

    return raw_msg


def format_validation_errors(exc: RequestValidationError) -> dict[str, Any]:
    errors = [
        {
            "field": _field_name(tuple(error.get("loc", ()))),
            "message": _friendly_message(error),
        }
        for error in exc.errors()
    ]
    detail = errors[0]["message"] if len(errors) == 1 else "Please fix the highlighted fields."
    return {"detail": detail, "errors": errors}


async def request_validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    payload = format_validation_errors(exc)
    return JSONResponse(status_code=422, content=payload)
