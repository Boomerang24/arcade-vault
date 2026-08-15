"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  TetrisEngine,
  type EngineStats,
  type SkinName,
} from "@/lib/games/tetris/engine";
export type TetrisCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  setSkin?: (skin: string) => void;
};
type TetrisCanvasProps = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
export const TetrisCanvas = forwardRef<TetrisCanvasHandle, TetrisCanvasProps>(
  function TetrisCanvas({ onStats, onGameOver }, ref) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<TetrisEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;
    useEffect(() => {
      if (!boardRef.current || !nextRef.current) return;
      const engine = new TetrisEngine(
        {
          board: boardRef.current,
          next: nextRef.current,
        },
        {
          onStats: (stats) => onStatsRef.current(stats),
          onGameOver: (finalScore) => onGameOverRef.current(finalScore),
        },
      );
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
      setSkin: (skin) => engineRef.current?.setSkin(skin as SkinName),
    }));
    return (
      <div
        className="tetris-layout"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={boardRef}
          width={300}
          height={600}
          className="tetris-board-canvas"
          style={{ height: "100%", width: "auto", maxHeight: "100%" }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: "var(--ink-dim)",
              }}
            >
              NEXT
            </span>
            <canvas
              ref={nextRef}
              width={120}
              height={120}
              className="tetris-next-canvas"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid var(--ink-dim)",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      </div>
    );
  },
);
