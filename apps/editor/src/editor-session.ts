/**
 * Stable session boundary for UI features.
 *
 * The implementation is kept in a compatibility module while the feature
 * controllers migrate to smaller typed seams. Consumers must import this
 * public boundary instead of reaching into the legacy implementation.
 */
export * from "./editor-session-legacy";
