import React, { useState } from 'react';
import { Info, Sliders, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { formatPlayTime, getSurvivalModeInfo, getVersionLabel } from '../game/rules';
import type { ActiveControlMode, GameStatsSnapshot, QualityPreset, WorldConfig } from '../types/game';
import { WorldInfoModal } from './WorldInfoModal';

interface PauseModalProps {
  quality: QualityPreset;
  shadersEnabled: boolean;
  muted: boolean;
  activeControlMode: ActiveControlMode;
  currentWorld: WorldConfig | null;
  dayCount: number;
  nightsSurvived: number;
  playTimeSec: number;
  kills: number;
  piecesBuilt: number;
  onToggleQuality: () => void;
  onToggleShaders: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onResume: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  quality,
  shadersEnabled,
  muted,
  activeControlMode,
  currentWorld,
  dayCount,
  nightsSurvived,
  playTimeSec,
  kills,
  piecesBuilt,
  onToggleQuality,
  onToggleShaders,
  onToggleMute,
  onOpenSettings,
  onResume,
  onTitle,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const modeInfo = getSurvivalModeInfo(
    currentWorld?.difficulty ?? 'standard',
    currentWorld?.challenges ?? [],
    currentWorld?.sandbox,
  );

  return (
    <div className="hud-layer flex items-center justify-center bg-black/55 hud-interactive p-2.5 sm:p-4">
      <div className="rust-surface-solid w-full max-w-sm max-h-[94vh] overflow-y-auto p-4 sm:p-7" role="dialog" aria-label="Pause Menu">
        <div className="text-[10px] sm:text-xs font-bold tracking-[0.22em] uppercase text-[#4ade80]">
          Progress Saved · Paused
        </div>
        <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-wide text-[#f3efe6]">
          {currentWorld?.name || 'SLUDGE'}
        </h2>
        <div className="mt-1 mb-3 sm:mb-4 flex items-center gap-2 text-[11px] text-[#9ca3af]">
          <span className="font-bold uppercase text-[#e5dfd3]">{modeInfo.label}</span>
          <span>· Day {dayCount}</span>
          <span className="tabular-nums">· {formatPlayTime(playTimeSec)}</span>
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="w-full py-3 bg-[#15803d] hover:bg-[#16a34a] text-[#faf7f2] font-bold text-sm uppercase tracking-wider cursor-pointer transition-colors"
          >
            Resume Survival
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenSettings();
              }}
              className="py-2.5 px-3 bg-[#1a1e24] hover:bg-[#232830] border border-white/15 text-xs font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sliders size={13} className="text-[#4ade80]" />
              Settings
            </button>
            <button
              type="button"
              disabled={!currentWorld}
              onClick={(e) => {
                e.currentTarget.blur();
                setInfoOpen(true);
              }}
              className="py-2.5 px-3 bg-[#1a1e24] hover:bg-[#232830] disabled:opacity-40 border border-white/15 text-xs font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Info size={13} className="text-[#38bdf8]" />
              World Info
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleShaders();
              }}
              className="py-2 px-2 bg-[#1a1e24] hover:bg-[#232830] border border-white/15 text-xs font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center justify-center gap-1"
            >
              <Sparkles size={13} className={shadersEnabled ? 'text-[#4ade80]' : 'text-[#9ca3af]'} />
              {shadersEnabled ? 'FX ON' : 'FX OFF'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleQuality();
              }}
              className="py-2 px-2 bg-[#1a1e24] hover:bg-[#232830] border border-white/15 text-xs font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer"
            >
              {quality === 'high' ? 'High' : 'Low'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="py-2 px-2 bg-[#1a1e24] hover:bg-[#232830] border border-white/15 text-xs font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center justify-center gap-1"
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {muted ? 'Mute' : 'Sound'}
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTitle();
            }}
            className="w-full py-2.5 bg-transparent hover:bg-white/5 border border-white/15 text-[#d1d5db] font-semibold text-sm uppercase tracking-wider cursor-pointer transition-colors"
          >
            Save &amp; Title
          </button>
        </div>

        <div className="mt-4 pt-2 border-t border-white/10 text-right text-[11px] font-mono text-[#6b7280]">
          {getVersionLabel(activeControlMode)}
        </div>
      </div>

      {infoOpen && currentWorld && (
        <WorldInfoModal
          world={{
            name: currentWorld.name,
            seed: currentWorld.seed,
            difficulty: currentWorld.difficulty,
            challenges: currentWorld.challenges,
            sandbox: currentWorld.sandbox,
            dayCount,
            nightsSurvived,
            playTimeSec,
            kills,
            piecesBuilt,
          }}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
};

interface GameOverModalProps {
  stats: GameStatsSnapshot;
  isPermadeath?: boolean;
  onRestart: () => void;
  onTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  isPermadeath,
  onRestart,
  onTitle,
}) => {
  return (
    <div className="hud-layer flex items-center justify-center bg-black/70 hud-interactive p-2.5 sm:p-4">
      <div className="rust-surface-solid w-full max-w-md max-h-[94vh] overflow-y-auto p-4 sm:p-7 border-[#dc2626]/45">
        <div className="text-[10px] sm:text-xs font-bold tracking-[0.22em] uppercase text-[#ef4444]">
          {isPermadeath ? 'Permadeath — Island Save Erased' : 'You Were Killed'}
        </div>
        <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-wide text-[#f3efe6]">
          {stats.causeOfDeath || 'Island Hazard'}
        </h2>
        {!isPermadeath && (
          <p className="mt-1 text-xs text-[#9ca3af]">
            Your gear &amp; resources were packed into a Death Backpack where you fell — loot it in one tap.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-[#101215] border border-white/10">
            <div className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Days · Nights</div>
            <div className="mt-1 text-xl font-black tabular-nums text-[#f3efe6]">
              {stats.daysSurvived} · {stats.nightsSurvived}
            </div>
          </div>
          <div className="p-3 bg-[#101215] border border-white/10">
            <div className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Time Played</div>
            <div className="mt-1 text-xl font-black tabular-nums text-[#f3efe6]">
              {formatPlayTime(stats.playTimeSec)}
            </div>
          </div>
          <div className="p-3 bg-[#101215] border border-white/10">
            <div className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Hostiles Slain</div>
            <div className="mt-1 text-xl font-black tabular-nums text-[#f3efe6]">
              {stats.kills}
            </div>
          </div>
          <div className="p-3 bg-[#101215] border border-white/10">
            <div className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Base · Nodes</div>
            <div className="mt-1 text-xl font-black tabular-nums text-[#f3efe6]">
              {stats.piecesBuilt} · {stats.nodesGathered}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="flex-1 py-3 bg-[#c2410c] hover:bg-[#d95216] text-[#faf7f2] font-bold text-sm uppercase tracking-wider cursor-pointer transition-colors"
          >
            {isPermadeath ? 'New Island' : 'Respawn'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTitle();
            }}
            className="px-5 py-3 bg-[#20242a] hover:bg-[#2a2f37] border border-white/15 text-[#e5dfd3] font-semibold text-sm uppercase tracking-wider cursor-pointer transition-colors"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
};
