import type {
  Dataset,
  DatasetDetail,
  DatasetPreview,
  Paginated,
  Project,
  ResearchDesign,
  TestRecommendationResponse,
  Variable,
  VariableRole,
  ScaleType,
} from "@/lib/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
    cache: init?.method && init.method !== "GET" ? "no-store" : "no-store",
  });

  if (!response.ok) {
    let message = "Something went wrong while contacting StatMentor.";
    try {
      const body = (await response.json()) as { detail?: string };
      message = body.detail ?? message;
    } catch {}
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  projects: {
    list: (page = 1, pageSize = 20) =>
      request<Paginated<Project>>(`/projects?page=${page}&page_size=${pageSize}`),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (body: {
      title: string;
      description?: string;
      research_context: Record<string, unknown>;
    }) => request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  },
  datasets: {
    list: (projectId: string, page = 1, pageSize = 20) =>
      request<Paginated<Dataset>>(
        `/projects/${projectId}/datasets?page=${page}&page_size=${pageSize}`,
      ),
    get: (id: string) => request<DatasetDetail>(`/datasets/${id}`),
    version: (versionId: string) =>
      request<import("@/lib/types").DatasetVersion>(`/dataset-versions/${versionId}`),
    upload: (projectId: string, formData: FormData) =>
      request<DatasetDetail>(`/projects/${projectId}/datasets`, {
        method: "POST",
        body: formData,
      }),
    variables: (versionId: string) =>
      request<Variable[]>(`/dataset-versions/${versionId}/variables`),
    preview: (versionId: string, offset = 0, limit = 20) =>
      request<DatasetPreview>(
        `/dataset-versions/${versionId}/preview?offset=${offset}&limit=${limit}`,
      ),
    detectVariables: (versionId: string) =>
      request<{ version_id: string; variables: unknown[] }>(
        `/dataset-versions/${versionId}/classifications/detect`,
        { method: "POST" },
      ),
    updateVariableMetadata: (
      variableId: string,
      body: {
        role?: VariableRole;
        role_confidence?: number;
        role_explanation?: string;
        scale_type?: ScaleType;
        scale_confidence?: number;
        scale_explanation?: string;
      },
    ) =>
      request<Variable>(`/variables/${variableId}/metadata`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  researchDesigns: {
    create: (projectId: string, body: Record<string, unknown>) =>
      request<ResearchDesign>(`/projects/${projectId}/research-designs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    summary: (designId: string) =>
      request<{ design_id: string; summary: string }>(
        `/research-designs/${designId}/summary`,
      ),
    get: (designId: string) =>
      request<ResearchDesign>(`/research-designs/${designId}`),
  },
  methods: {
    list: () => request<import("@/lib/types").MethodMetadata[]>("/methods"),
  },
  recommendations: {
    create: (
      projectId: string,
      body: {
        research_design_id: string;
        dataset_version_id: string;
        variables: {
          variable_id: string;
          role: VariableRole;
          scale_type: ScaleType;
        }[];
      },
    ) =>
      request<TestRecommendationResponse>(
        `/projects/${projectId}/test-recommendations`,
        { method: "POST", body: JSON.stringify(body) },
      ),
  },
};
