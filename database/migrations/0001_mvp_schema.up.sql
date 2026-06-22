BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_status AS ENUM ('active', 'disabled', 'deleted');
CREATE TYPE project_status AS ENUM ('active', 'archived');
CREATE TYPE dataset_format AS ENUM ('csv', 'excel');
CREATE TYPE dataset_version_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE variable_data_type AS ENUM (
    'integer',
    'float',
    'boolean',
    'string',
    'date',
    'datetime'
);
CREATE TYPE measurement_level AS ENUM ('nominal', 'ordinal', 'scale', 'unknown');
CREATE TYPE statistical_assumption AS ENUM (
    'independent_observations',
    'appropriate_measurement_level',
    'no_extreme_outliers',
    'normality',
    'bivariate_normality',
    'linearity',
    'monotonic_relationship',
    'homoscedasticity',
    'homogeneity_of_variance',
    'independent_groups',
    'continuous_dependent_variable',
    'categorical_grouping_variable',
    'normally_distributed_residuals',
    'no_multicollinearity',
    'no_influential_observations',
    'correct_model_specification',
    'unidimensionality',
    'tau_equivalence',
    'uncorrelated_item_errors',
    'adequate_item_covariance'
);
CREATE TYPE analysis_method AS ENUM (
    'descriptive_statistics',
    'pearson_correlation',
    'spearman_correlation',
    'independent_t_test',
    'one_way_anova',
    'linear_regression',
    'cronbach_alpha'
);
CREATE TYPE analysis_status AS ENUM ('draft', 'running', 'completed', 'failed');
CREATE TYPE report_status AS ENUM ('draft', 'final');

CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext NOT NULL UNIQUE,
    name varchar(200) NOT NULL,
    image_url text,
    password_hash text,
    google_subject varchar(255) UNIQUE,
    email_verified_at timestamptz,
    status user_status NOT NULL DEFAULT 'active',
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT users_auth_method_required
        CHECK (password_hash IS NOT NULL OR google_subject IS NOT NULL)
);

CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title varchar(250) NOT NULL,
    description text,
    research_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    status project_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT projects_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT projects_research_context_object
        CHECK (jsonb_typeof(research_context) = 'object'),
    CONSTRAINT projects_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT projects_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE datasets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    name varchar(250) NOT NULL,
    description text,
    source_format dataset_format NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT datasets_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT datasets_project_fk
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT datasets_id_project_unique UNIQUE (id, project_id)
);

CREATE TABLE dataset_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id uuid NOT NULL,
    project_id uuid NOT NULL,
    version_number integer NOT NULL,
    status dataset_version_status NOT NULL DEFAULT 'processing',
    original_filename varchar(500) NOT NULL,
    media_type varchar(150) NOT NULL,
    source_storage_key text NOT NULL UNIQUE,
    normalized_storage_key text UNIQUE,
    file_size_bytes bigint NOT NULL,
    sha256 char(64) NOT NULL,
    row_count bigint,
    column_count integer,
    import_options jsonb NOT NULL DEFAULT '{}'::jsonb,
    profile_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    software_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code varchar(100),
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dataset_versions_number_positive CHECK (version_number > 0),
    CONSTRAINT dataset_versions_filename_not_blank
        CHECK (btrim(original_filename) <> ''),
    CONSTRAINT dataset_versions_media_type_not_blank
        CHECK (btrim(media_type) <> ''),
    CONSTRAINT dataset_versions_source_key_not_blank
        CHECK (btrim(source_storage_key) <> ''),
    CONSTRAINT dataset_versions_file_size_positive
        CHECK (file_size_bytes > 0),
    CONSTRAINT dataset_versions_sha256_hex
        CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT dataset_versions_row_count_nonnegative
        CHECK (row_count IS NULL OR row_count >= 0),
    CONSTRAINT dataset_versions_column_count_positive
        CHECK (column_count IS NULL OR column_count > 0),
    CONSTRAINT dataset_versions_import_options_object
        CHECK (jsonb_typeof(import_options) = 'object'),
    CONSTRAINT dataset_versions_profile_summary_object
        CHECK (jsonb_typeof(profile_summary) = 'object'),
    CONSTRAINT dataset_versions_software_versions_object
        CHECK (jsonb_typeof(software_versions) = 'object'),
    CONSTRAINT dataset_versions_ready_fields
        CHECK (
            status <> 'ready'
            OR (
                normalized_storage_key IS NOT NULL
                AND row_count IS NOT NULL
                AND column_count IS NOT NULL
                AND error_code IS NULL
            )
        ),
    CONSTRAINT dataset_versions_failed_error
        CHECK (status <> 'failed' OR error_code IS NOT NULL),
    CONSTRAINT dataset_versions_dataset_project_fk
        FOREIGN KEY (dataset_id, project_id)
        REFERENCES datasets(id, project_id)
        ON DELETE CASCADE,
    CONSTRAINT dataset_versions_dataset_version_unique
        UNIQUE (dataset_id, version_number),
    CONSTRAINT dataset_versions_id_dataset_unique UNIQUE (id, dataset_id),
    CONSTRAINT dataset_versions_id_project_unique UNIQUE (id, project_id)
);

