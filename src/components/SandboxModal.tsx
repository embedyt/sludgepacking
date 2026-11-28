import React from 'react';
import { Feather, Hammer, Package, Shield, Skull, Sun, Trash2, Wrench, X } from 'lucide-react';
import type { EnemyKind } from '../game/CombatAndAI';
import { formatDayClock } from '../game/rules';
import type { HudSnapshot, ItemId, SandboxState } from '../types/game';

interface SandboxModalProps {
  hud: HudSnapshot;
  onUpdateSandbox: (partial: Partial<SandboxState>) => void;
  onSetTimeOfDay: (t: number) => void;
  onSpawnEntity: (kind: EnemyKind) => void;
  onGiveItem: (itemId: ItemId, count: number) => void;
  onClearEnemies: () => void;
  onClose: () => void;
}

const ENTITY_OPTIONS: Array<{ kind: EnemyKind; label: string }> = [
  { kind: 'boar', label: 'Wild Boar' },
  { kind: 'wolf', label: 'Timber Wolf' },
  { kind: 'bear', label: 'Grizzly Bear' },
  { kind: 'sludge_crawler', label: 'Sludge Crawler' },
  { kind: 'raider_rusher', label: 'Raider Rusher' },
  { kind: 'raider_rifleman', label: 'Raider Rifleman' },
  { kind: 'raider_sapper', label: 'Raider Sapper' },
  { kind: 'raider_juggernaut', label: 'Juggernaut' },
];

const QUICK_ITEMS: Array<{ id: ItemId; count: number; label: string }> = [
  { id: 'wood', count: 250, label: '+250 Wood' },
  { id: 'stone', count: 250, label: '+250 Stone' },
  { id: 'metal_frags', count: 150, label: '+150 Frags' },
  { id: 'sulfur', count: 100, label: '+100 Sulfur' },
  { id: 'sludge', count: 60, label: '+60 Sludge' },
  { id: 'ammo', count: 24, label: '+24 Shells' },
  { id: 'sniper_rifle', count: 1, label: 'Sniper Rifle' },
  { id: 'smg', count: 1, label: 'Sludge SMG' },
  { id: 'pipe_shotgun', count: 1, label: 'Pipe Shotgun' },
  { id: 'wood_pickaxe', count: 1, label: 'Wood Pickaxe' },
  { id: 'flashlight_tactical', count: 1, label: 'Tac Flashlight' },
  { id: 'lantern_item', count: 1, label: 'Sludge Lantern' },
  { id: 'floodlight_item', count: 1, label: 'Floodlight Tower' },
  { id: 'turret_item', count: 1, label: 'Auto-Turret' },
  { id: 'fishing_rod', count: 1, label: 'Fishing Rod' },
  { id: 'chest_item', count: 1, label: 'Storage Chest' },
  { id: 'barrel_item', count: 2, label: '+2 Exp. Barrels' },
  { id: 'grenade', count: 5, label: '+5 Grenades' },
  { id: 'medkit', count: 3, label: '+3 Medkits' },
];

