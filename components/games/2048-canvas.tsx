"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  Game2048Engine,
  type EngineStats,
  type SkinName,
} from "@/lib/games/2048/engine";
export type Game2048CanvasHandle = {
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
export const Game2048Canvas = forwardRef<Game2048CanvasHandle, Props>(
  function Game2048Canvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Game2048Engine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;
    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new Game2048Engine(canvasRef.current, {
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
        width={800}
        height={600}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "1px solid var(--cyan)",
          boxShadow: "inset 0 0 12px rgba(0, 245, 255, 0.25)",
        }}
      />
    );
  },
);
