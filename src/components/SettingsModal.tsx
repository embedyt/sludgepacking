import React, { useState } from 'react';
import { Monitor, RotateCcw, Sliders, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { getVersionLabel } from '../game/rules';
import type { ActiveControlMode, ControlModeSetting, GameSettings } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  activeControlMode: ActiveControlMode;
  onUpdate: (partial: Partial<GameSettings>) => void;
  onResetDefaults: () => void;
  onOpenDeveloperMenu: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  activeControlMode,
  onUpdate,
  onResetDefaults,
  onOpenDeveloperMenu,
  onClose,
}) => {
  const [versionClicks, setVersionClicks] = useState(0);

  const handleVersionClick = () => {
    const next = versionClicks + 1;
    if (next >= 7) {
      setVersionClicks(0);
      onOpenDeveloperMenu();
    } else {
      setVersionClicks(next);
    }
  };

  return (
    <div
      className="hud-layer flex items-center justify-center bg-black/65 hud-interactive p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="rust-surface-solid w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders size={17} className="text-[#4ade80]" />
            <div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-[#4ade80]">
                Configuration
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-wide text-[#f3efe6]">
                GAME SETTINGS
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 sm:p-2 bg-[#20242a] hover:bg-[#2b3038] border border-white/15 text-[#e5dfd3] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex flex-col gap-4 sm:gap-5">
          {/* Audio */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
                Audio
              </span>
              <button
                type="button"
                onClick={() => onUpdate({ muted: !settings.muted })}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer flex items-center gap-1.5 ${
                  settings.muted
                    ? 'bg-[#2a1515] border-[#ef4444]/50 text-[#fca5a5]'
                    : 'bg-[#17251c] border-[#4ade80]/40 text-[#86efac]'
                }`}
              >
                {settings.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {settings.muted ? 'Muted' : 'Audio ON'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-[#e5dfd3]">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Master Volume</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.masterVolume}
                  onChange={(e) => onUpdate({ masterVolume: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#e5dfd3]">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Effects Volume</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVolume}
                  onChange={(e) => onUpdate({ sfxVolume: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#e5dfd3]">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Wind &amp; River</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">
                    {Math.round(settings.ambientVolume * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.ambientVolume}
                  onChange={(e) => onUpdate({ ambientVolume: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>
            </div>
          </section>

          {/* Controls & Camera */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
                Controls &amp; Camera
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#4ade80]">
                Active: {activeControlMode === 'phone' ? 'Phone (Touch)' : 'PC (Mouse & KB)'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[#9ca3af]">
                Control Mode
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'auto', label: 'Auto Detect' },
                    { id: 'pc', label: 'PC (Mouse)' },
                    { id: 'phone', label: 'Phone (Touch)' },
                  ] as { id: ControlModeSetting; label: string }[]
                ).map((opt) => {
                  const selected = settings.controlMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdate({ controlMode: opt.id })}
                      aria-pressed={selected}
                      className={`px-2 py-1.5 sm:px-2.5 sm:py-2 border text-[10px] sm:text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-1 transition-colors ${
                        selected
                          ? 'bg-[#17251c] border-[#4ade80] text-[#86efac]'
                          : 'bg-[#101215] hover:bg-[#1a1e24] border-white/15 text-[#9ca3af]'
                      }`}
                    >
                      {opt.id === 'pc' && <Monitor size={13} />}
                      {opt.id === 'phone' && <Smartphone size={13} />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#9ca3af]">
                {settings.controlMode === 'auto'
                  ? `Auto detects your device (${activeControlMode === 'phone' ? 'Phone Touch' : 'PC Mouse & Keyboard'} active).`
                  : settings.controlMode === 'phone'
                    ? 'On-screen virtual joystick, touch-drag look, and action buttons.'
                    : 'Pointer-lock mouse look and WASD keyboard controls.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-xs text-[#e5dfd3]">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>{activeControlMode === 'phone' ? 'Look Sensitivity' : 'Mouse Sensitivity'}</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">
                    {settings.mouseSensitivity.toFixed(2)}×
                  </span>
                </span>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.05}
                  value={settings.mouseSensitivity}
                  onChange={(e) => onUpdate({ mouseSensitivity: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#e5dfd3]">
                <span className="flex justify-between text-[11px] text-[#9ca3af]">
                  <span>Field of View (FOV)</span>
                  <span className="tabular-nums font-bold text-[#f3efe6]">
                    {Math.round(settings.fov)}°
                  </span>
                </span>
                <input
                  type="range"
                  min={60}
                  max={100}
                  step={2}
                  value={settings.fov}
                  onChange={(e) => onUpdate({ fov: Number(e.target.value) })}
                  className="sludge-range"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdate({ invertY: !settings.invertY })}
                className={`px-3 py-1.5 text-xs font-bold uppercase border cursor-pointer ${
                  settings.invertY
                    ? 'bg-[#241913] border-[#fb923c] text-[#fed7aa]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                Invert Y-Axis: {settings.invertY ? 'ON' : 'OFF'}
              </button>
            </div>
          </section>

          {/* Display & HUD */}
          <section className="flex flex-col gap-3">
            <div className="border-b border-white/10 pb-1.5 text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Display &amp; Interface
            </div>

            <label className="flex flex-col gap-1 text-xs text-[#e5dfd3]">
              <span className="flex justify-between text-[11px] text-[#9ca3af]">
                <span>Brightness / Exposure</span>
                <span className="tabular-nums font-bold text-[#f3efe6]">
                  {Math.round(settings.brightness * 100)}%
                </span>
              </span>
              <input
                type="range"
                min={0.65}
                max={1.65}
                step={0.03}
                value={settings.brightness}
                onChange={(e) => onUpdate({ brightness: Number(e.target.value) })}
                className="sludge-range"
              />
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({ quality: settings.quality === 'high' ? 'low' : 'high' })
                }
                className="px-3 py-2 bg-[#101215] hover:bg-[#1a1e24] border border-white/15 text-xs font-bold uppercase text-[#e5dfd3] cursor-pointer"
              >
                Graphics: {settings.quality === 'high' ? 'High' : 'Low'}
              </button>

              <button
                type="button"
                onClick={() => onUpdate({ shadersEnabled: !settings.shadersEnabled })}
                className={`px-3 py-2 border text-xs font-bold uppercase cursor-pointer ${
                  settings.shadersEnabled
                    ? 'bg-[#17251c] border-[#4ade80]/50 text-[#86efac]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                Shaders: {settings.shadersEnabled ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={() => onUpdate({ showFps: !settings.showFps })}
                className={`px-3 py-2 border text-xs font-bold uppercase cursor-pointer ${
                  settings.showFps
                    ? 'bg-[#17251c] border-[#4ade80]/50 text-[#86efac]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                FPS: {settings.showFps ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={() => onUpdate({ compactPopups: !settings.compactPopups })}
                className={`px-3 py-2 border text-xs font-bold uppercase cursor-pointer ${
                  settings.compactPopups
                    ? 'bg-[#17251c] border-[#4ade80]/50 text-[#86efac]'
                    : 'bg-[#101215] border-white/15 text-[#9ca3af]'
                }`}
              >
                Popups: {settings.compactPopups ? 'Minimal' : 'Standard'}
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3.5 bg-[#0f1114] border-t border-white/10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onResetDefaults}
            className="px-3 py-2 bg-[#1a1e24] hover:bg-[#242a33] border border-white/15 text-xs font-bold uppercase tracking-wider text-[#e5dfd3] cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>

          {/* Silent 7-click version label */}
          <button
            type="button"
            onClick={handleVersionClick}
            className="px-2 py-1 text-xs font-mono text-[#9ca3af] hover:text-[#e5dfd3] bg-transparent border-0 cursor-pointer"
          >
            {getVersionLabel(activeControlMode)}
          </button>
        </div>
      </div>
    </div>
  );
};
