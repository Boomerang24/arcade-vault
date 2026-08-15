"use client";
import { useRef } from "react";
export type TouchControlsProps = {
  actions: { code: "Space"; label: string }[];
  directions?: {
    up?: boolean;
    down?: boolean;
    left?: boolean;
    right?: boolean;
  };
};
const REPEAT_DELAY_MS = 300;
const REPEAT_INTERVAL_MS = 80;
function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}
export function TouchControls({ actions, directions }: TouchControlsProps) {
  const timers = useRef<
    Record<string, { timeout?: number; interval?: number }>
  >({});
  const startPress = (code: string) => {
    stopPress(code);
    dispatchKey("keydown", code);
    const timeout = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        dispatchKey("keydown", code);
      }, REPEAT_INTERVAL_MS);
      timers.current[code] = { ...timers.current[code], interval };
    }, REPEAT_DELAY_MS);
    timers.current[code] = { timeout };
  };
  const stopPress = (code: string) => {
    const t = timers.current[code];
    if (t?.timeout) window.clearTimeout(t.timeout);
    if (t?.interval) window.clearInterval(t.interval);
    delete timers.current[code];
    dispatchKey("keyup", code);
  };
  const pressHandlers = (code: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      startPress(code);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      stopPress(code);
    },
    onTouchCancel: (e: React.TouchEvent) => {
      e.preventDefault();
      stopPress(code);
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      startPress(code);
    },
    onMouseUp: (e: React.MouseEvent) => {
      e.preventDefault();
      stopPress(code);
    },
    onPointerLeave: () => {
      stopPress(code);
    },
  });
  const dirs = {
    up: directions?.up ?? true,
    down: directions?.down ?? true,
    left: directions?.left ?? true,
    right: directions?.right ?? true,
  };
  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        <button
          type="button"
          className="btn touch-dpad-up"
          disabled={!dirs.up}
          {...pressHandlers("ArrowUp")}
        >
          ▲
        </button>
        <button
          type="button"
          className="btn touch-dpad-left"
          disabled={!dirs.left}
          {...pressHandlers("ArrowLeft")}
        >
          ◀
        </button>
        <button
          type="button"
          className="btn touch-dpad-right"
          disabled={!dirs.right}
          {...pressHandlers("ArrowRight")}
        >
          ▶
        </button>
        <button
          type="button"
          className="btn touch-dpad-down"
          disabled={!dirs.down}
          {...pressHandlers("ArrowDown")}
        >
          ▼
        </button>
      </div>
      {actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((action) => (
            <button
              key={action.code}
              type="button"
              className="btn yellow touch-action-btn"
              {...pressHandlers(action.code)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
