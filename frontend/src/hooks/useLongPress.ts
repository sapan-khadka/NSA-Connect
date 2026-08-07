import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

const DEFAULT_DELAY_MS = 480;
const DEFAULT_MOVE_PX = 10;

type LongPressHandlers = {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onClickCapture: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
};

/**
 * Touch-friendly long-press (and right-click) for list rows.
 * Suppresses the synthetic click that follows a successful long-press.
 */
export function useLongPress(
  onLongPress: (() => void) | undefined,
  options?: { delayMs?: number; moveThresholdPx?: number; enabled?: boolean },
): LongPressHandlers | Record<string, never> {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const moveThresholdPx = options?.moveThresholdPx ?? DEFAULT_MOVE_PX;
  const enabled = (options?.enabled ?? true) && Boolean(onLongPress);

  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const didFireRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const fire = useCallback(() => {
    if (!onLongPress) {
      return;
    }
    didFireRef.current = true;
    try {
      navigator.vibrate?.(8);
    } catch {
      // Vibration is optional.
    }
    onLongPress();
  }, [onLongPress]);

  if (!enabled) {
    return {};
  }

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      didFireRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        fire();
      }, delayMs);
    },
    onPointerMove: (event: PointerEvent) => {
      if (!startRef.current || timerRef.current == null) {
        return;
      }
      const dx = Math.abs(event.clientX - startRef.current.x);
      const dy = Math.abs(event.clientY - startRef.current.y);
      if (dx > moveThresholdPx || dy > moveThresholdPx) {
        clearTimer();
      }
    },
    onPointerUp: () => {
      clearTimer();
    },
    onPointerCancel: () => {
      clearTimer();
    },
    onClickCapture: (event: MouseEvent) => {
      if (didFireRef.current) {
        event.preventDefault();
        event.stopPropagation();
        didFireRef.current = false;
      }
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      clearTimer();
      fire();
    },
  };
}
