import { api } from "@/lib/api";
import type { Dataset, DatasetCatalogItem, Project } from "@/lib/types";

const PAGE_SIZE = 100;

export async function getAllProjects() {
  const firstPage = await api.projects.list(1, PAGE_SIZE);
  const projects = [...firstPage.items];
  const pageCount = Math.ceil(firstPage.total / PAGE_SIZE);

  if (pageCount > 1) {
    const remaining = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        api.projects.list(index + 2, PAGE_SIZE),
      ),
    );
    projects.push(...remaining.flatMap((page) => page.items));
  }

  return projects;
}

export async function getProjectDatasetCatalog(project: Project) {
  const datasets = await getAllProjectDatasets(project.id);
  const details = await Promise.all(
    datasets.map((dataset) => api.datasets.get(dataset.id)),
  );
  return details.map(
    (dataset): DatasetCatalogItem => ({
      ...dataset,
      project_name: project.title,
    }),
  );
}

export async function getGlobalDatasetCatalog() {
  const projects = await getAllProjects();
  const catalogs = await Promise.all(projects.map(getProjectDatasetCatalog));
  return catalogs.flat();
}

async function getAllProjectDatasets(projectId: string) {
  const firstPage = await api.datasets.list(projectId, 1, PAGE_SIZE);
  const datasets: Dataset[] = [...firstPage.items];
  const pageCount = Math.ceil(firstPage.total / PAGE_SIZE);

  if (pageCount > 1) {
    const remaining = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        api.datasets.list(projectId, index + 2, PAGE_SIZE),
      ),
    );
    datasets.push(...remaining.flatMap((page) => page.items));
  }

  return datasets;
}
