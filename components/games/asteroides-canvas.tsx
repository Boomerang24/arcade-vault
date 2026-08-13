"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AsteroidesEngine,
  type EngineStats,
} from "@/lib/games/asteroides/engine";
export type AsteroidesCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};
type AsteroidesCanvasProps = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
export const AsteroidesCanvas = forwardRef<
  AsteroidesCanvasHandle,
  AsteroidesCanvasProps
>(function AsteroidesCanvas({ onStats, onGameOver }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidesEngine | null>(null);
  const onStatsRef = useRef(onStats);
  const onGameOverRef = useRef(onGameOver);
  onStatsRef.current = onStats;
  onGameOverRef.current = onGameOver;
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new AsteroidesEngine(canvasRef.current, {
      onStats: (stats) => onStatsRef.current(stats),
      onGameOver: (finalScore) => onGameOverRef.current(finalScore),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);
  useImperativeHandle(ref, () => ({
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    reset: () => engineRef.current?.reset(),
    forceGameOver: () => engineRef.current?.forceGameOver(),
  }));
  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
});
