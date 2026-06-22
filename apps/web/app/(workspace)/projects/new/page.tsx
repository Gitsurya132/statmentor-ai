import { CreateProjectForm } from "@/components/create-project-form";
import { PageHeader } from "@/components/page-header";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        eyebrow="New project"
        title="Give your research a home"
        description="Start with the essentials. You can add datasets and refine the design next."
      />
      <CreateProjectForm />
    </>
  );
}
