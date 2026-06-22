# StatMentor API

FastAPI backend foundation for StatMentor AI.

## Local setup

1. Create and activate a Python 3.12 virtual environment.
2. Install the package with development dependencies:
   `pip install -e ".[dev]"`
3. Copy `.env.example` to `.env` and set the database URL.
4. Run the API:
   `uvicorn app.main:app --reload --port 8000`

The database schema must already contain migration `0001_mvp_schema`.

## Development seed

Create or refresh the deterministic development user and sample project:

```bash
python -m app.scripts.seed_development
```

After reinstalling the editable package, the equivalent command is:

```bash
statmentor-seed-dev
```

## Project API examples

```bash
# List projects
curl "http://localhost:8000/api/v1/projects?page=1&page_size=20"

# Create a project
curl -X POST "http://localhost:8000/api/v1/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dissertation Study",
    "description": "Predictors of doctoral persistence",
    "research_context": {"discipline": "education"}
  }'

# Get a project
curl "http://localhost:8000/api/v1/projects/PROJECT_UUID"

# Update a project
curl -X PATCH "http://localhost:8000/api/v1/projects/PROJECT_UUID" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Dissertation Study", "status": "archived"}'

# Delete a project
curl -X DELETE "http://localhost:8000/api/v1/projects/PROJECT_UUID"
```

## Dataset upload examples

Create a sample CSV:

```bash
cat > /tmp/statmentor-sample.csv <<'CSV'
participant_id,age,group,score
1,29,control,74.5
2,35,treatment,81.0
3,31,treatment,78.5
CSV
```

Upload it to the seeded development project:

```bash
curl -X POST \
  "http://localhost:8000/api/v1/projects/00000000-0000-4000-8000-000000000002/datasets" \
  -F "name=Sample Study Data" \
  -F "description=CSV used for local development" \
  -F 'import_options={"header_row":0,"encoding":"utf-8","delimiter":","}' \
  -F "file=@/tmp/statmentor-sample.csv;type=text/csv"
```

Dataset reads:

```bash
curl "http://localhost:8000/api/v1/projects/PROJECT_UUID/datasets"
curl "http://localhost:8000/api/v1/datasets/DATASET_UUID"
curl "http://localhost:8000/api/v1/dataset-versions/VERSION_UUID"
curl "http://localhost:8000/api/v1/dataset-versions/VERSION_UUID/variables"
curl "http://localhost:8000/api/v1/dataset-versions/VERSION_UUID/preview?offset=0&limit=20"
```

## Variable classification examples

Automatically detect roles and scale types for a dataset version:

```bash
curl -X POST \
  "http://localhost:8000/api/v1/dataset-versions/VERSION_UUID/classifications/detect"
```

Review one variable:

```bash
curl "http://localhost:8000/api/v1/variables/VARIABLE_UUID/metadata"
```

Manually assign a role and scale:

```bash
curl -X PATCH "http://localhost:8000/api/v1/variables/VARIABLE_UUID/metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "moderator",
    "role_confidence": 1.0,
    "role_explanation": "Specified as the interaction variable in the conceptual model.",
    "scale_type": "interval",
    "scale_confidence": 0.95,
    "scale_explanation": "Equal score intervals are assumed; zero is not absolute."
  }'
```

Supported roles are `independent_variable`, `dependent_variable`, `mediator`,
`moderator`, `control_variable`, `confounding_variable`, and `other`.

## Research design wizard examples

```bash
curl -X POST \
  "http://localhost:8000/api/v1/projects/PROJECT_UUID/research-designs" \
  -H "Content-Type: application/json" \
  -d '{
    "study_type": "quantitative",
    "research_questions": [
      "How are leadership, culture, engagement, and performance related?"
    ],
    "hypotheses": [
      "Transformational leadership is positively related to employee engagement."
    ],
    "sample_size": 250,
    "temporal_design": "cross_sectional",
    "study_focus": "relationship",
    "software_preference": "Python",
    "key_constructs": [
      "transformational leadership",
      "organizational culture",
      "employee engagement",
      "organizational performance"
    ]
  }'

curl "http://localhost:8000/api/v1/research-designs/DESIGN_UUID"

curl -X PATCH "http://localhost:8000/api/v1/research-designs/DESIGN_UUID" \
  -H "Content-Type: application/json" \
  -d '{"sample_size": 300, "software_preference": "R"}'

curl "http://localhost:8000/api/v1/research-designs/DESIGN_UUID/summary"
```

## Statistical test recommendation examples

List the seven supported MVP methods:

```bash
curl "http://localhost:8000/api/v1/methods"
curl "http://localhost:8000/api/v1/methods/linear_regression"
```

Request recommendations:

```bash
curl -X POST \
  "http://localhost:8000/api/v1/projects/PROJECT_UUID/test-recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "research_design_id": "RESEARCH_DESIGN_UUID",
    "dataset_version_id": "DATASET_VERSION_UUID",
    "variables": [
      {
        "variable_id": "INDEPENDENT_VARIABLE_UUID",
        "role": "independent_variable",
        "scale_type": "ratio"
      },
      {
        "variable_id": "DEPENDENT_VARIABLE_UUID",
        "role": "dependent_variable",
        "scale_type": "interval"
      },
      {
        "variable_id": "CONTROL_VARIABLE_UUID",
        "role": "control_variable",
        "scale_type": "ratio"
      }
    ]
  }'
```

Recommendations are generated dynamically from the owned research design,
dataset version, stored variable metadata, submitted roles/scales, observed
group cardinality, and declared sample size. This endpoint does not execute any
statistical calculations.