CREATE TABLE variables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version_id uuid NOT NULL,
    source_name text NOT NULL,
    storage_name text NOT NULL,
    display_name text NOT NULL,
    data_type variable_data_type NOT NULL,
    measurement_level measurement_level NOT NULL DEFAULT 'unknown',
    ordinal_position integer NOT NULL,
    value_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
    missing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
    profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT variables_source_name_not_blank CHECK (btrim(source_name) <> ''),
    CONSTRAINT variables_storage_name_not_blank CHECK (btrim(storage_name) <> ''),
    CONSTRAINT variables_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT variables_position_nonnegative CHECK (ordinal_position >= 0),
    CONSTRAINT variables_value_labels_object
        CHECK (jsonb_typeof(value_labels) = 'object'),
    CONSTRAINT variables_missing_rules_object
        CHECK (jsonb_typeof(missing_rules) = 'object'),
    CONSTRAINT variables_profile_object CHECK (jsonb_typeof(profile) = 'object'),
    CONSTRAINT variables_dataset_version_fk
        FOREIGN KEY (dataset_version_id)
        REFERENCES dataset_versions(id)
        ON DELETE CASCADE,
    CONSTRAINT variables_storage_name_unique
        UNIQUE (dataset_version_id, storage_name),
    CONSTRAINT variables_position_unique
        UNIQUE (dataset_version_id, ordinal_position),
    CONSTRAINT variables_id_version_unique UNIQUE (id, dataset_version_id)
);

CREATE TABLE research_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    question_text text NOT NULL,
    study_design varchar(100),
    structured_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT research_questions_text_not_blank
        CHECK (btrim(question_text) <> ''),
    CONSTRAINT research_questions_context_object
        CHECK (jsonb_typeof(structured_context) = 'object'),
    CONSTRAINT research_questions_project_fk
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT research_questions_id_project_unique UNIQUE (id, project_id)
);

CREATE TABLE analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    dataset_version_id uuid NOT NULL,
    research_question_id uuid,
    name varchar(250) NOT NULL,
    method analysis_method NOT NULL,
    status analysis_status NOT NULL DEFAULT 'draft',
    specification jsonb NOT NULL,
    spec_schema_version varchar(20) NOT NULL DEFAULT '1.0',
    software_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    error_code varchar(100),
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT analyses_project_fk
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT analyses_dataset_version_fk
        FOREIGN KEY (dataset_version_id, project_id)
        REFERENCES dataset_versions(id, project_id)
        ON DELETE CASCADE,
    CONSTRAINT analyses_question_project_fk
        FOREIGN KEY (research_question_id, project_id)
        REFERENCES research_questions(id, project_id)
        ON DELETE SET NULL (research_question_id),
    CONSTRAINT analyses_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT analyses_specification_object
        CHECK (jsonb_typeof(specification) = 'object'),
    CONSTRAINT analyses_confidence_level_valid
        CHECK (
            CASE
                WHEN NOT (specification ? 'confidence_level') THEN true
                WHEN jsonb_typeof(specification -> 'confidence_level') <> 'number'
                    THEN false
                ELSE
                    (specification ->> 'confidence_level')::numeric > 0.50
                    AND (specification ->> 'confidence_level')::numeric < 1.00
            END
        ),
    CONSTRAINT analyses_software_versions_object
        CHECK (jsonb_typeof(software_versions) = 'object'),
    CONSTRAINT analyses_schema_version_not_blank
        CHECK (btrim(spec_schema_version) <> ''),
    CONSTRAINT analyses_completed_timestamp
        CHECK (
            status <> 'completed'
            OR (completed_at IS NOT NULL AND error_code IS NULL)
        ),
    CONSTRAINT analyses_failed_error
        CHECK (status <> 'failed' OR error_code IS NOT NULL),
    CONSTRAINT analyses_time_order
        CHECK (
            started_at IS NULL
            OR completed_at IS NULL
            OR completed_at >= started_at
        ),
    CONSTRAINT analyses_id_project_unique UNIQUE (id, project_id)
);

