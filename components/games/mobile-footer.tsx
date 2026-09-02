"use client";
export type MobileFooterProps = {
  paused: boolean;
  onTogglePause: () => void;
  skins?: { id: string; label: string }[];
  skin?: string;
  onSkinChange?: (id: string) => void;
  onExit: () => void;
  touchMode?: "gamepad" | "gestures";
  onToggleTouchMode?: () => void;
  gesturesAvailable?: boolean;
};
export function MobileFooter({
  paused,
  onTogglePause,
  skins,
  skin,
  onSkinChange,
  onExit,
  touchMode,
  onToggleTouchMode,
  gesturesAvailable,
}: MobileFooterProps) {
  return (
    <div className="mobile-footer">
      <button className="btn yellow" onClick={onTogglePause}>
        {paused ? "REANUDAR" : "PAUSA"}
      </button>
      {gesturesAvailable ? (
        <button className="btn" onClick={onToggleTouchMode}>
          {touchMode === "gestures" ? "GESTOS" : "GAMEPAD"}
        </button>
      ) : null}
      {skins?.length ? (
        <select
          aria-label="Skin"
          value={skin}
          onChange={(e) => onSkinChange?.(e.target.value)}
          className="btn"
        >
          {skins.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ) : null}
      <button className="btn ghost" onClick={onExit}>
        SALIR
      </button>
    </div>
  );
}
