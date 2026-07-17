import { useEffect, type RefObject } from "react";

/** Lock body scroll while a modal/drawer/overlay is open. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/** Call `onEscape` when Escape is pressed. */
export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onEscape]);
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FocusTrapOptions = {
  /** When false, skip auto-focusing the first focusable on open (default true). */
  initialFocus?: boolean;
};

/**
 * Trap Tab focus inside `containerRef` while `enabled`.
 * Restores focus to the previously focused element on close.
 */
export function useFocusTrap(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options: FocusTrapOptions = {},
) {
  const { initialFocus = true } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (initialFocus) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? container).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !containerRef.current) {
        return;
      }
      const focusable = [
        ...containerRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        ),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [enabled, containerRef, initialFocus]);
}
