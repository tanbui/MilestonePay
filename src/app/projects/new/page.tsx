import type { Metadata } from "next";
import { Suspense } from "react";
import { SowUploader } from "@/components/projects/SowUploader";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { loadPageData } from "@/lib/queries";

export const metadata: Metadata = { title: "New project from SOW" };

export default function NewProjectPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProject />
    </Suspense>
  );
}

async function NewProject() {
  const { config } = await loadPageData();
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Overview" }, { href: "/projects", label: "Projects" }, { label: "New project from SOW" }]}
        title="New project from SOW"
        subtitle="The agent reads the contract, pulls out milestones, amounts and acceptance criteria, and flags anything it can't verify. You review before anything reaches PayPal."
      />
      <PageBody>
        <div className="max-w-3xl">
          <SowUploader aiMode={config.ai.mode} />
        </div>
      </PageBody>
    </>
  );
}
