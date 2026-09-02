"use client";
import { useEffect, useRef } from "react";
export type GestureCode =
  "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space";
export type GestureMap = Partial<
  Record<"up" | "down" | "left" | "right" | "tap", GestureCode>
>;
export type TouchGesturesProps = {
  map: GestureMap;
  disabled?: boolean;
};
const TAP_MAX_PX = 10;
const SWIPE_MIN_PX = 24;
const TRAIL_FADE_MS = 200;
function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}
function emit(code: GestureCode) {
  dispatchKey("keydown", code);
  dispatchKey("keyup", code);
}
export function TouchGestures({ map, disabled }: TouchGesturesProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const disabledRef = useRef(disabled);
  const mapRef = useRef(map);
  useEffect(() => {
    disabledRef.current = disabled;
    mapRef.current = map;
  }, [disabled, map]);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const drawTrail = (x1: number, y1: number, x2: number, y2: number) => {
      const line = lineRef.current;
      const svg = trailRef.current;
      if (!line || !svg) return;
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      svg.style.transition = "none";
      svg.style.opacity = "1";
    };
    const fadeTrail = () => {
      const svg = trailRef.current;
      if (!svg) return;
      svg.style.transition = `opacity ${TRAIL_FADE_MS}ms ease-out`;
      svg.style.opacity = "0";
    };
    const hideTrail = () => {
      const svg = trailRef.current;
      if (!svg) return;
      svg.style.transition = "none";
      svg.style.opacity = "0";
    };
    const onStart = (e: TouchEvent) => {
      if (disabledRef.current || startRef.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const rect = el.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      startRef.current = { x, y, id: t.identifier };
      drawTrail(x, y, x, y);
    };
    const onMove = (e: TouchEvent) => {
      const start = startRef.current;
      if (disabledRef.current || !start) return;
      e.preventDefault();
      const t = Array.from(e.changedTouches).find(
        (touch) => touch.identifier === start.id,
      );
      if (!t) return;
      const rect = el.getBoundingClientRect();
      drawTrail(start.x, start.y, t.clientX - rect.left, t.clientY - rect.top);
    };
    const onEnd = (e: TouchEvent) => {
      const start = startRef.current;
      if (!start) return;
      const t = Array.from(e.changedTouches).find(
        (touch) => touch.identifier === start.id,
      );
      if (!t) return;
      startRef.current = null;
      if (disabledRef.current) {
        hideTrail();
        return;
      }
      const rect = el.getBoundingClientRect();
      const dx = t.clientX - rect.left - start.x;
      const dy = t.clientY - rect.top - start.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const maxDelta = Math.max(adx, ady);
      const g = mapRef.current;
      if (maxDelta < TAP_MAX_PX) {
        hideTrail();
        if (g.tap) emit(g.tap);
        return;
      }
      fadeTrail();
      if (maxDelta < SWIPE_MIN_PX) return;
      let code: GestureCode | undefined;
      if (adx >= ady) code = dx < 0 ? g.left : g.right;
      else code = dy < 0 ? g.up : g.down;
      if (code) emit(code);
    };
    const onCancel = () => {
      startRef.current = null;
      hideTrail();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, []);
  return (
    <div
      ref={rootRef}
      className={`touch-gestures${disabled ? " is-disabled" : ""}`}
      aria-hidden="true"
    >
      <svg
        ref={trailRef}
        className="touch-gestures-trail"
        style={{ opacity: 0 }}
      >
        <defs>
          <marker
            id="touch-gestures-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--cyan)" />
          </marker>
        </defs>
        <line
          ref={lineRef}
          stroke="var(--cyan)"
          strokeWidth="4"
          strokeLinecap="round"
          markerEnd="url(#touch-gestures-arrow)"
        />
      </svg>
    </div>
  );
}
