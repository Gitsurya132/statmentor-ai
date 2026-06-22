import { DatasetUploadForm } from "@/components/dataset-upload-form";
import { PageHeader } from "@/components/page-header";

export default async function DatasetUploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <>
      <PageHeader
        eyebrow="Dataset upload"
        title="Bring your data into focus"
        description="Upload a CSV or Excel workbook. StatMentor will preserve the original, profile the data, and create a variable dictionary."
      />
      <DatasetUploadForm projectId={projectId} />
    </>
  );
}
