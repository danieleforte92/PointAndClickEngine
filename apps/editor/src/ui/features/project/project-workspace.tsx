import type { ProjectOverviewModel } from "./project-model";

export function ProjectWorkspace({ model }: { model: ProjectOverviewModel }) {
  return (
    <section className="project-feature-workspace" data-feature="project" aria-label="Project overview">
      <span className="overview-label">Project</span>
      <strong>{model.title}</strong>
      <small>{model.diagnosticCount} diagnostic(s)</small>
    </section>
  );
}
