import React from 'react';
import {
  BedDouble,
  Compass,
  Feather,
  Flame,
  Hammer,
  Heart,
  Moon,
  Mountain,
  Pause,
  Shield,
  Sliders,
  Sun,
  Volume2,
  VolumeX,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import { HAND_STATS, ITEMS } from '../game/gameData';
import { formatDayClock, getItemCount, getSurvivalModeInfo, getVersionLabel } from '../game/rules';
import type { EquippedVisualId, HudSnapshot, NightType, SurvivalModeTier } from '../types/game';
import { ItemIcon } from './ItemIcon';
import { MobileControls } from './MobileControls';

interface HudOverlayProps {
  hud: HudSnapshot;
  onSelectHotbar: (idx: number) => void;
  onToggleCrafting: () => void;
  onToggleRadial: () => void;
  onToggleSandbox: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchSprint: (sprint: boolean) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchActionHeld: (held: boolean) => void;
  onTouchJump: () => void;
  onTouchFlyVert: (dir: -1 | 0 | 1) => void;
  onTouchInteract: () => void;
  onToggleAim: () => void;
  onTouchSecondary: () => void;
  onToggleTorch: () => void;
  onDropActive: () => void;
}

function modeTextColor(tier: SurvivalModeTier): string {
  switch (tier) {
    case 'sandbox':
      return 'text-[#7dd3fc]';
    case 'true_hardcore':
      return 'text-[#fecaca]';
    case 'ultrahardcore':
      return 'text-[#fed7aa]';
    case 'hardcore':
      return 'text-[#fca5a5]';
    case 'brutal':
      return 'text-[#fde68a]';
    case 'chill':
      return 'text-[#86efac]';
    default:
      return 'text-[#d1d5db]';
  }
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  onSelectHotbar,
  onToggleCrafting,
  onToggleRadial,
  onToggleSandbox,
  onToggleMute,
  onOpenSettings,
  onPause,
  onTouchMove,
  onTouchSprint,
  onTouchLookDelta,
  onTouchActionHeld,
  onTouchJump,
  onTouchFlyVert,
  onTouchInteract,
  onToggleAim,
  onTouchSecondary,
  onToggleTorch,
  onDropActive,
}) => {
  const activeSlot = hud.hotbar[hud.selectedHotbarIndex];
  const activeItem = activeSlot?.itemId ? ITEMS[activeSlot.itemId] : null;
  const equippedItemId: EquippedVisualId = activeSlot?.itemId ?? 'hand';
  const arrowsCount = getItemCount(hud.hotbar, hud.backpack, hud.resources, 'arrow');
  const ammoCount = getItemCount(hud.hotbar, hud.backpack, hud.resources, 'ammo');
  const modalsOpen =
    hud.craftingOpen || hud.radialMenuOpen || Boolean(hud.activeChestId) || hud.sandboxMenuOpen;
  const isPhoneMode = hud.activeControlMode === 'phone';
  const versionLabel = getVersionLabel(hud.activeControlMode);

  const nightTag = (nt: NightType): string =>
    nt === 'pitch_dark' ? 'Pitch-Dark' : nt === 'moonlit' ? 'Moonlit' : 'Overcast';

  const modeInfo = getSurvivalModeInfo(
    hud.currentWorld?.difficulty ?? 'standard',
    hud.currentWorld?.challenges ?? [],
    hud.currentWorld?.sandbox,
  );

  const hpPatternClass =
    modeInfo.hpPatternTier !== 'none' ? `hp-pattern-${modeInfo.hpPatternTier}` : '';

  return (
    <>
      {isPhoneMode && !modalsOpen && (
        <MobileControls
          equippedItem={equippedItemId}
          aiming={hud.aiming}
          torchOn={hud.torchOn}
          flyMode={Boolean(hud.currentWorld?.sandbox && hud.sandbox.flyMode)}
          hasInteractPrompt={Boolean(hud.interactPrompt)}
          onTouchMove={onTouchMove}
          onTouchSprint={onTouchSprint}
          onTouchLookDelta={onTouchLookDelta}
          onTouchActionHeld={onTouchActionHeld}
          onTouchJump={onTouchJump}
          onTouchFlyVert={onTouchFlyVert}
          onTouchInteract={onTouchInteract}
          onToggleAim={onToggleAim}
          onTouchSecondary={onTouchSecondary}
          onToggleTorch={onToggleTorch}
          onDropActive={onDropActive}
        />
      )}
      {/* 3x Optical Sniper Scope Reticle */}
      {hud.sniperScoped && !modalsOpen && (
        <div
          className="fixed inset-0 pointer-events-none z-[15] flex items-center justify-center"
          data-testid="sniper-scope-overlay"
          style={{
            background:
              'radial-gradient(circle at center, transparent 34%, rgba(3, 5, 8, 0.96) 36%, rgba(3, 5, 8, 0.99) 100%)',
          }}
        >
          <svg
            viewBox="0 0 400 400"
            className="w-[min(74vh,74vw)] h-[min(74vh,74vw)]"
            aria-hidden="true"
          >
            <circle cx="200" cy="200" r="192" fill="none" stroke="rgba(22,28,36,0.95)" strokeWidth="4" />
            <circle cx="200" cy="200" r="188" fill="none" stroke="rgba(74,222,128,0.28)" strokeWidth="1" />
            <line x1="16" y1="200" x2="186" y2="200" stroke="rgba(18,22,26,0.9)" strokeWidth="1.6" />
            <line x1="214" y1="200" x2="384" y2="200" stroke="rgba(18,22,26,0.9)" strokeWidth="1.6" />
            <line x1="200" y1="16" x2="200" y2="186" stroke="rgba(18,22,26,0.9)" strokeWidth="1.6" />
            <line x1="200" y1="214" x2="200" y2="384" stroke="rgba(18,22,26,0.9)" strokeWidth="1.6" />
            <circle cx="200" cy="200" r="2.2" fill="#4ade80" />
            <line x1="194" y1="224" x2="206" y2="224" stroke="rgba(18,22,26,0.85)" strokeWidth="1.4" />
            <line x1="196" y1="248" x2="204" y2="248" stroke="rgba(18,22,26,0.85)" strokeWidth="1.4" />
            <line x1="176" y1="195" x2="176" y2="205" stroke="rgba(18,22,26,0.85)" strokeWidth="1.4" />
            <line x1="224" y1="195" x2="224" y2="205" stroke="rgba(18,22,26,0.85)" strokeWidth="1.4" />
          </svg>
          <div className="absolute bottom-[12%] px-2.5 py-0.5 bg-black/75 border border-[#4ade80]/35 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4ade80]">
            3.0× Optic
          </div>
        </div>
      )}

      {/* Low-HP Vignette */}
      <div
        className="low-hp-vignette"
        style={{ opacity: hud.health < 35 ? (35 - hud.health) / 35 : 0 }}
      />

      <div className={`hud-layer flex flex-col justify-between ${isPhoneMode ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4 md:p-5'}`}>
        {/* Top Row */}
        <div className="flex items-start justify-between gap-1.5 sm:gap-3">
          {/* Top-Left Compact Status Cluster (+ Compact Vitals in Phone Mode) */}
          <div className="flex flex-col items-start gap-1 min-w-0">
            <div className={`rust-surface flex flex-wrap items-center min-w-0 ${isPhoneMode ? 'px-2 py-1 gap-2' : 'px-2.5 sm:px-3.5 py-1.5 sm:py-2 gap-2 sm:gap-3'}`}>
              <div className="flex items-center gap-1.5">
                {hud.isNight ? (
                  <Moon size={isPhoneMode ? 13 : 16} className="text-[#93c5fd]" />
                ) : (
                  <Sun size={isPhoneMode ? 13 : 16} className="text-[#fbbf24]" />
                )}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#9ca3af] leading-none">
                    Day {hud.dayCount}
                    {hud.isNight ? ` · ${nightTag(hud.nightType)}` : ''}
                  </div>
                  <div className={`${isPhoneMode ? 'text-xs' : 'text-sm'} font-black tabular-nums text-[#f3efe6] leading-tight`}>
                    {formatDayClock(hud.timeOfDay)}
                  </div>
                </div>
              </div>

              {hud.settings.showFps && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] leading-none">
                      FPS
                    </div>
                    <div className="text-sm font-extrabold tabular-nums text-[#bef264] leading-tight">
                      {hud.fps}
                    </div>
                  </div>
                </>
              )}

              {hud.inCave && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="flex items-center gap-1 text-[#4ade80]">
                    <Mountain size={14} />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider tabular-nums">
                      {hud.caveName || 'Cavern'} · -{hud.undergroundDepth}m
                    </span>
                  </div>
                </>
              )}

              {(hud.inWater || hud.inDeepWater) && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div className={`flex items-center gap-1 ${hud.inDeepWater ? 'text-[#38bdf8]' : 'text-[#7dd3fc]'}`}>
                    <Waves size={14} />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      {hud.inDeepWater ? 'Deep Sea' : 'Water'}
                    </span>
                  </div>
                </>
              )}

              {hud.currentWorld?.sandbox && hud.sandbox.flyMode && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="flex items-center gap-1 text-[#7dd3fc]">
                    <Feather size={13} />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">Fly</span>
                  </div>
                </>
              )}

              {hud.speedBoostActive && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#86efac]">
                    Surge
                  </div>
                </>
              )}

              {hud.raidersAlive > 0 && (
                <>
                  <div className="h-6 w-px bg-white/10" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#f87171] leading-none">
                      Raiders
                    </div>
                    <div className="text-sm font-black tabular-nums text-[#fca5a5] leading-tight">
                      {hud.raidersAlive}
                    </div>
                  </div>
                </>
              )}
            </div>

            {isPhoneMode && (
              <div className="rust-surface p-1.5 w-[144px] sm:w-[168px] flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[8px] font-extrabold uppercase tracking-wider">
                  <span className={modeTextColor(modeInfo.tier)}>{modeInfo.label}</span>
                  {hud.armorDefensePct > 0 && (
                    <span className="text-[#93c5fd]">{hud.armorDefensePct}% DEF</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Heart size={10} className="text-[#84cc16] shrink-0" />
                  <div
                    className={`vital-bar-track !h-2.5 flex-1 ${hpPatternClass}`}
                    data-testid="hp-bar-track"
                  >
                    <div
                      className="vital-bar-ghost bg-[#dc2626]"
                      style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
                    />
                    <div
                      className="vital-bar-fill bg-[#65a30d]"
                      style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
                    />
                    {modeInfo.hpPatternTier !== 'none' && <div className="hp-pattern-overlay" />}
                  </div>
                  <span className="w-5 text-right text-[9px] font-black tabular-nums text-[#f3efe6]">
                    {hud.health}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Flame size={10} className="text-[#f59e0b] shrink-0" />
                  <div className="vital-bar-track !h-2 flex-1">
                    <div
                      className="vital-bar-fill bg-[#d97706]"
                      style={{ width: `${(hud.hunger / hud.maxHunger) * 100}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-[9px] font-black tabular-nums text-[#f3efe6]">
                    {hud.hunger}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Zap size={10} className="text-[#38bdf8] shrink-0" />
                  <div className="vital-bar-track !h-2 flex-1">
                    <div
                      className="vital-bar-fill bg-[#0284c7]"
                      style={{ width: `${(hud.stamina / hud.maxStamina) * 100}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-[9px] font-black tabular-nums text-[#f3efe6]">
                    {hud.stamina}
                  </span>
                </div>

                {(hud.inDeepWater || hud.breath < hud.maxBreath) && (
                  <div className="flex items-center gap-1">
                    <Waves size={10} className="text-[#67e8f9] shrink-0" />
                    <div className="vital-bar-track !h-2 flex-1">
                      <div
                        className={`vital-bar-fill ${hud.breath < 30 ? 'bg-[#ef4444]' : 'bg-[#06b6d4]'}`}
                        style={{ width: `${Math.max(0, Math.min(100, (hud.breath / hud.maxBreath) * 100))}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-[9px] font-black tabular-nums text-[#cffafe]">
                      {Math.ceil(hud.breath)}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-[9px] tabular-nums text-[#e5dfd3]">
                  <span className="flex items-center gap-0.5">
                    <ItemIcon id="wood" size={10} />
                    <b>{hud.resources.wood}</b>
                  </span>
                  <span className="flex items-center gap-0.5">
                    <ItemIcon id="stone" size={10} />
                    <b>{hud.resources.stone}</b>
                  </span>
                  <span className="flex items-center gap-0.5">
                    <ItemIcon id="metal_frags" size={10} />
                    <b>{hud.resources.metal_frags}</b>
                  </span>
                  <span className="flex items-center gap-0.5 text-[#86efac]">
                    <ItemIcon id="sludge" size={10} />
                    <b>{hud.resources.sludge}</b>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Top-Center Compact Notifications */}
          <div className="hidden md:flex flex-col items-center gap-1 max-w-xs md:max-w-md pointer-events-none">
            {hud.notifications.map((n) => (
              <div
                key={n.id}
                className={`px-2.5 py-1 text-[11px] font-semibold tracking-wide border text-center ${
                  n.tone === 'danger'
                    ? 'bg-[#2a1212]/90 border-[#ef4444]/50 text-[#fecaca]'
                    : n.tone === 'warn'
                      ? 'bg-[#271d10]/90 border-[#f59e0b]/50 text-[#fde68a]'
                      : n.tone === 'gain'
                        ? 'bg-[#142014]/90 border-[#65a30d]/50 text-[#d9f99d]'
                        : 'bg-[#16181d]/90 border-white/15 text-[#e5dfd3]'
                }`}
              >
                {n.text}
              </div>
            ))}
          </div>

          {/* Top-Right Utility Controls */}
          <div className="flex flex-wrap items-center justify-end gap-1 hud-interactive shrink-0">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCrafting();
              }}
              aria-label="Toggle Backpack and Crafting Menu"
              className={`${isPhoneMode ? 'px-2 py-1.5 text-[11px]' : 'px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs'} rust-surface hover:border-[#4ade80] font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center gap-1`}
            >
              <Hammer size={14} />
              <span className="hidden sm:inline">{isPhoneMode ? 'Bag' : 'Bag [Tab]'}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleRadial();
              }}
              aria-label="Open Build Wheel"
              className={`${isPhoneMode ? 'px-2 py-1.5 text-[11px]' : 'px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs'} rust-surface hover:border-[#4ade80] font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center gap-1`}
            >
              <Compass size={14} />
              <span className="hidden sm:inline">{isPhoneMode ? 'Build' : 'Build [Q]'}</span>
            </button>

            {hud.currentWorld?.sandbox && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleSandbox();
                }}
                aria-label="Open Sandbox Menu"
                className={`${isPhoneMode ? 'px-2 py-1.5 text-[11px]' : 'px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs'} rust-surface border-[#38bdf8]/45 hover:border-[#38bdf8] font-bold uppercase tracking-wider text-[#7dd3fc] cursor-pointer flex items-center gap-1`}
              >
                <Wrench size={14} />
                <span className="hidden sm:inline">{isPhoneMode ? 'Sandbox' : 'Sandbox [K]'}</span>
              </button>
            )}

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenSettings();
              }}
              aria-label="Open Settings"
              className="p-1.5 sm:p-2 rust-surface hover:border-[#4ade80] text-[#e5dfd3] cursor-pointer"
            >
              <Sliders size={14} />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
              className="p-1.5 sm:p-2 rust-surface hover:border-[#4ade80] text-[#e5dfd3] cursor-pointer"
            >
              {hud.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause game"
              className="p-1.5 sm:p-2 rust-surface hover:border-[#4ade80] text-[#e5dfd3] cursor-pointer"
            >
              <Pause size={14} />
            </button>
          </div>
        </div>

        {hud.notifications.length > 0 && (
          <div className="flex md:hidden flex-col items-center gap-1 mt-1.5 pointer-events-none">
            {hud.notifications.map((n) => (
              <div
                key={n.id}
                className={`px-2.5 py-0.5 text-[10px] font-semibold tracking-wide border text-center max-w-[90vw] ${
                  n.tone === 'danger'
                    ? 'bg-[#2a1212]/90 border-[#ef4444]/50 text-[#fecaca]'
                    : n.tone === 'warn'
                      ? 'bg-[#271d10]/90 border-[#f59e0b]/50 text-[#fde68a]'
                      : n.tone === 'gain'
                        ? 'bg-[#142014]/90 border-[#65a30d]/50 text-[#d9f99d]'
                        : 'bg-[#16181d]/90 border-white/15 text-[#e5dfd3]'
                }`}
              >
                {n.text}
              </div>
            ))}
          </div>
        )}

        {/* Center Reticle + Interact Prompt */}
        {!modalsOpen && (
          <div className="crosshair-anchor">
            {!hud.sniperScoped && (
              <div className="crosshair-ring">
                <div className="crosshair-dot" />
                <div className="crosshair-tick top" />
                <div className="crosshair-tick bottom" />
                <div className="crosshair-tick left" />
                <div className="crosshair-tick right" />

                <svg
                  viewBox="0 0 24 24"
                  className={`hitmarker ${hud.hitmarkerActive ? 'active' : ''}`}
                  aria-hidden="true"
                >
                  <path
                    d="M4 4L9 9M20 4L15 9M4 20L9 15M20 20L15 15"
                    stroke={hud.hitmarkerCrit ? '#ef4444' : '#ffffff'}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}

            {hud.interactPrompt &&
              (isPhoneMode ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onTouchInteract}
                  className="mt-4 px-3 py-1 rust-surface border-[#4ade80]/60 text-xs font-semibold text-[#86efac] whitespace-nowrap hud-interactive cursor-pointer"
                >
                  {hud.interactPrompt}
                </button>
              ) : (
                <div className="mt-4 px-3 py-1 rust-surface text-xs font-semibold text-[#f3efe6] whitespace-nowrap">
                  {hud.interactPrompt}
                </div>
              ))}

            {hud.fishingState !== 'idle' && (
              <div
                className={`mt-2 px-3 py-1 text-xs font-bold uppercase tracking-wider border ${
                  hud.fishingState === 'bite'
                    ? 'bg-[#142719]/95 border-[#4ade80] text-[#86efac]'
                    : 'bg-[#0c2233]/90 border-[#38bdf8]/50 text-[#7dd3fc]'
                }`}
              >
                {hud.fishingState === 'bite'
                  ? isPhoneMode
                    ? 'BITE! Tap Action to Reel In'
                    : 'BITE! [LMB] Reel In'
                  : 'Line Cast — Waiting for Bite...'}
              </div>
            )}

            {activeSlot?.itemId === 'building_plan' && (
              <div
                className={`mt-2 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                  hud.buildPreviewValid
                    ? 'bg-[#0c2738]/90 border-[#38bdf8]/50 text-[#7dd3fc]'
                    : 'bg-[#2c1212]/90 border-[#ef4444]/50 text-[#fca5a5]'
                }`}
              >
                {hud.buildPreviewReason}
              </div>
            )}
          </div>
        )}

        {/* Bottom Row */}
        <div
          className={`flex items-end gap-3 ${
            isPhoneMode ? 'justify-center' : 'flex-col md:flex-row justify-between'
          }`}
        >
          {/* Bottom-Left: Mode Badge + Health / Hunger / Stamina / Armor + Resources (PC Mode) */}
          {!isPhoneMode && (
            <div className="w-full max-w-[270px] flex flex-col gap-2">
            <div className="rust-surface p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider">
                <span className={modeTextColor(modeInfo.tier)}>{modeInfo.label}</span>
                {modeInfo.challengeBadge && (
                  <span className="text-[#9ca3af]">{modeInfo.challengeBadge}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Heart size={14} className="text-[#84cc16] shrink-0" />
                <div className={`vital-bar-track flex-1 ${hpPatternClass}`} data-testid="hp-bar-track">
                  <div
                    className="vital-bar-ghost bg-[#dc2626]"
                    style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
                  />
                  <div
                    className="vital-bar-fill bg-[#65a30d]"
                    style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
                  />
                  {modeInfo.hpPatternTier !== 'none' && <div className="hp-pattern-overlay" />}
                </div>
                <span className="w-8 text-right text-xs font-black tabular-nums text-[#f3efe6]">
                  {hud.health}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Flame size={14} className="text-[#f59e0b] shrink-0" />
                <div className="vital-bar-track flex-1">
                  <div
                    className="vital-bar-fill bg-[#d97706]"
                    style={{ width: `${(hud.hunger / hud.maxHunger) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-black tabular-nums text-[#f3efe6]">
                  {hud.hunger}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#38bdf8] shrink-0" />
                <div className="vital-bar-track flex-1">
                  <div
                    className="vital-bar-fill bg-[#0284c7]"
                    style={{ width: `${(hud.stamina / hud.maxStamina) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-black tabular-nums text-[#f3efe6]">
                  {hud.stamina}
                </span>
              </div>

              {(hud.inDeepWater || hud.breath < hud.maxBreath) && (
                <div className="flex items-center gap-2" data-testid="breath-bar">
                  <Waves size={14} className="text-[#67e8f9] shrink-0" />
                  <div className="vital-bar-track flex-1">
                    <div
                      className={`vital-bar-fill ${hud.breath < 30 ? 'bg-[#ef4444]' : 'bg-[#06b6d4]'}`}
                      style={{ width: `${Math.max(0, Math.min(100, (hud.breath / hud.maxBreath) * 100))}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-black tabular-nums text-[#cffafe]">
                    {Math.ceil(hud.breath)}
                  </span>
                </div>
              )}

              {hud.armorDefensePct > 0 && (
                <div className="flex items-center justify-between pt-0.5 text-[11px] font-bold text-[#93c5fd]">
                  <span className="flex items-center gap-1.5">
                    <Shield size={13} className="text-[#60a5fa]" />
                    Armor Mitigation
                  </span>
                  <span className="tabular-nums">{hud.armorDefensePct}%</span>
                </div>
              )}
            </div>

            <div className="rust-surface px-2.5 py-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums">
              <span className="flex items-center gap-1 text-[#e5dfd3]">
                <ItemIcon id="wood" size={13} />
                <b>{hud.resources.wood}</b>
              </span>
              <span className="flex items-center gap-1 text-[#e5dfd3]">
                <ItemIcon id="stone" size={13} />
                <b>{hud.resources.stone}</b>
              </span>
              <span className="flex items-center gap-1 text-[#e5dfd3]">
                <ItemIcon id="metal_frags" size={13} />
                <b>{hud.resources.metal_frags}</b>
              </span>
              <span className="flex items-center gap-1 text-[#e5dfd3]">
                <ItemIcon id="sulfur" size={13} />
                <b>{hud.resources.sulfur}</b>
              </span>
              <span className="flex items-center gap-1 text-[#86efac]">
                <ItemIcon id="sludge" size={13} />
                <b>{hud.resources.sludge}</b>
              </span>
              <span className="flex items-center gap-1 text-[#e5dfd3]">
                <ItemIcon id="cloth" size={13} />
                <b>{hud.resources.cloth}</b>
              </span>
              {arrowsCount > 0 && (
                <span className="flex items-center gap-1 text-[#fde68a]">
                  <ItemIcon id="arrow" size={13} />
                  <b>{arrowsCount}</b>
                </span>
              )}
              {ammoCount > 0 && (
                <span className="flex items-center gap-1 text-[#fca5a5]">
                  <ItemIcon id="ammo" size={13} />
                  <b>{ammoCount}</b>
                </span>
              )}
            </div>
          </div>
          )}

          {/* Bottom-Center: 6-Slot Hotbar */}
          <div className="flex flex-col items-center gap-1">
            {!isPhoneMode && (
              <div className="px-3 py-0.5 text-[11px] font-bold tracking-wider uppercase text-[#f3efe6] hud-text-shadow">
                {activeItem ? (
                  <>
                    {activeItem.name}{' '}
                    <span className="text-[#4ade80]">· {activeItem.hotkeyRole}</span>
                  </>
                ) : (
                  <>
                    {HAND_STATS.name}{' '}
                    <span className="text-[#4ade80]">· {HAND_STATS.hotkeyRole}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 sm:gap-1.5 hud-interactive">
              {hud.hotbar.map((slot, idx) => {
                const selected = idx === hud.selectedHotbarIndex;
                const itemDef = slot.itemId ? ITEMS[slot.itemId] : null;
                const maxDur = slot.maxDurability ?? itemDef?.maxDurability;
                const durPct =
                  maxDur && maxDur > 0 && slot.durability !== undefined
                    ? Math.max(0, Math.min(100, (slot.durability / maxDur) * 100))
                    : null;
                return (
                  <button
                    key={idx}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectHotbar(idx);
                    }}
                    aria-label={
                      slot.itemId
                        ? `Hotbar slot ${idx + 1}: ${ITEMS[slot.itemId].name}`
                        : `Hotbar slot ${idx + 1}: Empty`
                    }
                    className={`hotbar-slot cursor-pointer ${selected ? 'selected' : ''}`}
                  >
                    <span className={`absolute ${isPhoneMode ? 'top-0.5 left-1 text-[8px]' : 'top-1 left-1.5 text-[10px]'} font-bold tabular-nums text-[#9ca3af]`}>
                      {idx + 1}
                    </span>
                    {slot.itemId && <ItemIcon id={slot.itemId} size={isPhoneMode ? 22 : 32} />}
                    {slot.itemId && slot.count > 1 && (
                      <span className={`absolute ${isPhoneMode ? 'bottom-0.5 right-1 text-[9px]' : 'bottom-1 right-1.5 text-[11px]'} font-black tabular-nums text-[#f3efe6] hud-text-shadow`}>
                        {slot.count}
                      </span>
                    )}
                    {durPct !== null && (
                      <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-black/70 overflow-hidden">
                        <div
                          className={`h-full ${
                            durPct <= 25
                              ? 'bg-[#ef4444]'
                              : durPct <= 55
                                ? 'bg-[#f59e0b]'
                                : 'bg-[#4ade80]'
                          }`}
                          style={{ width: `${durPct}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom-Right Light/Bed/Drop/Pointer Indicator + Version */}
          {!isPhoneMode ? (
            <div className="flex flex-col items-end gap-1">
              <div className="hidden lg:flex flex-col items-end gap-0.5 rust-surface px-3 py-1.5 text-[11px] font-medium text-[#e5dfd3]">
                {hud.hasRegisteredBed && (
                  <span className="flex items-center gap-1 text-[#4ade80] font-bold">
                    <BedDouble size={12} />
                    Spawn Bed: Registered
                  </span>
                )}
                <span>Light [F]: {hud.torchOn ? 'ON' : 'OFF'} · Drop [X]</span>
                <span className="text-[#9ca3af]">
                  {hud.pointerLocked ? 'Mouse Locked · [Esc] Release' : 'Click Viewport to Lock Aim'}
                </span>
              </div>
              <div className="px-2 py-0.5 rust-surface text-[10px] font-mono font-bold text-[#9ca3af]">
                {versionLabel}
              </div>
            </div>
          ) : (
            <div className="fixed bottom-1 right-2 px-1.5 py-0.5 rust-surface text-[8px] font-mono font-bold text-[#9ca3af]">
              {versionLabel}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
