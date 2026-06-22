export type ProjectStatus = "active" | "archived";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  research_context: Record<string, unknown>;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  project_id: string;
  version_number: number;
  status: "processing" | "ready" | "failed";
  original_filename: string;
  media_type: string;
  file_size_bytes: number;
  sha256: string;
  row_count: number | null;
  column_count: number | null;
  import_options: Record<string, unknown>;
  profile_summary: Record<string, unknown>;
  software_versions: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  source_format: "csv" | "excel";
  created_at: string;
  updated_at: string;
}

export interface DatasetDetail extends Dataset {
  latest_version: DatasetVersion | null;
}

export interface DatasetCatalogItem extends DatasetDetail {
  project_name: string;
}

export interface Variable {
  id: string;
  dataset_version_id: string;
  source_name: string;
  storage_name: string;
  display_name: string;
  data_type: string;
  measurement_level: string;
  ordinal_position: number;
  value_labels: Record<string, unknown>;
  missing_rules: Record<string, unknown>;
  profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DatasetPreview {
  version_id: string;
  offset: number;
  limit: number;
  total_rows: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ResearchDesign {
  id: string;
  project_id: string;
  study_type: string;
  research_questions: string[];
  hypotheses: string[];
  sample_size: number | null;
  temporal_design: string;
  study_focus: string;
  software_preference: string;
  key_constructs: string[];
  summary: string;
  created_at: string;
  updated_at: string;
}

export type VariableRole =
  | "independent_variable"
  | "dependent_variable"
  | "mediator"
  | "moderator"
  | "control_variable"
  | "confounding_variable"
  | "other";

export type ScaleType = "nominal" | "ordinal" | "interval" | "ratio";

export interface MethodMetadata {
  method_key: string;
  method_name: string;
  description: string;
  required_variables: string[];
  assumptions: string[];
  sample_size_guidance: string;
  advantages: string[];
  limitations: string[];
  alternatives: string[];
}

export interface TestRecommendation extends Omit<MethodMetadata, "description"> {
  why_recommended: string;
  confidence_score: number;
}

export interface TestRecommendationResponse {
  project_id: string;
  research_design_id: string;
  dataset_version_id: string;
  recommendations: TestRecommendation[];
  advisory_note: string;
}
