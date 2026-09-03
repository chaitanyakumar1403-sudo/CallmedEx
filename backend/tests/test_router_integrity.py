# backend/tests/test_router_integrity.py
"""
Automated Router Integrity & Forensic Diagnostics Test Suite.
Guarantees:
1. Zero route collisions / duplicate path-method pairs across all routers.
2. 100% path parameter correspondence between URL templates and endpoint signatures.
3. Unified verification endpoint returns reviews and verifications without conflict.
4. Clean OpenAPI schema compilation with zero route generation errors.
"""
import inspect
import re
import pytest
from fastapi.routing import APIRoute
from app.main import app


def test_zero_route_collisions_across_all_routers():
    """Verify that no two routers or endpoints register the same HTTP method and path."""
    routes_by_method_path = {}
    duplicates = []

    for r in app.routes:
        if not isinstance(r, APIRoute):
            continue
        for method in r.methods:
            key = (method, r.path)
            if key in routes_by_method_path:
                existing = routes_by_method_path[key]
                duplicates.append(
                    f"Conflict on {method} {r.path}: {existing} vs {r.endpoint.__module__}.{r.endpoint.__name__}"
                )
            else:
                routes_by_method_path[key] = f"{r.endpoint.__module__}.{r.endpoint.__name__}"

    assert len(duplicates) == 0, f"Found duplicate route registrations: {duplicates}"


def test_path_parameters_match_function_signatures():
    """Ensure every path parameter (e.g. {id}, {token}) exists in the handler's parameters."""
    mismatches = []

    for r in app.routes:
        if not isinstance(r, APIRoute):
            continue
        path_params = re.findall(r"\{([a-zA-Z0-9_]+)\}", r.path)
        sig = inspect.signature(r.endpoint)
        handler_param_names = set(sig.parameters.keys())

        for p in path_params:
            if p not in handler_param_names:
                mismatches.append(
                    f"{r.path} expects {{{p}}} but {r.endpoint.__name__} has parameters {list(sig.parameters.keys())}"
                )

    assert len(mismatches) == 0, f"Found path parameter mismatches: {mismatches}"


def test_openapi_schema_builds_cleanly():
    """Verify the OpenAPI schema compiles without runtime exceptions or missing dependencies."""
    schema = app.openapi()
    assert schema is not None
    assert "paths" in schema
    assert len(schema["paths"]) > 200


@pytest.mark.asyncio
async def test_admin_verifications_unified_route():
    """Verify that GET /api/admin/verifications returns both reviews and verifications."""
    from app.routers.admin_verification import list_reviews

    mock_admin_user = {"sub": "admin-1", "role": "admin", "email": "admin@callmedex.com"}
    res = await list_reviews(status="under_review", current_user=mock_admin_user)

    assert res.get("success") is True
    assert "reviews" in res
    assert "verifications" in res
    assert "city_scope" in res
