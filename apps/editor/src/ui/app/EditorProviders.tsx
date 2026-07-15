import { createContext, useContext, type PropsWithChildren } from "react";
import type { EditorGateway } from "../../editor-gateway";

const EditorGatewayContext = createContext<EditorGateway | null>(null);

export function EditorProviders({ children, gateway }: PropsWithChildren<{ gateway: EditorGateway }>) {
  return <EditorGatewayContext.Provider value={gateway}>{children}</EditorGatewayContext.Provider>;
}

export function useEditorGateway(): EditorGateway {
  const gateway = useContext(EditorGatewayContext);
  if (!gateway) throw new Error("EditorProviders is required");
  return gateway;
}
