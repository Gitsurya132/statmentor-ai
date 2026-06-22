from __future__ import annotations

from app.db.enums import AnalysisMethod
from app.recommendations.registry import get_method, list_methods


def test_registry_contains_exactly_the_seven_mvp_methods() -> None:
    assert {method.method_key for method in list_methods()} == set(AnalysisMethod)


def test_method_metadata_has_required_guidance() -> None:
    method = get_method(AnalysisMethod.LINEAR_REGRESSION)

    assert method.method_name == "Linear Regression"
    assert method.required_variables
    assert method.assumptions
    assert method.sample_size_guidance
    assert method.advantages
    assert method.limitations

