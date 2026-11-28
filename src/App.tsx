import { useCallback, useEffect, useRef, useState } from 'react';
import { ChestModal } from './components/ChestModal';
import { CraftingModal } from './components/CraftingModal';
import { DeveloperModal } from './components/DeveloperModal';
import { HudOverlay } from './components/HudOverlay';
import { RadialBuildMenu } from './components/RadialBuildMenu';
import { SandboxModal } from './components/SandboxModal';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal, PauseModal } from './components/StatusModals';
import { TitleScreen } from './components/TitleScreen';
import { GameEngine } from './game/Engine';
import { RECIPES } from './game/gameData';
import { DEFAULT_GAME_SETTINGS } from './game/Persistence';
import { mountRainmarkLoader } from './game/RainmarkLoader';
import {
  createInitialArmor,
  createInitialBackpack,
  createInitialHotbar,
  createInitialResources,
} from './game/rules';
import type { HudSnapshot } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  currentWorld: null,
  savedWorlds: [],
  hasSavedGame: false,
  savedDayCount: 1,
  pointerLocked: false,
  inCave: false,
  caveName: null,
  undergroundDepth: 0,
  inWater: false,
  inDeepWater: false,
  breath: 100,
  maxBreath: 100,
  fishingState: 'idle',
  speedBoostActive: false,
  sniperScoped: false,
  health: 100,
  maxHealth: 100,
  hunger: 100,
  maxHunger: 100,
  stamina: 100,
  maxStamina: 100,
  armor: createInitialArmor(),
  armorDurability: {},
  armorDefensePct: 0,
  timeOfDay: 0.4,
  dayCount: 1,
  nightsSurvived: 0,
  playTimeSec: 0,
  isNight: false,
  nightType: 'overcast',
  fps: 60,
  quality: 'high',
  shadersEnabled: true,
  muted: false,
  settings: { ...DEFAULT_GAME_SETTINGS },
  activeControlMode: 'pc',
  torchOn: false,
  aiming: false,
  selectedHotbarIndex: 0,
  hotbar: createInitialHotbar(),
  backpack: createInitialBackpack(),
  resources: createInitialResources(),
  selectedBuildPiece: 'foundation',
  buildPreviewValid: false,
  buildPreviewReason: 'Ready',
  hasRegisteredBed: false,
  interactPrompt: null,
  hitmarkerActive: false,
  hitmarkerCrit: false,
  craftingOpen: false,
  radialMenuOpen: false,
  activeChestId: null,
  activeChestSlots: null,
  sandboxUnlocked: false,
  maxNightsSurvived: 0,
  sandboxMenuOpen: false,
  sandbox: {
    flyMode: false,
    godMode: false,
    freeBuild: true,
    freezeTime: false,
    speedMult: 1.0,
    jumpMult: 1.0,
    timeScale: 1.0,
  },
  raidersAlive: 0,
  wildlifeAlive: 0,
  kills: 0,
  piecesBuilt: 0,
  nodesGathered: 0,
  notifications: [],
  gameOverStats: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const autoStart = params?.get('autostart') === '1';
    const skipIntro = params?.get('skipintro') === '1';

    let disposed = false;
    let engine: GameEngine | null = null;

    const cancelLoader = mountRainmarkLoader({
      skipIntro,
      loadTask: async (setProgressText) => {
        setProgressText('Initializing Engine');
        await new Promise((resolve) => window.setTimeout(resolve, 24));
        if (disposed) return;

        engine = new GameEngine(mount, (snapshot) => {
          setHud(snapshot);
        });
        engineRef.current = engine;

        await engine.warmUpForLoader(setProgressText);
        if (disposed) return;

        if (autoStart) {
          engine.continueLatestWorld(false);
        }
      },
    });

    return () => {
      disposed = true;
      cancelLoader();
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!devMenuOpen && !settingsOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        if (devMenuOpen) setDevMenuOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [devMenuOpen, settingsOpen]);

  const handleTouchMove = useCallback((x: number, y: number) => engineRef.current?.setTouchMove(x, y), []);
  const handleTouchSprint = useCallback((s: boolean) => engineRef.current?.setTouchSprint(s), []);
  const handleTouchLookDelta = useCallback(
    (dx: number, dy: number) => engineRef.current?.addTouchLookDelta(dx, dy),
    [],
  );
  const handleTouchActionHeld = useCallback(
    (held: boolean) => engineRef.current?.setTouchActionHeld(held),
    [],
  );
  const handleTouchJump = useCallback(() => engineRef.current?.triggerTouchJump(), []);
  const handleTouchFlyVert = useCallback(
    (dir: -1 | 0 | 1) => engineRef.current?.setTouchFlyVert(dir),
    [],
  );
  const handleTouchInteract = useCallback(() => engineRef.current?.triggerTouchInteract(), []);
  const handleToggleAim = useCallback(() => engineRef.current?.toggleTouchAim(), []);
  const handleTouchSecondary = useCallback(() => engineRef.current?.triggerTouchSecondary(), []);
  const handleToggleTorch = useCallback(() => engineRef.current?.toggleTorch(), []);
  const handleDropActive = useCallback(() => engineRef.current?.dropActiveSlot(), []);

  const isPermadeath = Boolean(hud.currentWorld?.challenges.includes('permadeath'));
  const inWorld = hud.phase === 'playing' || hud.phase === 'paused';

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* Isolated WebGL mount container so HUD updates never recreate the renderer */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-mount"
        className="webgl-mount"
      />

      {hud.phase === 'title' && (
        <TitleScreen
          quality={hud.quality}
          shadersEnabled={hud.shadersEnabled}
          muted={hud.muted}
          activeControlMode={hud.activeControlMode}
          savedWorlds={hud.savedWorlds}
          sandboxUnlocked={hud.sandboxUnlocked}
          maxNightsSurvived={hud.maxNightsSurvived}
          onCreateWorld={(params) => engineRef.current?.createNewWorld(params, true)}
          onLoadWorld={(worldId) => engineRef.current?.loadSavedWorld(worldId, true)}
          onDeleteWorld={(worldId) => engineRef.current?.deleteSavedWorld(worldId)}
          onToggleQuality={() => engineRef.current?.toggleQuality()}
          onToggleShaders={() => engineRef.current?.toggleShaders()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {hud.phase === 'playing' && (
        <HudOverlay
          hud={hud}
          onSelectHotbar={(idx) => engineRef.current?.selectHotbar(idx)}
          onToggleCrafting={() => engineRef.current?.toggleCrafting(true)}
          onToggleRadial={() => engineRef.current?.toggleRadialMenu(true)}
          onToggleSandbox={() => engineRef.current?.toggleSandboxMenu(true)}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onOpenSettings={() => {
            engineRef.current?.pauseGame();
            setSettingsOpen(true);
          }}
          onPause={() => engineRef.current?.pauseGame()}
          onTouchMove={handleTouchMove}
          onTouchSprint={handleTouchSprint}
          onTouchLookDelta={handleTouchLookDelta}
          onTouchActionHeld={handleTouchActionHeld}
          onTouchJump={handleTouchJump}
          onTouchFlyVert={handleTouchFlyVert}
          onTouchInteract={handleTouchInteract}
          onToggleAim={handleToggleAim}
          onTouchSecondary={handleTouchSecondary}
          onToggleTorch={handleToggleTorch}
          onDropActive={handleDropActive}
        />
      )}

      {hud.phase === 'playing' && hud.craftingOpen && (
        <CraftingModal
          hud={hud}
          onCraft={(id) => engineRef.current?.tryCraft(id, RECIPES)}
          onMoveSlot={(from, to) => engineRef.current?.moveSlot(from, to)}
          onQuickMoveSlot={(ref) => engineRef.current?.quickMoveSlot(ref)}
          onUseSlot={(ref) => engineRef.current?.useInventorySlot(ref)}
          onDropSlot={(ref, all) => engineRef.current?.dropSlot(ref, all)}
          onEquipArmor={(ref) => engineRef.current?.equipArmor(ref)}
          onUnequipArmor={(slot) => engineRef.current?.unequipArmor(slot)}
          onClose={() => engineRef.current?.closeMenus(true)}
        />
      )}

      {hud.phase === 'playing' && hud.radialMenuOpen && (
        <RadialBuildMenu
          selectedPiece={hud.selectedBuildPiece}
          woodCount={hud.resources.wood}
          onSelect={(piece) => engineRef.current?.selectBuildPiece(piece)}
          onClose={() => engineRef.current?.closeMenus(true)}
        />
      )}

      {hud.phase === 'playing' && hud.activeChestId && hud.activeChestSlots && (
        <ChestModal
          hud={hud}
          onMoveSlot={(from, to) => engineRef.current?.moveChestSlot(from, to)}
          onQuickTransfer={(from) => engineRef.current?.quickTransferChest(from)}
          onTransferAll={(dir) => engineRef.current?.transferAllChest(dir)}
          onClose={() => engineRef.current?.closeMenus(true)}
        />
      )}

      {hud.phase === 'playing' && hud.sandboxMenuOpen && hud.currentWorld?.sandbox && (
        <SandboxModal
          hud={hud}
          onUpdateSandbox={(partial) => engineRef.current?.updateSandbox(partial)}
          onSetTimeOfDay={(t) => engineRef.current?.sandboxSetTimeOfDay(t)}
          onSpawnEntity={(kind) => engineRef.current?.sandboxSpawnEntity(kind)}
          onGiveItem={(itemId, count) => engineRef.current?.sandboxGiveItem(itemId, count)}
          onClearEnemies={() => engineRef.current?.sandboxClearEnemies()}
          onClose={() => engineRef.current?.closeMenus(true)}
        />
      )}

      {hud.phase === 'paused' && !settingsOpen && !devMenuOpen && (
        <PauseModal
          quality={hud.quality}
          shadersEnabled={hud.shadersEnabled}
          muted={hud.muted}
          activeControlMode={hud.activeControlMode}
          currentWorld={hud.currentWorld}
          dayCount={hud.dayCount}
          nightsSurvived={hud.nightsSurvived}
          playTimeSec={hud.playTimeSec}
          kills={hud.kills}
          piecesBuilt={hud.piecesBuilt}
          onToggleQuality={() => engineRef.current?.toggleQuality()}
          onToggleShaders={() => engineRef.current?.toggleShaders()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onOpenSettings={() => setSettingsOpen(true)}
          onResume={() => engineRef.current?.resumeGame()}
          onTitle={() => {
            setSettingsOpen(false);
            setDevMenuOpen(false);
            engineRef.current?.returnToTitle();
          }}
        />
      )}

      {hud.phase === 'gameover' && hud.gameOverStats && (
        <GameOverModal
          stats={hud.gameOverStats}
          isPermadeath={isPermadeath}
          onRestart={() => engineRef.current?.respawnInCurrentWorld(true)}
          onTitle={() => engineRef.current?.returnToTitle()}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={hud.settings}
          activeControlMode={hud.activeControlMode}
          onUpdate={(partial) => engineRef.current?.updateSettings(partial)}
          onResetDefaults={() => engineRef.current?.resetSettingsToDefaults()}
          onOpenDeveloperMenu={() => {
            setSettingsOpen(false);
            setDevMenuOpen(true);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {devMenuOpen && (
        <DeveloperModal
          inWorld={inWorld}
          sandboxUnlocked={hud.sandboxUnlocked}
          onToggleSandboxUnlock={() => engineRef.current?.devToggleSandboxUnlock()}
          onGiveDevKit={() => engineRef.current?.devGiveKit()}
          onAdvanceDay={() => engineRef.current?.devAdvanceDay()}
          onSetNightfall={() => engineRef.current?.devSetNightfall()}
          onRefillVitals={() => engineRef.current?.devRefillVitals()}
          onClearEnemies={() => engineRef.current?.devClearEnemies()}
          onTeleport={(dest) => engineRef.current?.devTeleport(dest)}
          onResetAllData={() => engineRef.current?.devResetAllData()}
          onClose={() => setDevMenuOpen(false)}
        />
      )}
    </main>
  );
}
