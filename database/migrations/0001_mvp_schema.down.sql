BEGIN;

DROP VIEW IF EXISTS analysis_method_assumptions;
DROP VIEW IF EXISTS statistical_assumptions_catalog;
DROP VIEW IF EXISTS measurement_levels_catalog;
DROP VIEW IF EXISTS analysis_methods_catalog;

DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS analysis_results;
DROP TABLE IF EXISTS analyses;
DROP TABLE IF EXISTS research_questions;
DROP TABLE IF EXISTS variables;
DROP TABLE IF EXISTS dataset_versions;
DROP TABLE IF EXISTS datasets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS analysis_status;
DROP TYPE IF EXISTS analysis_method;
DROP TYPE IF EXISTS statistical_assumption;
DROP TYPE IF EXISTS measurement_level;
DROP TYPE IF EXISTS variable_data_type;
DROP TYPE IF EXISTS dataset_version_status;
DROP TYPE IF EXISTS dataset_format;
DROP TYPE IF EXISTS project_status;
DROP TYPE IF EXISTS user_status;

-- Deliberately omit CASCADE so rollback cannot remove unrelated objects.
DROP EXTENSION IF EXISTS citext;
DROP EXTENSION IF EXISTS pgcrypto;

COMMIT;
