from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_list_methods() -> None:
    response = TestClient(app).get("/api/v1/methods")

    assert response.status_code == 200
    assert len(response.json()) == 7
    assert {method["method_key"] for method in response.json()} == {
        "descriptive_statistics",
        "pearson_correlation",
        "spearman_correlation",
        "independent_t_test",
        "one_way_anova",
        "linear_regression",
        "cronbach_alpha",
    }


def test_get_method_detail() -> None:
    response = TestClient(app).get("/api/v1/methods/pearson_correlation")

    assert response.status_code == 200
    assert response.json()["method_name"] == "Pearson Correlation"


def test_get_unknown_method_returns_404() -> None:
    response = TestClient(app).get("/api/v1/methods/sem")

    assert response.status_code == 404

