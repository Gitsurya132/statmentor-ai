import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/analysis-workflow`);
}