CREATE TABLE analysis_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id uuid NOT NULL,
    project_id uuid NOT NULL,
    run_number integer NOT NULL,
    result_schema_version varchar(20) NOT NULL DEFAULT '1.0',
    sample_summary jsonb NOT NULL,
    estimates jsonb NOT NULL,
    assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
    diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    apa_narrative text,
    tables jsonb NOT NULL DEFAULT '[]'::jsonb,
    figures jsonb NOT NULL DEFAULT '[]'::jsonb,
    provenance jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT analysis_results_run_positive CHECK (run_number > 0),
    CONSTRAINT analysis_results_schema_version_not_blank
        CHECK (btrim(result_schema_version) <> ''),
    CONSTRAINT analysis_results_sample_summary_object
        CHECK (jsonb_typeof(sample_summary) = 'object'),
    CONSTRAINT analysis_results_estimates_object
        CHECK (jsonb_typeof(estimates) = 'object'),
    CONSTRAINT analysis_results_assumptions_object
        CHECK (jsonb_typeof(assumptions) = 'object'),
    CONSTRAINT analysis_results_diagnostics_object
        CHECK (jsonb_typeof(diagnostics) = 'object'),
    CONSTRAINT analysis_results_warnings_array
        CHECK (jsonb_typeof(warnings) = 'array'),
    CONSTRAINT analysis_results_tables_array CHECK (jsonb_typeof(tables) = 'array'),
    CONSTRAINT analysis_results_figures_array
        CHECK (jsonb_typeof(figures) = 'array'),
    CONSTRAINT analysis_results_provenance_object
        CHECK (jsonb_typeof(provenance) = 'object'),
    CONSTRAINT analysis_results_analysis_project_fk
        FOREIGN KEY (analysis_id, project_id)
        REFERENCES analyses(id, project_id)
        ON DELETE CASCADE,
    CONSTRAINT analysis_results_analysis_run_unique
        UNIQUE (analysis_id, run_number),
    CONSTRAINT analysis_results_id_analysis_unique UNIQUE (id, analysis_id),
    CONSTRAINT analysis_results_id_project_unique UNIQUE (id, project_id)
);

CREATE TABLE reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    analysis_result_id uuid NOT NULL,
    title varchar(250) NOT NULL,
    status report_status NOT NULL DEFAULT 'draft',
    apa_version varchar(20) NOT NULL DEFAULT '7',
    document_model jsonb NOT NULL,
    export_storage_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reports_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT reports_apa_version_not_blank CHECK (btrim(apa_version) <> ''),
    CONSTRAINT reports_document_model_object
        CHECK (jsonb_typeof(document_model) = 'object'),
    CONSTRAINT reports_project_fk
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT reports_result_project_fk
        FOREIGN KEY (analysis_result_id, project_id)
        REFERENCES analysis_results(id, project_id)
        ON DELETE CASCADE
);

