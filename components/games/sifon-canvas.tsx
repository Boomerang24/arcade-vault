"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SifonEngine,
  type EngineStats,
  type SkinName,
} from "@/lib/games/sifon/engine";
export type SifonCanvasHandle = {
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
export const SifonCanvas = forwardRef<SifonCanvasHandle, Props>(
  function SifonCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SifonEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;
    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new SifonEngine(canvasRef.current, {
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
    return <canvas ref={canvasRef} width={800} height={600} />;
  },
);
