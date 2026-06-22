import { redirect } from "next/navigation";

export default async function ResearchDesignPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/analysis-workflow`);
}
