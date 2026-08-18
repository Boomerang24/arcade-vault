"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  FroggerEngine,
  type EngineStats,
  type SkinName,
} from "@/lib/games/frogger/engine";
export type FroggerCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  setSkin?: (skin: string) => void;
};
type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
export const FroggerCanvas = forwardRef<FroggerCanvasHandle, Props>(
  function FroggerCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<FroggerEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;
    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new FroggerEngine(canvasRef.current, {
        onStats: (s) => onStatsRef.current(s),
        onGameOver: (s) => onGameOverRef.current(s),
      });
      engineRef.current = engine;
      return () => engine.destroy();
    }, []);
    useImperativeHandle(ref, () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
      setSkin: (skin: string) => engineRef.current?.setSkin(skin as SkinName),
    }));
    return (
      <canvas
        ref={canvasRef}
        width={640}
        height={560}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "1px solid var(--green)",
          boxShadow: "inset 0 0 12px rgba(0, 255, 136, 0.25)",
        }}
      />
    );
  },
);
