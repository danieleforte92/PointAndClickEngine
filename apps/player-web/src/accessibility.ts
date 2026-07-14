export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export const KEYBOARD_ACTIVATION_KEYS = ["Enter", " "] as const;

export type KeyboardActivationKey =
  (typeof KEYBOARD_ACTIVATION_KEYS)[number];

export type KeyboardActivationEvent = Pick<
  KeyboardEvent,
  "defaultPrevented" | "key" | "preventDefault"
>;

export function isKeyboardActivationKey(
  key: string,
): key is KeyboardActivationKey {
  return (KEYBOARD_ACTIVATION_KEYS as readonly string[]).includes(key);
}

/**
 * Activates a custom keyboard target with the same keys as a native button.
 * Use this from one keyboard event handler on non-button interactive surfaces.
 */
export function activateOnKeyboard(
  event: KeyboardActivationEvent,
  activate: () => void,
): boolean {
  if (event.defaultPrevented || !isKeyboardActivationKey(event.key)) {
    return false;
  }

  event.preventDefault();
  activate();
  return true;
}

export type FocusTarget = Pick<HTMLElement, "focus">;

/** Focuses an element without jumping the page to its position. */
export function focusWithoutScroll(target: FocusTarget | null): boolean {
  if (!target) {
    return false;
  }

  try {
    target.focus({ preventScroll: true });
  } catch {
    // Older browsers may not support FocusOptions; preserve the focus action.
    target.focus();
  }

  return true;
}

/** Focuses the first enabled, tabbable control inside a container. */
export function focusFirstFocusable(root: ParentNode | null): HTMLElement | null {
  const target = root?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
  if (!target) {
    return null;
  }

  focusWithoutScroll(target);
  return target;
}

/** Reads the platform motion preference without assuming a browser runtime. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
