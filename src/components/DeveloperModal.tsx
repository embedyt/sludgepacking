import React, { useState } from 'react';
import { AlertTriangle, Compass, FastForward, Heart, Moon, Package, ShieldAlert, Skull, Terminal, Unlock, X } from 'lucide-react';

interface DeveloperModalProps {
  inWorld: boolean;
  sandboxUnlocked: boolean;
  onToggleSandboxUnlock: () => void;
  onGiveDevKit: () => void;
  onAdvanceDay: () => void;
  onSetNightfall: () => void;
  onRefillVitals: () => void;
  onClearEnemies: () => void;
  onTeleport: (dest: 'spawn' | 'cave' | 'river') => void;
  onResetAllData: () => void;
  onClose: () => void;
}

const RESET_STEPS = [
  'Reset All Data',
  'Confirm (1/5): Delete All Worlds?',
  'Confirm (2/5): Wipe Settings & Meta?',
  'Confirm (3/5): Lock Sandbox Again?',
  'Confirm (4/5): This Cannot Be Undone',
  'Confirm (5/5): ERASE EVERYTHING NOW',
];

export const DeveloperModal: React.FC<DeveloperModalProps> = ({
  inWorld,
  sandboxUnlocked,
  onToggleSandboxUnlock,
  onGiveDevKit,
  onAdvanceDay,
  onSetNightfall,
  onRefillVitals,
  onClearEnemies,
  onTeleport,
  onResetAllData,
  onClose,
}) => {
  const [resetStage, setResetStage] = useState(0);

  const handleResetClick = () => {
    if (resetStage < 5) {
      setResetStage(resetStage + 1);
    } else {
      setResetStage(0);
      onResetAllData();
      onClose();
    }
  };

  return (
    <div
      className="hud-layer flex items-center justify-center bg-black/75 hud-interactive p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Developer Tools"
    >
      <div className="rust-surface-solid w-full max-w-lg max-h-[94vh] flex flex-col overflow-hidden border-[#4ade80]/45">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={17} className="text-[#4ade80]" />
            <div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-[#4ade80]">
                Internal Diagnostics
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-wide text-[#f3efe6]">
                DEVELOPER CONSOLE
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close developer menu"
            className="p-1.5 sm:p-2 bg-[#20242a] hover:bg-[#2b3038] border border-white/15 text-[#e5dfd3] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-3.5 sm:p-6 overflow-y-auto flex flex-col gap-4 sm:gap-5">
          {/* Global Meta Tools */}
          <section className="flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] border-b border-white/10 pb-1">
              Global Overrides
            </div>
            <button
              type="button"
              onClick={onToggleSandboxUnlock}
              className={`w-full py-2.5 px-3 border text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-between ${
                sandboxUnlocked
                  ? 'bg-[#17251c] border-[#4ade80]/50 text-[#86efac]'
                  : 'bg-[#14171c] border-white/15 text-[#e5dfd3]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Unlock size={14} />
                Sandbox Mode Unlock State
              </span>
              <span>{sandboxUnlocked ? 'UNLOCKED' : 'LOCKED'}</span>
            </button>
          </section>

          {/* In-World Tools */}
          <section className="flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] border-b border-white/10 pb-1">
              Active World Tools {!inWorld && '(Enter a World to Use)'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!inWorld}
                onClick={onGiveDevKit}
                className="py-2 px-3 bg-[#17201a] hover:bg-[#203025] disabled:opacity-40 border border-[#4ade80]/30 text-xs font-bold uppercase text-[#86efac] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Package size={13} />
                Grant Dev Kit
              </button>
              <button
                type="button"
                disabled={!inWorld}
                onClick={onRefillVitals}
                className="py-2 px-3 bg-[#17201a] hover:bg-[#203025] disabled:opacity-40 border border-[#4ade80]/30 text-xs font-bold uppercase text-[#86efac] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Heart size={13} />
                Refill Vitals
              </button>
              <button
                type="button"
                disabled={!inWorld}
                onClick={onAdvanceDay}
                className="py-2 px-3 bg-[#1a1e24] hover:bg-[#242a33] disabled:opacity-40 border border-white/15 text-xs font-bold uppercase text-[#e5dfd3] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <FastForward size={13} />
                Advance +1 Day
              </button>
              <button
                type="button"
                disabled={!inWorld}
                onClick={onSetNightfall}
                className="py-2 px-3 bg-[#1a1e24] hover:bg-[#242a33] disabled:opacity-40 border border-white/15 text-xs font-bold uppercase text-[#93c5fd] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Moon size={13} />
                Jump to Nightfall
              </button>
              <button
                type="button"
                disabled={!inWorld}
                onClick={onClearEnemies}
                className="col-span-2 py-2 px-3 bg-[#241818] hover:bg-[#332020] disabled:opacity-40 border border-[#ef4444]/35 text-xs font-bold uppercase text-[#fca5a5] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Skull size={13} />
                Clear All Creatures &amp; Raiders
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                disabled={!inWorld}
                onClick={() => onTeleport('spawn')}
                className="py-2 px-2 bg-[#14171c] hover:bg-[#1e232a] disabled:opacity-40 border border-white/15 text-[11px] font-bold uppercase text-[#e5dfd3] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Compass size={12} />
                TP Spawn
              </button>
              <button
                type="button"
                disabled={!inWorld}
                onClick={() => onTeleport('river')}
                className="py-2 px-2 bg-[#14171c] hover:bg-[#1e232a] disabled:opacity-40 border border-white/15 text-[11px] font-bold uppercase text-[#7dd3fc] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Compass size={12} />
                TP River
              </button>
              <button
                type="button"
                disabled={!inWorld}
                onClick={() => onTeleport('cave')}
                className="py-2 px-2 bg-[#14171c] hover:bg-[#1e232a] disabled:opacity-40 border border-white/15 text-[11px] font-bold uppercase text-[#86efac] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Compass size={12} />
                TP Cave
              </button>
            </div>
          </section>

          {/* Danger Zone: 5-Confirmation Data Reset */}
          <section className="p-4 bg-[#201112] border border-[#ef4444]/40 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[#f87171]">
              <ShieldAlert size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">
                Danger Zone · Full Storage Wipe
              </span>
            </div>
            <p className="text-[11px] text-[#fca5a5]/85 leading-relaxed">
              Permanently erases all saved worlds, settings, and progression milestones. Requires 5 consecutive confirmations.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetClick}
                className={`flex-1 py-2.5 px-3 border text-xs font-extrabold uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                  resetStage >= 4
                    ? 'bg-[#b91c1c] hover:bg-[#dc2626] border-[#fecaca] text-white'
                    : resetStage > 0
                      ? 'bg-[#7f1d1d] hover:bg-[#991b1b] border-[#f87171]/60 text-[#fef2f2]'
                      : 'bg-[#2a1515] hover:bg-[#451a1a] border-[#ef4444]/50 text-[#fca5a5]'
                }`}
              >
                <AlertTriangle size={14} />
                {RESET_STEPS[resetStage]}
              </button>
              {resetStage > 0 && (
                <button
                  type="button"
                  onClick={() => setResetStage(0)}
                  className="px-3 py-2.5 bg-[#1b1e23] hover:bg-[#252a32] border border-white/15 text-xs font-bold uppercase text-[#e5dfd3] cursor-pointer"
                >
                  Abort
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
