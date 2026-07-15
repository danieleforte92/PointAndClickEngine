import { useMemo } from "react";
import { createBrowserEditorGateway, type EditorGateway } from "../../editor-gateway";
import { LegacyEditorApp, type EditorAppProps } from "../legacy-editor-app";
import { EditorProviders } from "./EditorProviders";
import { WorkspaceRouter } from "./WorkspaceRouter";

export type { EditorAppProps };

/**
 * Composition root: owns the injectable gateway and the typed routing/provider
 * seams. Legacy feature markup is progressively replaced behind this boundary
 * without changing the renderer's public entry point.
 */
export function EditorApp({ gateway: injectedGateway }: EditorAppProps = {}) {
  const gateway = useMemo<EditorGateway>(
    () => injectedGateway ?? createBrowserEditorGateway(),
    [injectedGateway]
  );

  return (
    <EditorProviders gateway={gateway}>
      <WorkspaceRouter target={{ workspace: "overview" }}>
        <LegacyEditorApp gateway={gateway} />
      </WorkspaceRouter>
    </EditorProviders>
  );
}
