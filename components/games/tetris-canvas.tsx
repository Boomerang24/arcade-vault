"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
};
type TetrisCanvasProps = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
const SKINS: { value: SkinName; label: string }[] = [
  { value: "retro", label: "Retro" },
  { value: "neon", label: "Neon" },
  { value: "pastel", label: "Pastel" },
  { value: "pixelart", label: "Pixel Art" },
];
export const TetrisCanvas = forwardRef<TetrisCanvasHandle, TetrisCanvasProps>(
  function TetrisCanvas({ onStats, onGameOver }, ref) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<TetrisEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;
    const [skin, setSkin] = useState<SkinName>("retro");
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
    }));
    const handleSkinChange = (value: SkinName) => {
      setSkin(value);
      engineRef.current?.setSkin(value);
    };
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 16,
        }}
      >
        <canvas
          ref={boardRef}
          width={300}
          height={600}
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
            <label
              className="mono"
              htmlFor="tetris-skin"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: "var(--ink-dim)",
              }}
            >
              SKIN
            </label>
            <select
              id="tetris-skin"
              value={skin}
              onChange={(e) => handleSkinChange(e.target.value as SkinName)}
              style={{
                background: "rgba(0,0,0,0.6)",
                color: "var(--ink)",
                border: "1px solid var(--ink-dim)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              {SKINS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
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