export const SandboxModal: React.FC<SandboxModalProps> = ({
  hud,
  onUpdateSandbox,
  onSetTimeOfDay,
  onSpawnEntity,
  onGiveItem,
  onClearEnemies,
  onClose,
}) => {
  const sb = hud.sandbox;

  return (
    <div
      className="hud-layer flex items-center justify-center bg-black/65 hud-interactive p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sandbox Workshop"
    >
      <div className="rust-surface-solid w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden border-[#38bdf8]/40">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Wrench size={17} className="text-[#38bdf8]" />
            <div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-[#38bdf8]">
                Sandbox Workshop · [K]
              </div>
              <h2 className="text-sm sm:text-lg font-extrabold tracking-wide text-[#f3efe6]">
                WORLD PROPERTIES &amp; SPAWNER
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sandbox menu"
            className="p-1.5 sm:p-2 bg-[#20242a] hover:bg-[#2b3038] border border-white/15 text-[#e5dfd3] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-3.5 sm:p-5 overflow-y-auto flex flex-col gap-4 sm:gap-5">
          {/* Player & World Toggles */}
          <section className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] border-b border-white/10 pb-1">
              Sandbox Rules &amp; Physics
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSandbox({ flyMode: !sb.flyMode })}
                className={`p-2.5 border text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                  sb.flyMode
                    ? 'bg-[#0c2738] border-[#38bdf8] text-[#7dd3fc]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                <Feather size={13} />
                Fly [V]: {sb.flyMode ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSandbox({ godMode: !sb.godMode })}
                className={`p-2.5 border text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                  sb.godMode
                    ? 'bg-[#17251c] border-[#4ade80] text-[#86efac]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                <Shield size={13} />
                Godmode: {sb.godMode ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSandbox({ freeBuild: !sb.freeBuild })}
                className={`p-2.5 border text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                  sb.freeBuild
                    ? 'bg-[#251d11] border-[#fbbf24] text-[#fde68a]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                <Hammer size={13} />
                Free Build: {sb.freeBuild ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSandbox({ freezeTime: !sb.freezeTime })}
                className={`p-2.5 border text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                  sb.freezeTime
                    ? 'bg-[#1e1b2e] border-[#a78bfa] text-[#ddd6fe]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                <Sun size={13} />
                Freeze Sun: {sb.freezeTime ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Move Speed</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">{sb.speedMult.toFixed(1)}×</span>
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={sb.speedMult}
                  onChange={(e) => onUpdateSandbox({ speedMult: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Jump Height</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">{sb.jumpMult.toFixed(1)}×</span>
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={sb.jumpMult}
                  onChange={(e) => onUpdateSandbox({ jumpMult: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Time Speed</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">{sb.timeScale.toFixed(2)}×</span>
                </span>
                <input
                  type="range"
                  min={0.25}
                  max={5}
                  step={0.25}
                  value={sb.timeScale}
                  onChange={(e) => onUpdateSandbox({ timeScale: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#9ca3af]">
                <span>Time of Day: <strong className="text-[#f3efe6] tabular-nums">{formatDayClock(hud.timeOfDay)}</strong></span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => onSetTimeOfDay(0.28)} className="px-2 py-0.5 bg-[#14171c] border border-white/15 text-[10px] font-bold uppercase text-[#fde68a] cursor-pointer">Dawn</button>
                  <button type="button" onClick={() => onSetTimeOfDay(0.5)} className="px-2 py-0.5 bg-[#14171c] border border-white/15 text-[10px] font-bold uppercase text-[#f3efe6] cursor-pointer">Noon</button>
                  <button type="button" onClick={() => onSetTimeOfDay(0.74)} className="px-2 py-0.5 bg-[#14171c] border border-white/15 text-[10px] font-bold uppercase text-[#fb923c] cursor-pointer">Dusk</button>
                  <button type="button" onClick={() => onSetTimeOfDay(0.9)} className="px-2 py-0.5 bg-[#14171c] border border-white/15 text-[10px] font-bold uppercase text-[#93c5fd] cursor-pointer">Midnight</button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={hud.timeOfDay}
                onChange={(e) => onSetTimeOfDay(Number(e.target.value))}
                className="sludge-range"
              />
            </div>
          </section>

          {/* Entity Spawner */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
                <Skull size={13} className="text-[#f87171]" />
                Entity Spawner (7.5m Ahead)
              </span>
              <button
                type="button"
                onClick={onClearEnemies}
                className="px-2.5 py-1 bg-[#2a1515] hover:bg-[#451a1a] border border-[#ef4444]/40 text-[10px] font-bold uppercase text-[#fca5a5] cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={11} />
                Clear All Entities
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ENTITY_OPTIONS.map((ent) => (
                <button
                  key={ent.kind}
                  type="button"
                  onClick={() => onSpawnEntity(ent.kind)}
                  className="py-2 px-2.5 bg-[#14171c] hover:bg-[#1f242c] border border-white/12 text-xs font-semibold text-[#e5dfd3] cursor-pointer"
                >
                  + {ent.label}
                </button>
              ))}
            </div>
          </section>

          {/* Item Spawner */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9ca3af] border-b border-white/10 pb-1">
              <Package size={13} className="text-[#4ade80]" />
              Quick Item &amp; Gear Spawner
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {QUICK_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onGiveItem(item.id, item.count)}
                  className="py-1.5 px-2 bg-[#141916] hover:bg-[#1d2821] border border-[#4ade80]/25 text-[11px] font-semibold text-[#d9f99d] cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
