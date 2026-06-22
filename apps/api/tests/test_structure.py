from fastapi.testclient import TestClient

from app.db import models  # noqa: F401
from app.db.base import Base
from app.main import app


def test_all_mvp_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == {
        "users",
        "projects",
        "datasets",
        "dataset_versions",
        "variables",
        "research_questions",
        "analyses",
        "analysis_results",
        "reports",
    }


def test_required_routes_are_registered() -> None:
    paths = app.openapi()["paths"]
    assert "get" in paths["/api/v1/health/live"]
    assert "get" in paths["/api/v1/health/ready"]
    assert "get" in paths["/api/v1/projects"]
    assert "post" in paths["/api/v1/projects"]
    assert "get" in paths["/api/v1/projects/{project_id}"]
    assert "patch" in paths["/api/v1/projects/{project_id}"]
    assert "delete" in paths["/api/v1/projects/{project_id}"]
    assert "post" in paths["/api/v1/projects/{project_id}/datasets"]
    assert "get" in paths["/api/v1/projects/{project_id}/datasets"]
    assert "get" in paths["/api/v1/datasets/{dataset_id}"]
    assert "get" in paths["/api/v1/dataset-versions/{version_id}"]
    assert "get" in paths["/api/v1/dataset-versions/{version_id}/variables"]
    assert "get" in paths["/api/v1/dataset-versions/{version_id}/preview"]
    assert "get" in paths["/api/v1/variables/{variable_id}/metadata"]
    assert "patch" in paths["/api/v1/variables/{variable_id}/metadata"]
    assert "post" in paths[
        "/api/v1/dataset-versions/{version_id}/classifications/detect"
    ]
    assert "post" in paths["/api/v1/projects/{project_id}/research-designs"]
    assert "get" in paths["/api/v1/research-designs/{design_id}"]
    assert "patch" in paths["/api/v1/research-designs/{design_id}"]
    assert "get" in paths["/api/v1/research-designs/{design_id}/summary"]
    assert "get" in paths["/api/v1/methods"]
    assert "get" in paths["/api/v1/methods/{method_key}"]
    assert "post" in paths["/api/v1/projects/{project_id}/test-recommendations"]


def test_liveness_endpoint() -> None:
    response = TestClient(app).get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