CREATE VIEW analysis_methods_catalog AS
SELECT *
FROM (
    VALUES
        (
            'descriptive_statistics'::analysis_method,
            'Descriptive Statistics'::text,
            'Summarizes distributions using counts, central tendency, dispersion, and range.'::text,
            1::integer,
            true::boolean
        ),
        (
            'pearson_correlation'::analysis_method,
            'Pearson Correlation'::text,
            'Estimates the strength and direction of a linear relationship between scale variables.'::text,
            2::integer,
            true::boolean
        ),
        (
            'spearman_correlation'::analysis_method,
            'Spearman Correlation'::text,
            'Estimates the strength and direction of a monotonic relationship using ranked values.'::text,
            3::integer,
            true::boolean
        ),
        (
            'independent_t_test'::analysis_method,
            'Independent Samples t-test'::text,
            'Compares the means of two independent groups.'::text,
            4::integer,
            true::boolean
        ),
        (
            'one_way_anova'::analysis_method,
            'One-Way ANOVA'::text,
            'Compares the means of three or more independent groups for one factor.'::text,
            5::integer,
            true::boolean
        ),
        (
            'linear_regression'::analysis_method,
            'Linear Regression'::text,
            'Models a continuous outcome as a linear function of one or more predictors.'::text,
            6::integer,
            true::boolean
        ),
        (
            'cronbach_alpha'::analysis_method,
            'Cronbach Alpha'::text,
            'Estimates the internal consistency reliability of a multi-item scale.'::text,
            7::integer,
            true::boolean
        )
) AS seed(method, label, description, display_order, enabled);

CREATE VIEW measurement_levels_catalog AS
SELECT *
FROM (
    VALUES
        (
            'nominal'::measurement_level,
            'Nominal'::text,
            'Categories have distinct labels without an inherent order.'::text,
            1::integer
        ),
        (
            'ordinal'::measurement_level,
            'Ordinal'::text,
            'Categories have a meaningful order but intervals are not assumed equal.'::text,
            2::integer
        ),
        (
            'scale'::measurement_level,
            'Scale'::text,
            'Numeric values are treated as interval or ratio measurements.'::text,
            3::integer
        ),
        (
            'unknown'::measurement_level,
            'Unknown'::text,
            'The measurement level has not yet been established by inference or user review.'::text,
            4::integer
        )
) AS seed(measurement_level, label, description, display_order);

CREATE VIEW statistical_assumptions_catalog AS
SELECT *
FROM (
    VALUES
        (
            'independent_observations'::statistical_assumption,
            'Independent observations'::text,
            'Each observation is independent of every other observation.'::text,
            'design'::text
        ),
        (
            'appropriate_measurement_level'::statistical_assumption,
            'Appropriate measurement level'::text,
            'Variables meet the measurement-level requirements of the selected method.'::text,
            'data'::text
        ),
        (
            'no_extreme_outliers'::statistical_assumption,
            'No extreme outliers'::text,
            'Extreme observations do not unduly determine the result.'::text,
            'distribution'::text
        ),
        (
            'normality'::statistical_assumption,
            'Normality'::text,
            'The relevant variable or group distribution is approximately normal.'::text,
            'distribution'::text
        ),
        (
            'bivariate_normality'::statistical_assumption,
            'Bivariate normality'::text,
            'Each pair of variables is approximately bivariate normal.'::text,
            'distribution'::text
        ),
        (
            'linearity'::statistical_assumption,
            'Linearity'::text,
            'The modeled relationship is adequately represented by a straight line.'::text,
            'relationship'::text
        ),
        (
            'monotonic_relationship'::statistical_assumption,
            'Monotonic relationship'::text,
            'Variables tend to move consistently in the same or opposite direction.'::text,
            'relationship'::text
        ),
        (
            'homoscedasticity'::statistical_assumption,
            'Homoscedasticity'::text,
            'Residual variance is approximately constant across fitted values.'::text,
            'variance'::text
        ),
        (
            'homogeneity_of_variance'::statistical_assumption,
            'Homogeneity of variance'::text,
            'Population variances are approximately equal across comparison groups.'::text,
            'variance'::text
        ),
        (
            'independent_groups'::statistical_assumption,
            'Independent groups'::text,
            'Participants or observations occur in only one comparison group.'::text,
            'design'::text
        ),
        (
            'continuous_dependent_variable'::statistical_assumption,
            'Continuous dependent variable'::text,
            'The dependent variable is measured at the scale level.'::text,
            'data'::text
        ),
        (
            'categorical_grouping_variable'::statistical_assumption,
            'Categorical grouping variable'::text,
            'The grouping or factor variable represents distinct categories.'::text,
            'data'::text
        ),
        (
            'normally_distributed_residuals'::statistical_assumption,
            'Normally distributed residuals'::text,
            'Model residuals are approximately normally distributed for inference.'::text,
            'distribution'::text
        ),
        (
            'no_multicollinearity'::statistical_assumption,
            'No problematic multicollinearity'::text,
            'Predictors are not redundant to a degree that destabilizes coefficient estimates.'::text,
            'model'::text
        ),
        (
            'no_influential_observations'::statistical_assumption,
            'No unduly influential observations'::text,
            'No individual observation disproportionately determines the fitted model.'::text,
            'model'::text
        ),
        (
            'correct_model_specification'::statistical_assumption,
            'Correct model specification'::text,
            'The model includes an appropriate functional form and relevant predictors.'::text,
            'model'::text
        ),
        (
            'unidimensionality'::statistical_assumption,
            'Unidimensionality'::text,
            'Items primarily measure one underlying construct.'::text,
            'reliability'::text
        ),
        (
            'tau_equivalence'::statistical_assumption,
            'Tau-equivalence'::text,
            'Items have equal true-score loadings when alpha is interpreted as reliability.'::text,
            'reliability'::text
        ),
        (
            'uncorrelated_item_errors'::statistical_assumption,
            'Uncorrelated item errors'::text,
            'Measurement errors are not correlated across items.'::text,
            'reliability'::text
        ),
        (
            'adequate_item_covariance'::statistical_assumption,
            'Adequate item covariance'::text,
            'Items have sufficient shared covariance to support an internal-consistency estimate.'::text,
            'reliability'::text
        )
) AS seed(assumption, label, description, category);

