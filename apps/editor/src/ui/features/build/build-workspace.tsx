import type { BuildReadinessModel } from "./build-model";

export function BuildWorkspace({ model }: { model: BuildReadinessModel }) {
  return (
    <section className={`build-feature-workspace ${model.tone}`} data-feature="build" aria-label="Build readiness">
      <span className="overview-label">Build</span>
      <strong>{model.detail}</strong>
    </section>
  );
}
