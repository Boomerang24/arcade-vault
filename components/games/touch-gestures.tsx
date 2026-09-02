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
function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}
function emit(code: GestureCode) {
  dispatchKey("keydown", code);
  dispatchKey("keyup", code);
}
export function TouchGestures({ map, disabled }: TouchGesturesProps) {
  const rootRef = useRef<HTMLDivElement>(null);
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
    const onStart = (e: TouchEvent) => {
      if (disabledRef.current || startRef.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const rect = el.getBoundingClientRect();
      startRef.current = {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
        id: t.identifier,
      };
    };
    const onMove = (e: TouchEvent) => {
      if (disabledRef.current || !startRef.current) return;
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const start = startRef.current;
      if (!start) return;
      const t = Array.from(e.changedTouches).find(
        (touch) => touch.identifier === start.id,
      );
      if (!t) return;
      startRef.current = null;
      if (disabledRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = t.clientX - rect.left - start.x;
      const dy = t.clientY - rect.top - start.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const maxDelta = Math.max(adx, ady);
      const g = mapRef.current;
      if (maxDelta < TAP_MAX_PX) {
        if (g.tap) emit(g.tap);
        return;
      }
      if (maxDelta < SWIPE_MIN_PX) return;
      let code: GestureCode | undefined;
      if (adx >= ady) code = dx < 0 ? g.left : g.right;
      else code = dy < 0 ? g.up : g.down;
      if (code) emit(code);
    };
    const onCancel = () => {
      startRef.current = null;
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
    />
  );
}
