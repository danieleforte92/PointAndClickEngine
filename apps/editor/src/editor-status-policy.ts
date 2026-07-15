/**
 * Shared policy for converting unknown async failures into user-visible
 * editor status text. Keeping the narrowing here makes command, session, and
 * feature handlers agree without changing the gateway or rendered status UI.
 */
export function formatEditorError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
