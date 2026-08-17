"use client";
export type MobileFooterProps = {
  paused: boolean;
  onTogglePause: () => void;
  skins?: { id: string; label: string }[];
  skin?: string;
  onSkinChange?: (id: string) => void;
  onExit: () => void;
};
export function MobileFooter({
  paused,
  onTogglePause,
  skins,
  skin,
  onSkinChange,
  onExit,
}: MobileFooterProps) {
  return (
    <div className="mobile-footer">
      <button className="btn yellow" onClick={onTogglePause}>
        {paused ? "REANUDAR" : "PAUSA"}
      </button>
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