CREATE VIEW analysis_method_assumptions AS
SELECT *
FROM (
    VALUES
        ('descriptive_statistics'::analysis_method, 'appropriate_measurement_level'::statistical_assumption, 1::integer),
        ('pearson_correlation'::analysis_method, 'independent_observations'::statistical_assumption, 1::integer),
        ('pearson_correlation'::analysis_method, 'appropriate_measurement_level'::statistical_assumption, 2::integer),
        ('pearson_correlation'::analysis_method, 'linearity'::statistical_assumption, 3::integer),
        ('pearson_correlation'::analysis_method, 'bivariate_normality'::statistical_assumption, 4::integer),
        ('pearson_correlation'::analysis_method, 'no_extreme_outliers'::statistical_assumption, 5::integer),
        ('spearman_correlation'::analysis_method, 'independent_observations'::statistical_assumption, 1::integer),
        ('spearman_correlation'::analysis_method, 'appropriate_measurement_level'::statistical_assumption, 2::integer),
        ('spearman_correlation'::analysis_method, 'monotonic_relationship'::statistical_assumption, 3::integer),
        ('spearman_correlation'::analysis_method, 'no_extreme_outliers'::statistical_assumption, 4::integer),
        ('independent_t_test'::analysis_method, 'independent_observations'::statistical_assumption, 1::integer),
        ('independent_t_test'::analysis_method, 'independent_groups'::statistical_assumption, 2::integer),
        ('independent_t_test'::analysis_method, 'continuous_dependent_variable'::statistical_assumption, 3::integer),
        ('independent_t_test'::analysis_method, 'categorical_grouping_variable'::statistical_assumption, 4::integer),
        ('independent_t_test'::analysis_method, 'normality'::statistical_assumption, 5::integer),
        ('independent_t_test'::analysis_method, 'homogeneity_of_variance'::statistical_assumption, 6::integer),
        ('independent_t_test'::analysis_method, 'no_extreme_outliers'::statistical_assumption, 7::integer),
        ('one_way_anova'::analysis_method, 'independent_observations'::statistical_assumption, 1::integer),
        ('one_way_anova'::analysis_method, 'independent_groups'::statistical_assumption, 2::integer),
        ('one_way_anova'::analysis_method, 'continuous_dependent_variable'::statistical_assumption, 3::integer),
        ('one_way_anova'::analysis_method, 'categorical_grouping_variable'::statistical_assumption, 4::integer),
        ('one_way_anova'::analysis_method, 'normality'::statistical_assumption, 5::integer),
        ('one_way_anova'::analysis_method, 'homogeneity_of_variance'::statistical_assumption, 6::integer),
        ('one_way_anova'::analysis_method, 'no_extreme_outliers'::statistical_assumption, 7::integer),
        ('linear_regression'::analysis_method, 'independent_observations'::statistical_assumption, 1::integer),
        ('linear_regression'::analysis_method, 'continuous_dependent_variable'::statistical_assumption, 2::integer),
        ('linear_regression'::analysis_method, 'linearity'::statistical_assumption, 3::integer),
        ('linear_regression'::analysis_method, 'homoscedasticity'::statistical_assumption, 4::integer),
        ('linear_regression'::analysis_method, 'normally_distributed_residuals'::statistical_assumption, 5::integer),
        ('linear_regression'::analysis_method, 'no_multicollinearity'::statistical_assumption, 6::integer),
        ('linear_regression'::analysis_method, 'no_influential_observations'::statistical_assumption, 7::integer),
        ('linear_regression'::analysis_method, 'correct_model_specification'::statistical_assumption, 8::integer),
        ('cronbach_alpha'::analysis_method, 'appropriate_measurement_level'::statistical_assumption, 1::integer),
        ('cronbach_alpha'::analysis_method, 'unidimensionality'::statistical_assumption, 2::integer),
        ('cronbach_alpha'::analysis_method, 'tau_equivalence'::statistical_assumption, 3::integer),
        ('cronbach_alpha'::analysis_method, 'uncorrelated_item_errors'::statistical_assumption, 4::integer),
        ('cronbach_alpha'::analysis_method, 'adequate_item_covariance'::statistical_assumption, 5::integer)
) AS seed(method, assumption, display_order);

