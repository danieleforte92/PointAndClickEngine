import { describe, expect, it, vi } from "vitest";
import {
  activateOnKeyboard,
  focusFirstFocusable,
  focusWithoutScroll,
  isKeyboardActivationKey,
  prefersReducedMotion,
} from "./accessibility";

describe("player accessibility primitives", () => {
  it("recognizes native button activation keys", () => {
    expect(isKeyboardActivationKey("Enter")).toBe(true);
    expect(isKeyboardActivationKey(" ")).toBe(true);
    expect(isKeyboardActivationKey("ArrowRight")).toBe(false);
  });

  it("activates a custom target once for an allowed key", () => {
    const preventDefault = vi.fn();
    const activate = vi.fn();

    const handled = activateOnKeyboard(
      { key: "Enter", defaultPrevented: false, preventDefault },
      activate,
    );

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });

  it("leaves unrelated or already handled keys alone", () => {
    const preventDefault = vi.fn();
    const activate = vi.fn();

    expect(
      activateOnKeyboard(
        { key: "ArrowRight", defaultPrevented: false, preventDefault },
        activate,
      ),
    ).toBe(false);
    expect(
      activateOnKeyboard(
        { key: "Enter", defaultPrevented: true, preventDefault },
        activate,
      ),
    ).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it("focuses without scrolling when the option is supported", () => {
    const focus = vi.fn();

    expect(focusWithoutScroll({ focus })).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("falls back to regular focus for older browsers", () => {
    const focus = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new TypeError("FocusOptions is unsupported");
      })
      .mockImplementationOnce(() => undefined);

    expect(focusWithoutScroll({ focus })).toBe(true);
    expect(focus).toHaveBeenNthCalledWith(2);
  });

  it("focuses the first enabled control in a container", () => {
    const focus = vi.fn();
    const target = { focus } as unknown as HTMLElement;
    const querySelector = vi.fn(() => target);
    const root = { querySelector } as unknown as ParentNode;

    expect(focusFirstFocusable(root)).toBe(target);
    expect(querySelector).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("returns false for missing focus targets and non-browser motion checks", () => {
    expect(focusWithoutScroll(null)).toBe(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});
