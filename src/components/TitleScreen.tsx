import React, { useState } from 'react';
import {
  AlertTriangle,
  Info,
  Lock,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import type { CreateWorldParams } from '../game/Engine';
import {
  CHALLENGE_DEFS,
  DIFFICULTY_PROFILES,
  SANDBOX_REQUIRED_NIGHTS,
} from '../game/gameData';
import {
  formatPlayTime,
  generateRandomSeedCode,
  getSurvivalModeInfo,
  getVersionLabel,
} from '../game/rules';
import type {
  ActiveControlMode,
  ChallengeId,
  DifficultyLevel,
  QualityPreset,
  SurvivalModeTier,
  WorldSummary,
} from '../types/game';
import { WorldInfoModal } from './WorldInfoModal';

interface TitleScreenProps {
  quality: QualityPreset;
  shadersEnabled: boolean;
  muted: boolean;
  activeControlMode: ActiveControlMode;
  savedWorlds: WorldSummary[];
  sandboxUnlocked: boolean;
  maxNightsSurvived: number;
  onCreateWorld: (params: CreateWorldParams) => void;
  onLoadWorld: (worldId: string) => void;
  onDeleteWorld: (worldId: string) => void;
  onToggleQuality: () => void;
  onToggleShaders: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
}

const DIFFICULTIES: DifficultyLevel[] = ['chill', 'standard', 'brutal'];

function modeBadgeStyle(tier: SurvivalModeTier): string {
  switch (tier) {
    case 'sandbox':
      return 'bg-[#0c2738] border-[#38bdf8]/45 text-[#7dd3fc]';
    case 'true_hardcore':
      return 'bg-[#3b0d0d] border-[#ef4444]/70 text-[#fecaca]';
    case 'ultrahardcore':
      return 'bg-[#331111] border-[#f97316]/60 text-[#fed7aa]';
    case 'hardcore':
      return 'bg-[#2a1515] border-[#ef4444]/50 text-[#fca5a5]';
    case 'brutal':
      return 'bg-[#281a10] border-[#f59e0b]/45 text-[#fde68a]';
    case 'chill':
      return 'bg-[#132219] border-[#4ade80]/35 text-[#86efac]';
    default:
      return 'bg-[#1b1f25] border-white/15 text-[#d1d5db]';
  }
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  quality,
  shadersEnabled,
  muted,
  activeControlMode,
  savedWorlds,
  sandboxUnlocked,
  maxNightsSurvived,
  onCreateWorld,
  onLoadWorld,
  onDeleteWorld,
  onToggleQuality,
  onToggleShaders,
  onToggleMute,
  onOpenSettings,
}) => {
  const [panelTab, setPanelTab] = useState<'worlds' | 'create'>(
    savedWorlds.length > 0 ? 'worlds' : 'create',
  );
  const [worldName, setWorldName] = useState(`Island ${savedWorlds.length + 1}`);
  const [seedInput, setSeedInput] = useState(() => generateRandomSeedCode());
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('standard');
  const [challenges, setChallenges] = useState<ChallengeId[]>([]);
  const [createSandbox, setCreateSandbox] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorldSummary | null>(null);
  const [infoWorld, setInfoWorld] = useState<WorldSummary | null>(null);

  const toggleChallenge = (id: ChallengeId) => {
    setChallenges((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleLaunchNewWorld = (e?: React.FormEvent) => {
    e?.preventDefault();
    const useSandbox = createSandbox && sandboxUnlocked;
    onCreateWorld({
      name: worldName.trim() || `Island ${savedWorlds.length + 1}`,
      seed: seedInput.trim() || generateRandomSeedCode(),
      difficulty: useSandbox ? 'chill' : difficulty,
      challenges: useSandbox ? [] : challenges,
      sandbox: useSandbox,
    });
  };

  const latestWorld = savedWorlds[0] ?? null;
  const previewMode = getSurvivalModeInfo(
    createSandbox && sandboxUnlocked ? 'chill' : difficulty,
    createSandbox && sandboxUnlocked ? [] : challenges,
    createSandbox && sandboxUnlocked,
  );

  const isPhone = activeControlMode === 'phone';

  return (
    <div className="hud-layer flex flex-col justify-between p-3 sm:p-4 lg:p-10 gap-2 sm:gap-3">
      {/* Main Row: Left Title Lockup + Quick Actions | Right Multi-World Manager */}
      <div className="flex-1 min-h-0 flex flex-col min-[600px]:flex-row items-stretch justify-between gap-2.5 sm:gap-4 lg:gap-6">
        {/* Left Column: Bespoke SVG Lockup + Primary Controls */}
        <div className="w-full min-[600px]:w-[44%] lg:w-[460px] shrink-0 flex flex-col justify-center">
          <svg
            viewBox="0 0 500 104"
            className={`${
              isPhone ? 'w-44 min-[600px]:w-48 lg:w-[400px]' : 'w-52 min-[600px]:w-60 lg:w-[440px]'
            } h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]`}
            role="img"
            aria-label="Sludge"
          >
            <polygon
              points="18,16 56,16 68,46 56,76 18,76 6,46"
              fill="#14181a"
              stroke="#4ade80"
              strokeWidth="3"
            />
            <path
              d="M37 25C43 34 48 41 48 49C48 55.6 43.1 61 37 61C30.9 61 26 55.6 26 49C26 41 31 34 37 25Z"
              fill="#22c55e"
              stroke="#bbf7d0"
              strokeWidth="1.8"
            />
            <rect x="86" y="18" width="4" height="58" fill="#4ade80" />
            <text
              x="104"
              y="56"
              fill="#f3efe6"
              stroke="#121418"
              strokeWidth="6"
              paintOrder="stroke"
              fontSize="46"
              fontWeight="900"
              letterSpacing="5"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              SLUDGE
            </text>
            <text
              x="106"
              y="82"
              fill="#4ade80"
              stroke="#121418"
              strokeWidth="4.5"
              paintOrder="stroke"
              fontSize="14"
              fontWeight="800"
              letterSpacing="4.2"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              ISLAND · RIVERS · SURVIVAL
            </text>
          </svg>

          <div className="mt-2.5 min-[600px]:mt-3 lg:mt-6 flex flex-wrap items-center gap-1.5 sm:gap-2.5 hud-interactive">
            {latestWorld ? (
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onLoadWorld(latestWorld.id);
                }}
                className="px-3 py-2 lg:px-6 lg:py-3 bg-[#15803d] hover:bg-[#16a34a] active:translate-y-px text-[#faf7f2] font-bold tracking-wider uppercase text-[11px] lg:text-sm border border-[#4ade80]/50 shadow-lg cursor-pointer transition-colors flex items-center gap-1.5 lg:gap-2"
              >
                <Play size={14} className="shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-none">
                  Continue {latestWorld.name} (Day {latestWorld.dayCount})
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleLaunchNewWorld();
                }}
                className="px-3.5 py-2 lg:px-6 lg:py-3 bg-[#c2410c] hover:bg-[#d95216] active:translate-y-px text-[#faf7f2] font-bold tracking-wider uppercase text-[11px] lg:text-sm border border-[#fb923c]/50 shadow-lg cursor-pointer transition-colors"
              >
                Enter Island
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setWorldName(`Island ${savedWorlds.length + 1}`);
                setPanelTab((prev) => (prev === 'create' ? 'worlds' : 'create'));
              }}
              className="px-3 py-2 lg:px-4 lg:py-3 bg-[#c2410c] hover:bg-[#d95216] text-[#faf7f2] font-bold tracking-wider uppercase text-[11px] lg:text-xs border border-[#fb923c]/50 shadow-lg cursor-pointer transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              {panelTab === 'create' ? 'Saved Worlds' : 'New Island'}
            </button>
          </div>

          <div className="mt-2 lg:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 hud-interactive">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenSettings();
              }}
              className="px-2.5 py-1.5 lg:px-3.5 lg:py-2.5 rust-surface text-[#e5dfd3] hover:border-[#4ade80] text-[11px] lg:text-xs font-semibold tracking-wider uppercase cursor-pointer transition-colors flex items-center gap-1"
            >
              <Sliders size={13} className="text-[#4ade80]" />
              Settings
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleShaders();
              }}
              className="px-2.5 py-1.5 lg:px-3.5 lg:py-2.5 rust-surface text-[#e5dfd3] hover:border-[#4ade80] text-[11px] lg:text-xs font-semibold tracking-wider uppercase cursor-pointer transition-colors flex items-center gap-1"
            >
              <Sparkles size={13} className={shadersEnabled ? 'text-[#4ade80]' : 'text-[#9ca3af]'} />
              Shaders: {shadersEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleQuality();
              }}
              className="px-2.5 py-1.5 lg:px-3.5 lg:py-2.5 rust-surface text-[#e5dfd3] hover:border-[#4ade80] text-[11px] lg:text-xs font-semibold tracking-wider uppercase cursor-pointer transition-colors"
            >
              Graphics: {quality === 'high' ? 'High' : 'Low'}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="p-1.5 lg:p-2.5 rust-surface text-[#e5dfd3] hover:border-[#4ade80] cursor-pointer transition-colors"
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>

        {/* Right Column: World Manager & Seed / Difficulty / Challenge Builder */}
        <div className="flex-1 min-h-0 w-full min-[600px]:w-auto lg:w-[470px] lg:flex-none lg:self-start lg:max-h-[76vh] rust-surface-solid hud-interactive flex flex-col overflow-hidden">
          <div className="flex border-b border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setPanelTab('worlds')}
              className={`flex-1 py-2 lg:py-2.5 text-[11px] lg:text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                panelTab === 'worlds'
                  ? 'bg-[#1b221e] text-[#4ade80] border-b-2 border-[#4ade80]'
                  : 'bg-[#101215] text-[#9ca3af] hover:text-[#e5dfd3]'
              }`}
            >
              Saved Worlds ({savedWorlds.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setWorldName(`Island ${savedWorlds.length + 1}`);
                setPanelTab('create');
              }}
              className={`flex-1 py-2 lg:py-2.5 text-[11px] lg:text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                panelTab === 'create'
                  ? 'bg-[#251812] text-[#fb923c] border-b-2 border-[#c2410c]'
                  : 'bg-[#101215] text-[#9ca3af] hover:text-[#e5dfd3]'
              }`}
            >
              Create New Island
            </button>
          </div>

          {panelTab === 'worlds' ? (
            <div className="p-2.5 sm:p-3 lg:p-4 overflow-y-auto flex-1 min-h-0 flex flex-col gap-2">
              {savedWorlds.length === 0 ? (
                <div className="py-6 px-3 text-center flex flex-col items-center gap-2.5">
                  <p className="text-xs text-[#9ca3af]">
                    No saved islands yet. Generate a seeded island with custom difficulty and survival challenges.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanelTab('create')}
                    className="px-4 py-2 bg-[#c2410c] hover:bg-[#d95216] text-[#faf7f2] text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Create First Island
                  </button>
                </div>
              ) : (
                savedWorlds.map((world) => {
                  const modeInfo = getSurvivalModeInfo(
                    world.difficulty,
                    world.challenges,
                    world.sandbox,
                  );
                  return (
                    <div
                      key={world.id}
                      className="p-2.5 lg:p-3 bg-[#101215] border border-white/12 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs lg:text-sm font-bold text-[#f3efe6] truncate">
                            {world.name}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#1b221e] border border-[#4ade80]/30 text-[9px] lg:text-[10px] font-bold uppercase text-[#4ade80]">
                            Day {world.dayCount}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 border text-[9px] lg:text-[10px] font-bold uppercase ${modeBadgeStyle(modeInfo.tier)}`}
                          >
                            {modeInfo.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] lg:text-[11px] text-[#9ca3af]">
                          <span className="tabular-nums">
                            {formatPlayTime(world.playTimeSec)} played
                          </span>
                          <span className="tabular-nums">
                            · {world.nightsSurvived} night{world.nightsSurvived === 1 ? '' : 's'}
                          </span>
                          {modeInfo.challengeBadge && (
                            <span className="text-[#fb923c] font-semibold">
                              · {modeInfo.challengeBadge}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setInfoWorld(world)}
                          aria-label={`World Info ${world.name}`}
                          title="World Info & Seed"
                          className="p-1.5 lg:p-2 bg-[#161a20] hover:bg-[#232933] border border-white/15 text-[#d1d5db] cursor-pointer transition-colors"
                        >
                          <Info size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadWorld(world.id)}
                          aria-label={`Play ${world.name}`}
                          className="px-2.5 py-1.5 lg:px-3 lg:py-2 bg-[#15803d] hover:bg-[#16a34a] text-[#faf7f2] text-[11px] lg:text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
                        >
                          <Play size={12} />
                          Play
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(world)}
                          aria-label={`Delete ${world.name}`}
                          className="p-1.5 lg:p-2 bg-[#2a1515] hover:bg-[#7f1d1d] border border-[#dc2626]/35 text-[#fca5a5] cursor-pointer transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <form onSubmit={handleLaunchNewWorld} className="p-2.5 sm:p-3 lg:p-4 overflow-y-auto flex-1 min-h-0 flex flex-col gap-2.5 lg:gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                <div>
                  <label
                    htmlFor="world-name-input"
                    className="block text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1"
                  >
                    World Name
                  </label>
                  <input
                    id="world-name-input"
                    type="text"
                    value={worldName}
                    maxLength={28}
                    onChange={(e) => setWorldName(e.target.value)}
                    placeholder="My Island"
                    className="w-full px-2 py-1.5 lg:px-2.5 lg:py-2 bg-[#0e1013] border border-white/15 focus:border-[#4ade80] outline-none text-xs font-semibold text-[#f3efe6]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="world-seed-input"
                    className="block text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1"
                  >
                    Island Seed
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="world-seed-input"
                      type="text"
                      value={seedInput}
                      maxLength={24}
                      onChange={(e) => setSeedInput(e.target.value)}
                      placeholder="SLUDGE-1042"
                      className="flex-1 min-w-0 px-2 py-1.5 lg:px-2.5 lg:py-2 bg-[#0e1013] border border-white/15 focus:border-[#4ade80] outline-none text-xs font-mono text-[#f3efe6]"
                    />
                    <button
                      type="button"
                      onClick={() => setSeedInput(generateRandomSeedCode())}
                      aria-label="Randomize Seed"
                      title="Randomize Seed"
                      className="px-2 py-1.5 lg:px-2.5 lg:py-2 bg-[#1c2128] hover:bg-[#272e37] border border-white/15 text-[#4ade80] cursor-pointer flex items-center gap-1 text-[11px] font-bold uppercase"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sandbox Mode Toggle (Unlocks after 5 nights survived) */}
              <button
                type="button"
                disabled={!sandboxUnlocked}
                onClick={() => sandboxUnlocked && setCreateSandbox((v) => !v)}
                aria-pressed={createSandbox && sandboxUnlocked}
                className={`p-2 lg:p-2.5 border text-left transition-colors flex items-center justify-between gap-2 ${
                  !sandboxUnlocked
                    ? 'bg-[#0e1013] border-white/10 text-[#6b7280] cursor-not-allowed'
                    : createSandbox
                      ? 'bg-[#0c2738] border-[#38bdf8] text-[#e0f2fe] cursor-pointer'
                      : 'bg-[#101215] border-white/15 text-[#e5dfd3] hover:border-[#38bdf8]/60 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {sandboxUnlocked ? (
                    <Wrench size={14} className="text-[#38bdf8] shrink-0" />
                  ) : (
                    <Lock size={14} className="text-[#6b7280] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] lg:text-xs font-bold uppercase tracking-wider">
                      Sandbox Mode
                    </div>
                    <div className="text-[10px] opacity-85 leading-tight">
                      {sandboxUnlocked
                        ? 'Fly, Godmode, Free Build, Entity & Item Spawner'
                        : `Locked — Survive ${Math.min(maxNightsSurvived, SANDBOX_REQUIRED_NIGHTS)}/${SANDBOX_REQUIRED_NIGHTS} nights overall (across worlds)`}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase shrink-0">
                  {sandboxUnlocked ? (createSandbox ? 'ON' : 'OFF') : 'LOCKED'}
                </span>
              </button>

              {!(createSandbox && sandboxUnlocked) && (
                <>
                  <div>
                    <div className="flex items-center justify-between text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                      <span>Difficulty</span>
                      <span
                        className={`px-1.5 py-0.5 border text-[9px] lg:text-[10px] ${modeBadgeStyle(previewMode.tier)}`}
                      >
                        Mode: {previewMode.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
                      {DIFFICULTIES.map((level) => {
                        const prof = DIFFICULTY_PROFILES[level];
                        const active = difficulty === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setDifficulty(level)}
                            className={`p-1.5 lg:p-2 text-left border cursor-pointer transition-colors ${
                              active
                                ? 'bg-[#241913] border-[#fb923c] text-[#f3efe6]'
                                : 'bg-[#101215] border-white/12 text-[#9ca3af] hover:border-white/30'
                            }`}
                          >
                            <div className="text-[11px] lg:text-xs font-bold uppercase tracking-wider">{prof.label}</div>
                            <div className="text-[9px] lg:text-[10px] leading-tight mt-0.5 opacity-85">
                              {level === 'chill'
                                ? '0.65× Dmg · +35% Loot'
                                : level === 'brutal'
                                  ? '1.5× Dmg · Fierce Raids'
                                  : 'Balanced Island'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                      <ShieldAlert size={12} className="text-[#fb923c]" />
                      Survival Challenges (Optional)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {CHALLENGE_DEFS.map((ch) => {
                        const checked = challenges.includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => toggleChallenge(ch.id)}
                            aria-pressed={checked}
                            className={`p-1.5 lg:p-2 text-left border cursor-pointer transition-colors ${
                              checked
                                ? 'bg-[#2a1515] border-[#ef4444]/75 text-[#fecaca]'
                                : 'bg-[#101215] border-white/10 text-[#9ca3af] hover:border-white/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold">{ch.label}</span>
                              <span className={`text-[10px] font-bold uppercase ${checked ? 'text-[#f87171]' : 'text-[#6b7280]'}`}>
                                {checked ? 'ON' : 'OFF'}
                              </span>
                            </div>
                            <div className="text-[9px] lg:text-[10px] leading-tight mt-0.5 opacity-80">
                              {ch.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 lg:py-3 bg-[#c2410c] hover:bg-[#d95216] text-[#faf7f2] font-bold text-xs uppercase tracking-wider border border-[#fb923c]/50 cursor-pointer transition-colors shrink-0"
              >
                {createSandbox && sandboxUnlocked ? 'Launch Sandbox Island' : 'Launch Seeded Island'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Safe Margin Controls Strip + Version */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <div className="hidden lg:block w-14" />
        <p className="m-0 px-2.5 py-1 lg:px-4 lg:py-1.5 rust-surface text-[10px] sm:text-[11px] lg:text-xs tracking-wide text-[#e5dfd3] text-center truncate max-w-[calc(100%-56px)]">
          {isPhone
            ? 'Stick: Move · Drag: Look · Tap Buttons & Hotbar'
            : 'WASD Move · Shift Sprint · Space Jump · Wheel/1-6 Hotbar · LMB Action · RMB Aim / Rotate · E Interact · X Drop · Tab Bag · Q Build · F Light'}
        </p>
        <div className="px-2 py-0.5 lg:px-2.5 lg:py-1 rust-surface text-[10px] lg:text-[11px] font-mono font-bold text-[#9ca3af] shrink-0">
          {getVersionLabel(activeControlMode)}
        </div>
      </div>

      {/* World Info Modal */}
      {infoWorld && (
        <WorldInfoModal
          world={{
            name: infoWorld.name,
            seed: infoWorld.seed,
            difficulty: infoWorld.difficulty,
            challenges: infoWorld.challenges,
            sandbox: infoWorld.sandbox,
            dayCount: infoWorld.dayCount,
            nightsSurvived: infoWorld.nightsSurvived,
            playTimeSec: infoWorld.playTimeSec,
          }}
          onClose={() => setInfoWorld(null)}
        />
      )}

      {/* Delete World Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 hud-interactive"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete World"
        >
          <div className="rust-surface-solid w-full max-w-sm p-6 border-[#ef4444]/50">
            <div className="flex items-center gap-2 text-[#f87171]">
              <AlertTriangle size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">
                Confirm World Deletion
              </span>
            </div>
            <h3 className="mt-2 text-lg font-extrabold text-[#f3efe6]">
              Delete &ldquo;{confirmDelete.name}&rdquo;?
            </h3>
            <p className="mt-1.5 text-xs text-[#9ca3af] leading-relaxed">
              Day {confirmDelete.dayCount} · {formatPlayTime(confirmDelete.playTimeSec)} played. All buildings, chests, inventory, armor, and island progress will be permanently erased.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-[#20242a] hover:bg-[#2a2f37] border border-white/15 text-[#e5dfd3] text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteWorld(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="flex-1 py-2.5 bg-[#991b1b] hover:bg-[#b91c1c] border border-[#f87171]/40 text-[#fef2f2] text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
