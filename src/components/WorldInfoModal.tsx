import React, { useState } from 'react';
import { Check, Clock, Copy, Info, ShieldAlert, X } from 'lucide-react';
import { CHALLENGE_DEFS, DIFFICULTY_PROFILES } from '../game/gameData';
import { formatPlayTime, getSurvivalModeInfo } from '../game/rules';
import type { ChallengeId, DifficultyLevel } from '../types/game';

export interface WorldInfoDetails {
  name: string;
  seed: string;
  difficulty: DifficultyLevel;
  challenges: ChallengeId[];
  sandbox?: boolean;
  dayCount: number;
  nightsSurvived: number;
  playTimeSec: number;
  kills?: number;
  piecesBuilt?: number;
}

interface WorldInfoModalProps {
  world: WorldInfoDetails;
  onClose: () => void;
}

export const WorldInfoModal: React.FC<WorldInfoModalProps> = ({ world, onClose }) => {
  const [copied, setCopied] = useState(false);
  const modeInfo = getSurvivalModeInfo(world.difficulty, world.challenges, world.sandbox);
  const diffProf = DIFFICULTY_PROFILES[world.difficulty] ?? DIFFICULTY_PROFILES.standard;

  const handleCopySeed = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(world.seed);
      } else {
        const ta = document.createElement('textarea');
        ta.value = world.seed;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="hud-layer flex items-center justify-center bg-black/70 hud-interactive p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`World Details: ${world.name}`}
    >
      <div className="rust-surface-solid w-full max-w-md max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Info size={17} className="text-[#4ade80]" />
            <div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-[#4ade80]">
                World Archive
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-wide text-[#f3efe6]">
                {world.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close world details"
            className="p-1.5 sm:p-2 bg-[#20242a] hover:bg-[#2b3038] border border-white/15 text-[#e5dfd3] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-3.5 sm:p-6 overflow-y-auto flex flex-col gap-3 sm:gap-4">
          {/* Mode + Difficulty */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-[#101215] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                Mode Classification
              </div>
              <div className="mt-1 text-sm font-black uppercase text-[#f3efe6]">
                {modeInfo.label}
              </div>
            </div>
            <div className="p-3 bg-[#101215] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                Base Difficulty
              </div>
              <div className="mt-1 text-sm font-black uppercase text-[#e5dfd3]">
                {world.sandbox ? 'Sandbox' : diffProf.label}
              </div>
            </div>
          </div>

          {/* Time & Survival Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-[#101215] border border-white/10">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                <Clock size={11} />
                Time Played
              </div>
              <div className="mt-1 text-base font-black tabular-nums text-[#f3efe6]">
                {formatPlayTime(world.playTimeSec)}
              </div>
            </div>
            <div className="p-3 bg-[#101215] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                Days · Nights Survived
              </div>
              <div className="mt-1 text-base font-black tabular-nums text-[#4ade80]">
                Day {world.dayCount} · {world.nightsSurvived} Night{world.nightsSurvived === 1 ? '' : 's'}
              </div>
            </div>
            {typeof world.kills === 'number' && (
              <div className="p-3 bg-[#101215] border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                  Hostiles Slain
                </div>
                <div className="mt-1 text-base font-black tabular-nums text-[#f3efe6]">
                  {world.kills}
                </div>
              </div>
            )}
            {typeof world.piecesBuilt === 'number' && (
              <div className="p-3 bg-[#101215] border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                  Pieces Built
                </div>
                <div className="mt-1 text-base font-black tabular-nums text-[#f3efe6]">
                  {world.piecesBuilt}
                </div>
              </div>
            )}
          </div>

          {/* Copyable Seed */}
          <div className="p-3 bg-[#101215] border border-white/12 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                Island Seed
              </div>
              <div className="mt-0.5 text-sm font-mono font-bold text-[#f3efe6] truncate">
                {world.seed}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopySeed}
              aria-label="Copy Seed"
              className="px-3 py-2 bg-[#1c2128] hover:bg-[#272e37] border border-white/15 text-xs font-bold uppercase tracking-wider text-[#4ade80] cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Seed'}
            </button>
          </div>

          {/* Active Challenges */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">
              <ShieldAlert size={13} className="text-[#fb923c]" />
              Enabled Challenges ({world.challenges.length})
            </div>
            {world.challenges.length === 0 ? (
              <div className="p-2.5 bg-[#101215] border border-white/10 text-xs text-[#9ca3af]">
                None enabled
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {world.challenges.map((cid) => {
                  const def = CHALLENGE_DEFS.find((c) => c.id === cid);
                  return (
                    <div
                      key={cid}
                      className="px-3 py-2 bg-[#231414] border border-[#ef4444]/35 text-xs"
                    >
                      <div className="font-bold text-[#fecaca]">{def?.label ?? cid}</div>
                      {def && <div className="text-[11px] text-[#fca5a5]/75">{def.description}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