CREATE INDEX projects_user_created_idx
    ON projects (user_id, created_at DESC);
CREATE INDEX projects_user_status_idx
    ON projects (user_id, status);
CREATE UNIQUE INDEX datasets_project_name_ci_unique
    ON datasets (project_id, lower(name));
CREATE INDEX datasets_project_created_idx
    ON datasets (project_id, created_at DESC);
CREATE INDEX dataset_versions_dataset_created_idx
    ON dataset_versions (dataset_id, created_at DESC);
CREATE INDEX dataset_versions_project_idx
    ON dataset_versions (project_id);
CREATE INDEX dataset_versions_status_idx
    ON dataset_versions (status);
CREATE INDEX variables_version_position_idx
    ON variables (dataset_version_id, ordinal_position);
CREATE INDEX research_questions_project_created_idx
    ON research_questions (project_id, created_at DESC);
CREATE INDEX analyses_project_created_idx
    ON analyses (project_id, created_at DESC);
CREATE INDEX analyses_project_method_idx
    ON analyses (project_id, method);
CREATE INDEX analyses_project_status_idx
    ON analyses (project_id, status);
CREATE INDEX analyses_dataset_version_idx
    ON analyses (dataset_version_id);
CREATE INDEX analyses_research_question_idx
    ON analyses (research_question_id)
    WHERE research_question_id IS NOT NULL;
CREATE INDEX analysis_results_analysis_created_idx
    ON analysis_results (analysis_id, created_at DESC);
CREATE INDEX analysis_results_project_idx
    ON analysis_results (project_id);
CREATE INDEX reports_project_created_idx
    ON reports (project_id, created_at DESC);
CREATE INDEX reports_result_idx
    ON reports (analysis_result_id);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER datasets_set_updated_at
BEFORE UPDATE ON datasets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER variables_set_updated_at
BEFORE UPDATE ON variables
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER research_questions_set_updated_at
BEFORE UPDATE ON research_questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER analyses_set_updated_at
BEFORE UPDATE ON analyses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reports_set_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
