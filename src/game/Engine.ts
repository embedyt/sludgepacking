import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BuildingSystem } from './BuildingSystem';
import { CombatAndAI, type EnemyKind } from './CombatAndAI';
import {
  DAY_CYCLE_SECONDS,
  DIFFICULTY_PROFILES,
  HAND_STATS,
  ITEMS,
  SANDBOX_REQUIRED_NIGHTS,
} from './gameData';
import {
  DEFAULT_GAME_SETTINGS,
  deleteWorldFromStorage,
  listSavedWorlds,
  loadMetaProgress,
  loadStoredSettings,
  loadWorldFromStorage,
  recordNightCompletedMeta,
  recordNightSurvivedMeta,
  resetAllSavedData,
  saveMetaProgress,
  saveStoredSettings,
  saveWorldToStorage,
} from './Persistence';
import {
  PLACED_BARREL_EXPLODE_THRESHOLD,
  WORLD_BARREL_EXPLODE_THRESHOLD,
  addItemToInventory,
  applyArmorMitigation,
  applyBarrelShotDamage,
  canHarvestNodeWithTool,
  canUpgradePiece,
  collectDeathDrops,
  computeFallDamage,
  computeHeadshotDamage,
  consumeItem,
  consumeOneFromSlot,
  craftRecipe,
  createInitialArmor,
  createInitialArmorDurability,
  createInitialBackpack,
  createInitialHotbar,
  createInitialResources,
  damageEquippedArmor,
  damageInventorySlot,
  dropSlotItem,
  equipArmorFromSlot,
  findBestLightSource,
  generateRandomSeedCode,
  getActorHeadSphere,
  getArmorDefense,
  getItemCount,
  getWorldBoxFloorHeightAt,
  isNightTime,
  isSegmentBlockedByWorldBoxes,
  lootDeathBackpack,
  moveBetweenContainers,
  moveOrSwapSlot,
  probeDeviceIsPhone,
  quickMoveSlotBetweenHotbarAndBackpack,
  quickTransferContainerSlot,
  resolveControlMode,
  resolveWorldBoxCollisions,
  rollFishingCatch,
  rollNightType,
  rollStructureLoot,
  stepSwimBreath,
  testSegmentCylinderHit,
  unequipArmorSlot,
  type ContainerSlotRef,
  type SlotRef,
} from './rules';
import { ShaderPipeline } from './ShaderPipeline';
import { SoundSynth } from './SoundSynth';
import { createProceduralTextures, type ProceduralTextureSet } from './Textures';
import {
  RIVER_WATER_Y,
  generateWorld,
  riverCenterAtZ,
  riverHalfWidthAtZ,
  type WorldData,
  type WorldNode,
} from './WorldGenerator';
import type {
  ActiveControlMode,
  ArmorSlotType,
  BuildPieceType,
  ChallengeId,
  DifficultyLevel,
  EquippedArmor,
  EquippedArmorDurability,
  EquippedVisualId,
  FishingState,
  GamePhase,
  GameSettings,
  GameStatsSnapshot,
  HudNotification,
  HudSnapshot,
  InventorySlot,
  ItemId,
  MetaProgress,
  NightType,
  QualityPreset,
  ResourceBag,
  SandboxState,
  SaveGameData,
  WorldConfig,
  WorldSummary,
} from '../types/game';

const PLAYER_EYE_HEIGHT = 1.68;
const PLAYER_RADIUS = 0.42;

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export interface CreateWorldParams {
  name: string;
  seed: string;
  difficulty: DifficultyLevel;
  challenges: ChallengeId[];
  sandbox?: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet;
  private shaders: ShaderPipeline;
  private world: WorldData;
  private building: BuildingSystem;
  private combat: CombatAndAI;
  public readonly sound = new SoundSynth();

  // Lighting Rig
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private flashlight: THREE.SpotLight;
  private torchLight: THREE.PointLight;
  private fog: THREE.FogExp2;
  private skyColor = new THREE.Color(0x88b4d8);
  private sunDir = new THREE.Vector3(0.4, 0.7, 0.3).normalize();

  // Simulation Loop
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = performance.now();
  private elapsed = 0;
  private fpsFrames = 0;
  private fpsWindowStartMs = performance.now();
  private currentFps = 60;
  private lastHudPushTime = 0;
  private autoSaveTimer = 0;

  // Game & World State
  private phase: GamePhase = 'title';
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  private metaProgress: MetaProgress = {
    maxNightsSurvived: 0,
    totalNightsSurvived: 0,
    sandboxUnlocked: false,
  };
  private quality: QualityPreset = 'high';
  private shadersEnabled = true;
  private pointerLocked = false;
  private craftingOpen = false;
  private radialMenuOpen = false;
  private activeChestId: string | null = null;
  private sandboxMenuOpen = false;
  private sandbox: SandboxState = {
    flyMode: false,
    godMode: false,
    freeBuild: true,
    freezeTime: false,
    speedMult: 1.0,
    jumpMult: 1.0,
    timeScale: 1.0,
  };
  private currentWorld: WorldConfig | null = null;
  private savedWorlds: WorldSummary[] = [];
  private hasSavedGame = false;
  private savedDayCount = 1;

  // Player Physics & Vitals
  private playerPos = new THREE.Vector3(0, 4.1, 14);
  private playerVelY = 0;
  private yaw = 0;
  private pitch = -0.04;
  private grounded = true;
  private airPeakFootY = 2.4;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private walkDistance = 0;
  private nextStepDistance = 2.0;

  private health = 100;
  private maxHealth = 100;
  private hunger = 100;
  private maxHunger = 100;
  private stamina = 100;
  private maxStamina = 100;
  private breath = 100;
  private maxBreath = 100;
  private speedBoostTimer = 0;
  private torchOn = false;
  private lightDrainAccum = 0;
  private aiming = false;
  private activeCaveName: string | null = null;
  private undergroundDepth = 0;
  private inWater = false;
  private inDeepWater = false;

  // Fishing State
  private fishingState: FishingState = 'idle';
  private fishingTimer = 0;
  private fishingBobberPos: THREE.Vector3 | null = null;

  // Juice & Timing
  private hitstopTimer = 0;
  private trauma = 0;
  private actionCooldown = 0;
  private hitmarkerTimer = 0;
  private hitmarkerCrit = false;
  private dayTime = 0.4;
  private dayCount = 1;
  private nightsSurvived = 0;
  private nightType: NightType = 'overcast';
  private playTimeSec = 0;
  private prevNight = false;

  // Inventory, Armor & Stats
  private armor: EquippedArmor = createInitialArmor();
  private armorDurability: EquippedArmorDurability = createInitialArmorDurability();
  private hotbar: InventorySlot[] = createInitialHotbar();
  private backpack: InventorySlot[] = createInitialBackpack();
  private resources: ResourceBag = createInitialResources();
  private selectedHotbarIndex = 0;
  private selectedBuildPiece: BuildPieceType = 'foundation';
  private buildRotSteps = 0;
  private registeredBedId: string | null = null;
  private openedLootIds = new Set<string>();
  private kills = 0;
  private piecesBuilt = 0;
  private nodesGathered = 0;
  private gameOverStats: GameStatsSnapshot | null = null;
  private notifications: Array<HudNotification & { coalesceKey?: string }> = [];
  private notifSeq = 1;
  private interactPrompt: string | null = null;

  // Input Tracking
  private keysHeld = new Set<string>();
  private mouseLeftHeld = false;
  private mouseRightHeld = false;
  private mouseLeftJustPressed = false;
  private mouseRightJustPressed = false;
  private interactJustPressed = false;
  private isPhoneDevice = probeDeviceIsPhone();
  private activeControlMode: ActiveControlMode = 'pc';
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchSprint = false;
  private touchActionHeld = false;
  private touchActionJustPressed = false;
  private touchAltJustPressed = false;
  private touchAiming = false;
  private touchFlyVert: -1 | 0 | 1 = 0;
  private raycaster = new THREE.Raycaster();
  private _scratchVec = new THREE.Vector3();
  private _scratchForward = new THREE.Vector3();
  private _scratchRight = new THREE.Vector3();

  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();

    const storedSettings = loadStoredSettings();
    this.settings = { ...storedSettings };
    this.activeControlMode = resolveControlMode(this.settings.controlMode, this.isPhoneDevice);
    this.quality = storedSettings.quality;
    this.shadersEnabled = storedSettings.shadersEnabled;
    this.sound.setMuted(storedSettings.muted);
    this.sound.setVolumes(
      storedSettings.masterVolume,
      storedSettings.sfxVolume,
      storedSettings.ambientVolume,
    );
    this.metaProgress = loadMetaProgress();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.settings.brightness;
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : this.quality === 'high'
          ? Math.min(window.devicePixelRatio, 2)
          : 1,
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.skyColor;
    this.fog = new THREE.FogExp2(this.skyColor.getHex(), 0.0085);
    this.scene.fog = this.fog;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, w / h, 0.1, 320);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.hemiLight = new THREE.HemisphereLight(0x9fd0f5, 0x453d2e, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sunLight.position.set(35, 55, 25);
    this.sunLight.castShadow = !this.isSoftwareGl && this.quality === 'high';
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 150;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.flashlight = new THREE.SpotLight(0xfff3db, 0, 48, Math.PI / 4.6, 0.42, 1.25);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -10);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    this.torchLight = new THREE.PointLight(0xff8c2b, 0, 20, 1.35);
    this.torchLight.position.set(0.35, -0.15, -0.5);
    this.camera.add(this.torchLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    this.shaders = new ShaderPipeline(
      this.renderer,
      this.scene,
      this.camera,
      this.isSoftwareGl,
      this.shadersEnabled,
    );

    this.refreshSavePresence();
    const initialSeed = this.savedWorlds[0]?.seed ?? 'SLUDGE-42019';
    this.world = generateWorld(this.textures, this.isSoftwareGl, initialSeed);
    this.scene.add(this.world.root);
    this.shaders.attachWaterMesh(this.world.waterMesh);

    this.building = new BuildingSystem(this.textures);
    this.scene.add(this.building.root);

    this.combat = new CombatAndAI(this.textures);
    this.scene.add(this.combat.worldRoot);
    this.camera.add(this.combat.viewmodelRoot);
    this.combat.seedInitialWildlife(this.world.groundHeightAt, this.world.caveSites);

    const sy = this.world.groundHeightAt(0, 14);
    this.playerPos.set(0, sy + PLAYER_EYE_HEIGHT, 14);
    this.airPeakFootY = sy;
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.combat.viewmodelRoot.visible = false;

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    document.body.dataset.state = 'title';
    this.pushHudSnapshot(true);

    this.lastTimeMs = performance.now();
    this.fpsWindowStartMs = this.lastTimeMs;
    this.loop();
  }

  public async warmUpForLoader(onProgress: (text: string) => void): Promise<void> {
    const yieldFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    onProgress('Synthesizing island terrain');
    await yieldFrame();
    if (this.disposed) return;

    onProgress('Carving underground caves');
    await yieldFrame();
    if (this.disposed) return;

    onProgress('Compiling atmospheric shaders');
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.shaders.render();
    await yieldFrame();
  }

  private refreshSavePresence(): void {
    this.savedWorlds = listSavedWorlds();
    this.hasSavedGame = this.savedWorlds.length > 0;
    this.savedDayCount = this.savedWorlds[0]?.dayCount ?? 1;
    this.metaProgress = loadMetaProgress();
  }

  private persistSettings(): void {
    this.settings = {
      ...this.settings,
      quality: this.quality,
      shadersEnabled: this.shadersEnabled,
      muted: this.sound.isMuted(),
    };
    saveStoredSettings(this.settings);
  }

  public updateSettings(partial: Partial<GameSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    if (partial.quality !== undefined) {
      this.quality = partial.quality;
      if (!this.isSoftwareGl) {
        this.renderer.setPixelRatio(
          partial.quality === 'high' ? Math.min(window.devicePixelRatio, 2) : 1,
        );
        this.renderer.shadowMap.enabled = partial.quality === 'high';
        this.sunLight.castShadow = partial.quality === 'high';
      }
      this.fog.density = partial.quality === 'high' ? 0.0085 : 0.013;
    }
    if (partial.shadersEnabled !== undefined) {
      this.shadersEnabled = partial.shadersEnabled;
      this.shaders.setEnabled(partial.shadersEnabled);
    }
    if (partial.muted !== undefined) {
      this.sound.setMuted(partial.muted);
    }
    this.sound.setVolumes(
      this.settings.masterVolume,
      this.settings.sfxVolume,
      this.settings.ambientVolume,
    );
    this.renderer.toneMappingExposure = this.settings.brightness;
    this.isPhoneDevice = probeDeviceIsPhone();
    const prevMode = this.activeControlMode;
    this.activeControlMode = resolveControlMode(this.settings.controlMode, this.isPhoneDevice);
    if (prevMode !== this.activeControlMode) {
      this.clearInputs();
      if (this.activeControlMode === 'phone') {
        document.exitPointerLock?.();
      }
    }
    this.persistSettings();
    this.pushHudSnapshot(true);
  }

  public resetSettingsToDefaults(): void {
    this.updateSettings({ ...DEFAULT_GAME_SETTINGS });
    this.sound.playUiClick();
  }

  private hasChallenge(id: ChallengeId): boolean {
    return Boolean(this.currentWorld?.challenges.includes(id));
  }

  private getDifficultyProfile() {
    return DIFFICULTY_PROFILES[this.currentWorld?.difficulty ?? 'standard'];
  }

  private isSandboxWorld(): boolean {
    return Boolean(this.currentWorld?.sandbox);
  }

  private isModalsOpen(): boolean {
    return (
      this.craftingOpen ||
      this.radialMenuOpen ||
      this.activeChestId !== null ||
      this.sandboxMenuOpen
    );
  }

  private rebuildWorldForSeed(seed: string): void {
    if (this.world.seedString === seed) return;
    this.scene.remove(this.world.root);
    this.world.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        m.geometry.dispose();
      }
    });
    this.world = generateWorld(this.textures, this.isSoftwareGl, seed);
    this.scene.add(this.world.root);
    this.shaders.attachWaterMesh(this.world.waterMesh);
  }

  public saveProgress(): void {
    if ((this.phase !== 'playing' && this.phase !== 'paused') || !this.currentWorld) return;
    const payload: SaveGameData = {
      version: 3,
      savedAt: Date.now(),
      world: { ...this.currentWorld, challenges: [...this.currentWorld.challenges] },
      player: {
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        hunger: this.hunger,
        stamina: this.stamina,
        torchOn: this.torchOn,
      },
      progress: {
        dayTime: this.dayTime,
        dayCount: this.dayCount,
        nightsSurvived: this.nightsSurvived,
        playTimeSec: Math.floor(this.playTimeSec),
        kills: this.kills,
        piecesBuilt: this.piecesBuilt,
        nodesGathered: this.nodesGathered,
      },
      armor: { ...this.armor },
      armorDurability: { ...this.armorDurability },
      hotbar: this.hotbar.map((s) => ({ ...s })),
      backpack: this.backpack.map((s) => ({ ...s })),
      selectedHotbarIndex: this.selectedHotbarIndex,
      resources: { ...this.resources },
      pieces: this.building.pieces.map((p) => ({ ...p })),
      props: this.building.exportProps(),
      chests: this.building.exportChests(),
      openedLootIds: [...this.openedLootIds],
      registeredBedId: this.registeredBedId,
      droppedItems: this.combat.exportDroppedItems(),
      deathBackpacks: this.combat.exportDeathBackpacks(),
      sandbox: this.isSandboxWorld() ? { ...this.sandbox } : undefined,
    };
    if (saveWorldToStorage(payload)) {
      this.refreshSavePresence();
    }
  }

  public createNewWorld(params: CreateWorldParams, fromGesture = true): void {
    if (fromGesture) {
      this.sound.unlock();
      this.sound.playUiClick();
      this.sound.setActive(true);
    }

    const cleanName = params.name.trim() || `Island ${this.savedWorlds.length + 1}`;
    const cleanSeed = params.seed.trim() || generateRandomSeedCode();
    const allowSandbox = Boolean(params.sandbox && this.metaProgress.sandboxUnlocked);

    this.currentWorld = {
      id: `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      seed: cleanSeed,
      difficulty: params.difficulty,
      challenges: allowSandbox ? [] : [...params.challenges],
      sandbox: allowSandbox,
      createdAt: Date.now(),
    };

    this.rebuildWorldForSeed(cleanSeed);
    this.resetRunState(true);
    if (allowSandbox) {
      this.sandbox = {
        flyMode: false,
        godMode: false,
        freeBuild: true,
        freezeTime: false,
        speedMult: 1.0,
        jumpMult: 1.0,
        timeScale: 1.0,
      };
    }
    this.phase = 'playing';
    document.body.dataset.state = 'playing';
    this.combat.viewmodelRoot.visible = true;
    this.saveProgress();
    this.notify(
      allowSandbox ? `${cleanName} · Sandbox Mode [K]` : `${cleanName} · Ready`,
      'info',
    );
    this.pushHudSnapshot(true);

    if (fromGesture) {
      this.requestPointerLockSafe();
    }
  }

  public loadSavedWorld(worldId: string, fromGesture = true): void {
    const save = loadWorldFromStorage(worldId);
    if (!save) {
      this.refreshSavePresence();
      this.pushHudSnapshot(true);
      return;
    }

    if (fromGesture) {
      this.sound.unlock();
      this.sound.playUiClick();
      this.sound.setActive(true);
    }

    this.currentWorld = {
      ...save.world,
      challenges: [...(save.world.challenges ?? [])],
    };
    this.rebuildWorldForSeed(this.currentWorld.seed);
    this.resetRunState(false);

    if (save.sandbox) {
      this.sandbox = { ...this.sandbox, ...save.sandbox };
    }

    this.playerPos.set(save.player.x, save.player.y, save.player.z);
    this.airPeakFootY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    this.yaw = save.player.yaw;
    this.pitch = save.player.pitch;
    this.health = THREE.MathUtils.clamp(save.player.health, 1, this.maxHealth);
    this.hunger = THREE.MathUtils.clamp(save.player.hunger, 0, this.maxHunger);
    this.stamina = THREE.MathUtils.clamp(save.player.stamina, 0, this.maxStamina);
    this.breath = this.maxBreath;
    this.torchOn = Boolean(save.player.torchOn);

    this.dayTime = save.progress.dayTime;
    this.dayCount = save.progress.dayCount;
    this.nightsSurvived = save.progress.nightsSurvived ?? Math.max(0, this.dayCount - 1);
    this.nightType = rollNightType(this.world.seedNum, this.dayCount).type;
    this.playTimeSec = save.progress.playTimeSec ?? 0;
    this.prevNight = isNightTime(this.dayTime);
    this.kills = save.progress.kills;
    this.piecesBuilt = save.progress.piecesBuilt;
    this.nodesGathered = save.progress.nodesGathered;

    this.armor = { ...createInitialArmor(), ...save.armor };
    this.armorDurability = { ...(save.armorDurability ?? {}) };

    const freshHotbar = createInitialHotbar();
    for (let i = 0; i < freshHotbar.length; i++) {
      const slot = save.hotbar[i];
      freshHotbar[i] = slot ? { ...slot } : { itemId: null, count: 0 };
    }
    this.hotbar = freshHotbar;

    const freshBackpack = createInitialBackpack();
    for (let i = 0; i < freshBackpack.length; i++) {
      const slot = save.backpack[i];
      freshBackpack[i] = slot ? { ...slot } : { itemId: null, count: 0 };
    }
    this.backpack = freshBackpack;
    this.selectedHotbarIndex = THREE.MathUtils.clamp(
      save.selectedHotbarIndex ?? 0,
      0,
      this.hotbar.length - 1,
    );

    this.resources = { ...createInitialResources(), ...save.resources };

    this.building.restoreFromSave(save.pieces || [], save.props || [], save.chests);
    if (Array.isArray(save.openedLootIds)) {
      for (const lootId of save.openedLootIds) {
        this.openedLootIds.add(lootId);
        this.world.markLootOpened(lootId);
      }
    }
    if (save.registeredBedId && this.building.beds.some((b) => b.id === save.registeredBedId)) {
      this.registeredBedId = save.registeredBedId;
    } else if (this.building.beds.length > 0) {
      this.registeredBedId = this.building.beds[this.building.beds.length - 1].id;
    } else {
      this.registeredBedId = null;
    }
    this.combat.restoreDroppedItems(save.droppedItems || []);
    this.combat.restoreDeathBackpacks(save.deathBackpacks || []);

    this.phase = 'playing';
    document.body.dataset.state = 'playing';
    this.combat.viewmodelRoot.visible = true;
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.notify(`Loaded ${this.currentWorld.name} · Day ${this.dayCount}`, 'info');
    this.pushHudSnapshot(true);

    if (fromGesture) {
      this.requestPointerLockSafe();
    }
  }

  public deleteSavedWorld(worldId: string): void {
    this.sound.playUiClick();
    deleteWorldFromStorage(worldId);
    if (this.currentWorld?.id === worldId) {
      this.currentWorld = null;
    }
    this.refreshSavePresence();
    this.pushHudSnapshot(true);
  }

  public continueLatestWorld(fromGesture = true): void {
    this.refreshSavePresence();
    if (this.savedWorlds.length > 0) {
      this.loadSavedWorld(this.savedWorlds[0].id, fromGesture);
    } else {
      this.startQuickWorld(fromGesture);
    }
  }

  public startQuickWorld(fromGesture = true): void {
    this.createNewWorld(
      {
        name: `Island ${this.savedWorlds.length + 1}`,
        seed: generateRandomSeedCode(),
        difficulty: 'standard',
        challenges: [],
      },
      fromGesture,
    );
  }

  public respawnInCurrentWorld(fromGesture = true): void {
    if (!this.currentWorld || this.hasChallenge('permadeath')) {
      this.startQuickWorld(fromGesture);
      return;
    }
    if (fromGesture) {
      this.sound.unlock();
      this.sound.playUiClick();
      this.sound.setActive(true);
    }

    // Keep built structures & nodes, reset player kit & vitals at island spawn
    this.health = 100;
    this.hunger = 100;
    this.stamina = 100;
    this.breath = this.maxBreath;
    this.inDeepWater = false;
    this.speedBoostTimer = 0;
    this.torchOn = false;
    this.armor = createInitialArmor();
    this.armorDurability = createInitialArmorDurability();
    this.hotbar = createInitialHotbar();
    this.backpack = createInitialBackpack();
    this.resources = createInitialResources();
    this.selectedHotbarIndex = 0;
    this.gameOverStats = null;
    this.notifications = [];

    const activeBed =
      (this.registeredBedId
        ? this.building.beds.find((b) => b.id === this.registeredBedId)
        : undefined) ??
      (this.building.beds.length > 0
        ? this.building.beds[this.building.beds.length - 1]
        : undefined);

    if (activeBed) {
      this.registeredBedId = activeBed.id;
      this.playerPos.set(activeBed.x, activeBed.y + PLAYER_EYE_HEIGHT + 0.4, activeBed.z);
      this.yaw = activeBed.rotY;
    } else {
      const sy = this.world.groundHeightAt(0, 14);
      this.playerPos.set(0, sy + PLAYER_EYE_HEIGHT, 14);
      this.yaw = 0;
    }
    this.playerVelY = 0;
    this.pitch = -0.04;
    this.grounded = true;
    this.airPeakFootY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    this.combat.setEquippedItem(this.getEquippedVisual());

    this.phase = 'playing';
    document.body.dataset.state = 'playing';
    this.combat.viewmodelRoot.visible = true;
    this.saveProgress();
    this.notify(
      activeBed
        ? 'Respawned at your Registered Camp Bed!'
        : 'Respawned on shore — your structures remain!',
      'info',
    );
    this.pushHudSnapshot(true);
    if (fromGesture) {
      this.requestPointerLockSafe();
    }
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.sound.unlock();
    this.sound.setActive(true);
    this.phase = 'playing';
    document.body.dataset.state = 'playing';
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.pushHudSnapshot(true);
    this.requestPointerLockSafe();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.resetFishing();
    this.saveProgress();
    this.phase = 'paused';
    document.body.dataset.state = 'paused';
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.clearInputs();
    this.sound.setActive(false);
    document.exitPointerLock?.();
    this.pushHudSnapshot(true);
  }

  public returnToTitle(): void {
    this.resetFishing();
    if (this.phase === 'playing' || this.phase === 'paused') {
      this.saveProgress();
    }
    this.refreshSavePresence();
    this.phase = 'title';
    document.body.dataset.state = 'title';
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.clearInputs();
    this.sound.setActive(false);
    document.exitPointerLock?.();
    this.combat.viewmodelRoot.visible = false;
    this.pushHudSnapshot(true);
  }

  public toggleMute(): void {
    this.sound.unlock();
    this.sound.setMuted(!this.sound.isMuted());
    this.persistSettings();
    this.pushHudSnapshot(true);
  }

  public setQuality(preset: QualityPreset): void {
    this.updateSettings({ quality: preset });
  }

  public toggleQuality(): void {
    this.setQuality(this.quality === 'high' ? 'low' : 'high');
    this.sound.playUiClick();
  }

  public toggleShaders(): void {
    this.updateSettings({ shadersEnabled: !this.shadersEnabled });
    this.sound.playUiClick();
  }

  public selectHotbar(index: number): void {
    if (index < 0 || index >= this.hotbar.length) return;
    if (this.selectedHotbarIndex !== index) {
      this.resetFishing();
    }
    this.selectedHotbarIndex = index;
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.sound.playUiClick();
    this.pushHudSnapshot(true);
  }

  public moveSlot(from: SlotRef, to: SlotRef): void {
    if (moveOrSwapSlot(this.hotbar, this.backpack, from, to)) {
      this.sound.playUiClick();
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  public quickMoveSlot(ref: SlotRef): void {
    if (quickMoveSlotBetweenHotbarAndBackpack(this.hotbar, this.backpack, ref)) {
      this.sound.playUiClick();
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  public useInventorySlot(ref: SlotRef): void {
    const list = ref.area === 'hotbar' ? this.hotbar : this.backpack;
    const slot = list[ref.index];
    if (!slot || !slot.itemId || slot.count <= 0) return;

    const itemId = slot.itemId;
    const itemDef = ITEMS[itemId];
    if (!itemDef) return;

    if (itemDef.category === 'armor' && itemDef.armorSlot) {
      this.equipArmor(ref);
      return;
    }

    if (
      itemId === 'cooked_meat' ||
      itemId === 'raw_fish' ||
      itemId === 'cooked_fish' ||
      itemId === 'berries' ||
      itemId === 'medkit' ||
      itemId === 'sludge_stim'
    ) {
      const consumed = consumeOneFromSlot(this.hotbar, this.backpack, ref);
      if (consumed) {
        this.applyConsumableEffect(consumed);
      }
      return;
    }

    if (ref.area === 'hotbar') {
      this.selectHotbar(ref.index);
    } else if (quickMoveSlotBetweenHotbarAndBackpack(this.hotbar, this.backpack, ref)) {
      this.sound.playUiClick();
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  public dropSlot(ref: SlotRef, dropAll = true): void {
    const dropped = dropSlotItem(this.hotbar, this.backpack, ref, dropAll);
    if (!dropped) return;
    this.spawnDroppedItemForward(
      dropped.itemId,
      dropped.count,
      dropped.durability,
      dropped.maxDurability,
    );
    this.sound.playUiClick();
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.notify(`Dropped ${dropped.count}× ${ITEMS[dropped.itemId].name}`, 'info');
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  public equipArmor(ref: SlotRef): void {
    const res = equipArmorFromSlot(
      this.hotbar,
      this.backpack,
      this.armor,
      ref,
      this.armorDurability,
    );
    if (!res.ok || !res.itemId) return;
    this.sound.playLoot();
    this.combat.setEquippedItem(this.getEquippedVisual());
    const pct = Math.round(getArmorDefense(this.armor) * 100);
    this.notify(`Equipped ${ITEMS[res.itemId].name} (${pct}% Armor)`, 'gain');
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  public unequipArmor(slot: ArmorSlotType): void {
    const res = unequipArmorSlot(
      this.hotbar,
      this.backpack,
      this.resources,
      this.armor,
      slot,
      this.armorDurability,
    );
    if (!res.ok || !res.itemId) return;
    if (res.overflow > 0) {
      this.spawnDroppedItemForward(res.itemId, res.overflow, res.durability, res.maxDurability);
      this.notify(`Bag full — dropped ${ITEMS[res.itemId].name}`, 'warn');
    } else {
      this.sound.playUiClick();
    }
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  private spawnDroppedItemForward(
    itemId: ItemId,
    count: number,
    durability?: number,
    maxDurability?: number,
  ): void {
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const dx = this.playerPos.x + fwdX * 1.45 + (Math.random() - 0.5) * 0.35;
    const dz = this.playerPos.z + fwdZ * 1.45 + (Math.random() - 0.5) * 0.35;
    const dy = this.world.groundHeightAt(dx, dz);
    this.combat.spawnDroppedItem(itemId, count, dx, dy, dz, undefined, durability, maxDurability);
  }

  private giveItemOrDrop(itemId: ItemId, count: number, customDurability?: number): void {
    const res = addItemToInventory(
      this.hotbar,
      this.backpack,
      this.resources,
      itemId,
      count,
      customDurability,
    );
    if (res.overflow > 0) {
      const maxDur = ITEMS[itemId]?.maxDurability;
      const dur = customDurability ?? maxDur;
      this.spawnDroppedItemForward(itemId, res.overflow, dur, maxDur);
      this.notify(
        `Inventory full! Dropped ${res.overflow}× ${ITEMS[itemId].name} on ground.`,
        'warn',
      );
    }
  }

  public selectBuildPiece(type: BuildPieceType): void {
    this.selectedBuildPiece = type;
    this.radialMenuOpen = false;
    this.sound.playUiClick();
    this.pushHudSnapshot(true);
  }

  public closeMenus(fromPointer = false): void {
    const wasChest = this.activeChestId !== null;
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    if (wasChest) {
      this.sound.playChestToggle(false);
      this.saveProgress();
    }
    this.pushHudSnapshot(true);
    if (this.phase === 'playing' && fromPointer) {
      this.requestPointerLockSafe();
    }
  }

  public toggleCrafting(fromPointer = false): void {
    if (this.phase !== 'playing') return;
    this.resetFishing();
    this.craftingOpen = !this.craftingOpen;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.sound.playUiClick();
    if (this.craftingOpen) {
      this.clearInputs();
      document.exitPointerLock?.();
    } else if (fromPointer) {
      this.requestPointerLockSafe();
    }
    this.pushHudSnapshot(true);
  }

  public toggleRadialMenu(fromPointer = false): void {
    if (this.phase !== 'playing') return;
    this.resetFishing();
    this.radialMenuOpen = !this.radialMenuOpen;
    this.craftingOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.sound.playUiClick();
    if (this.radialMenuOpen) {
      this.clearInputs();
      document.exitPointerLock?.();
    } else if (fromPointer) {
      this.requestPointerLockSafe();
    }
    this.pushHudSnapshot(true);
  }

  public toggleSandboxMenu(fromPointer = false): void {
    if (this.phase !== 'playing' || !this.isSandboxWorld()) return;
    this.resetFishing();
    this.sandboxMenuOpen = !this.sandboxMenuOpen;
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sound.playUiClick();
    if (this.sandboxMenuOpen) {
      this.clearInputs();
      document.exitPointerLock?.();
    } else if (fromPointer) {
      this.requestPointerLockSafe();
    }
    this.pushHudSnapshot(true);
  }

  public moveChestSlot(from: ContainerSlotRef, to: ContainerSlotRef): void {
    if (!this.activeChestId) return;
    const chest = this.building.getChestById(this.activeChestId);
    if (!chest) return;
    if (moveBetweenContainers(this.hotbar, this.backpack, chest.slots, from, to)) {
      this.sound.playUiClick();
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  public quickTransferChest(from: ContainerSlotRef): void {
    if (!this.activeChestId) return;
    const chest = this.building.getChestById(this.activeChestId);
    if (!chest) return;
    if (quickTransferContainerSlot(this.hotbar, this.backpack, chest.slots, from)) {
      this.sound.playUiClick();
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  public transferAllChest(direction: 'to_chest' | 'from_chest'): void {
    if (!this.activeChestId) return;
    const chest = this.building.getChestById(this.activeChestId);
    if (!chest) return;
    let moved = false;
    if (direction === 'to_chest') {
      for (let i = 0; i < this.backpack.length; i++) {
        if (quickTransferContainerSlot(this.hotbar, this.backpack, chest.slots, { area: 'backpack', index: i })) {
          moved = true;
        }
      }
    } else {
      for (let i = 0; i < chest.slots.length; i++) {
        if (quickTransferContainerSlot(this.hotbar, this.backpack, chest.slots, { area: 'chest', index: i })) {
          moved = true;
        }
      }
    }
    if (moved) {
      this.sound.playLoot();
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  public updateSandbox(partial: Partial<SandboxState>): void {
    this.sandbox = { ...this.sandbox, ...partial };
    if (this.sandbox.flyMode) {
      this.playerVelY = 0;
      this.airPeakFootY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    }
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  public sandboxSpawnEntity(kind: EnemyKind): void {
    if (!this.isSandboxWorld()) return;
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const sx = this.playerPos.x + fwdX * 7.5 + (Math.random() - 0.5) * 2.0;
    const sz = this.playerPos.z + fwdZ * 7.5 + (Math.random() - 0.5) * 2.0;
    this.combat.spawnActor(kind, sx, sz, this.world.groundHeightAt);
    this.sound.playUiClick();
    this.notify(`Spawned ${kind.replace(/_/g, ' ')}`, 'info');
    this.pushHudSnapshot(true);
  }

  public sandboxGiveItem(itemId: ItemId, count: number): void {
    if (!this.isSandboxWorld()) return;
    this.giveItemOrDrop(itemId, count);
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.sound.playLoot();
    this.notify(`+${count} ${ITEMS[itemId].name}`, 'gain');
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  public sandboxClearEnemies(): void {
    if (!this.isSandboxWorld()) return;
    this.combat.clearActors();
    this.sound.playUiClick();
    this.notify('Cleared all creatures & raiders', 'info');
    this.pushHudSnapshot(true);
  }

  public sandboxSetTimeOfDay(timeOfDay: number): void {
    if (!this.isSandboxWorld()) return;
    this.dayTime = ((timeOfDay % 1) + 1) % 1;
    this.prevNight = isNightTime(this.dayTime);
    this.updateDayNight(0);
    this.pushHudSnapshot(true);
  }

  public devResetAllData(): void {
    resetAllSavedData();
    this.settings = { ...DEFAULT_GAME_SETTINGS };
    this.updateSettings(this.settings);
    this.metaProgress = { maxNightsSurvived: 0, totalNightsSurvived: 0, sandboxUnlocked: false };
    this.currentWorld = null;
    this.refreshSavePresence();
    if (this.phase !== 'title') {
      this.phase = 'title';
      document.body.dataset.state = 'title';
      this.craftingOpen = false;
      this.radialMenuOpen = false;
      this.activeChestId = null;
      this.sandboxMenuOpen = false;
      this.clearInputs();
      this.sound.setActive(false);
      document.exitPointerLock?.();
      this.combat.viewmodelRoot.visible = false;
    }
    this.pushHudSnapshot(true);
  }

  public devToggleSandboxUnlock(): void {
    const nextUnlocked = !this.metaProgress.sandboxUnlocked;
    this.metaProgress = {
      maxNightsSurvived: nextUnlocked
        ? Math.max(this.metaProgress.maxNightsSurvived, SANDBOX_REQUIRED_NIGHTS)
        : 0,
      totalNightsSurvived: nextUnlocked
        ? Math.max(this.metaProgress.totalNightsSurvived, SANDBOX_REQUIRED_NIGHTS)
        : 0,
      sandboxUnlocked: nextUnlocked,
    };
    saveMetaProgress(this.metaProgress);
    this.sound.playUiClick();
    this.notify(
      nextUnlocked ? 'Dev: Sandbox Unlocked' : 'Dev: Sandbox Locked',
      'info',
    );
    this.pushHudSnapshot(true);
  }

  public devGiveKit(): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.giveItemOrDrop('wood', 400);
    this.giveItemOrDrop('stone', 400);
    this.giveItemOrDrop('metal_frags', 250);
    this.giveItemOrDrop('sulfur', 120);
    this.giveItemOrDrop('cloth', 80);
    this.giveItemOrDrop('sludge', 60);
    this.giveItemOrDrop('building_plan', 1);
    this.giveItemOrDrop('hammer', 1);
    this.giveItemOrDrop('chest_item', 2);
    this.giveItemOrDrop('turret_item', 2);
    this.giveItemOrDrop('floodlight_item', 2);
    this.giveItemOrDrop('flashlight_sludge', 1);
    this.giveItemOrDrop('fishing_rod', 1);
    this.giveItemOrDrop('sniper_rifle', 1);
    this.giveItemOrDrop('ammo', 40);
    this.giveItemOrDrop('medkit', 3);
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.sound.playLoot();
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  public devAdvanceDay(): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.dayCount += 1;
    this.nightsSurvived += 1;
    this.dayTime = 0.32;
    this.prevNight = false;
    this.metaProgress = recordNightCompletedMeta(this.nightsSurvived);
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  public devSetNightfall(): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.dayTime = 0.8;
    this.prevNight = true;
    this.updateDayNight(0);
    this.pushHudSnapshot(true);
  }

  public devRefillVitals(): void {
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.stamina = this.maxStamina;
    this.breath = this.maxBreath;
    this.sound.playLoot();
    this.pushHudSnapshot(true);
  }

  public devClearEnemies(): void {
    this.combat.clearActors();
    this.sound.playUiClick();
    this.pushHudSnapshot(true);
  }

  public devTeleport(dest: 'spawn' | 'cave' | 'river'): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    let tx = 0;
    let tz = 14;
    if (dest === 'cave' && this.world.caveSites.length > 0) {
      const c = this.world.caveSites[0];
      tx = c.x + Math.cos(c.entranceAngle) * (c.radius + 3.5);
      tz = c.z + Math.sin(c.entranceAngle) * (c.radius + 3.5);
    } else if (dest === 'river') {
      tz = 12;
      const rcx = riverCenterAtZ(tz, this.world.seedNum);
      const rhw = riverHalfWidthAtZ(tz, this.world.seedNum);
      tx = rcx + (rcx >= 0 ? -(rhw + 3.5) : rhw + 3.5);
    }
    const ty = this.world.groundHeightAt(tx, tz);
    this.playerPos.set(tx, ty + PLAYER_EYE_HEIGHT + 0.3, tz);
    this.airPeakFootY = ty;
    this.playerVelY = 0;
    this.sound.playUiClick();
    this.pushHudSnapshot(true);
  }

  private resetFishing(): void {
    this.fishingState = 'idle';
    this.fishingTimer = 0;
    this.fishingBobberPos = null;
    this.combat.setFishingVisual(null, null, false, this.elapsed);
  }

  public tryCraft(
    recipeId: string,
    recipes: ReadonlyArray<import('../types/game').CraftingRecipe>,
  ): void {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const res = craftRecipe(this.hotbar, this.backpack, this.resources, recipe);
    if (res.ok) {
      this.sound.playLoot();
      if (res.overflow > 0) {
        this.spawnDroppedItemForward(recipe.outputItem, res.overflow);
        this.notify(
          `Crafted ${ITEMS[recipe.outputItem].name} (dropped ${res.overflow} overflow)`,
          'warn',
        );
      } else {
        this.notify(`Crafted ${recipe.outputCount}× ${ITEMS[recipe.outputItem].name}`, 'gain');
      }
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
    } else {
      this.notify(res.reason || 'Cannot craft', 'warn');
    }
    this.pushHudSnapshot(true);
  }

  public requestPointerLockSafe(): void {
    if (this.activeControlMode === 'phone') return;
    try {
      if (document.pointerLockElement !== this.renderer.domElement) {
        const res = this.renderer.domElement.requestPointerLock?.() as unknown as
          | Promise<void>
          | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Headless browsers may decline pointer lock; drag fallback works
    }
  }

  public setTouchMove = (x: number, z: number): void => {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveZ = Math.max(-1, Math.min(1, z));
  };

  public setTouchSprint = (sprint: boolean): void => {
    this.touchSprint = sprint;
  };

  public addTouchLookDelta = (dx: number, dy: number): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    const isSniperScoped = this.getEquippedItem() === 'sniper_rifle' && this.aiming;
    const baseSens = isSniperScoped ? 0.0012 : this.aiming ? 0.0022 : 0.0034;
    const sens = baseSens * this.settings.mouseSensitivity;
    const ySign = this.settings.invertY ? -1 : 1;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sens * ySign,
      -Math.PI * 0.46,
      Math.PI * 0.46,
    );
  };

  public setTouchActionHeld = (held: boolean): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) {
      this.touchActionHeld = false;
      return;
    }
    this.sound.unlock();
    this.sound.setActive(true);
    if (held && !this.touchActionHeld) {
      this.touchActionJustPressed = true;
    }
    this.touchActionHeld = held;
  };

  public triggerTouchJump = (): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    this.jumpBufferTimer = 0.14;
  };

  public setTouchFlyVert = (dir: -1 | 0 | 1): void => {
    this.touchFlyVert = dir;
  };

  public triggerTouchInteract = (): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    this.interactJustPressed = true;
  };

  public toggleTouchAim = (): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    this.touchAiming = !this.touchAiming;
    this.sound.playUiClick();
  };

  public triggerTouchSecondary = (): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    const eq = this.getEquippedItem();
    if (eq === 'building_plan') {
      this.buildRotSteps = (this.buildRotSteps + 1) % 8;
      this.sound.playUiClick();
    } else if (eq === 'hammer') {
      this.touchAltJustPressed = true;
    }
  };

  public toggleTorch = (): void => {
    if (this.phase !== 'playing') return;
    if (!this.torchOn) {
      const lightSrc = findBestLightSource(
        this.hotbar,
        this.backpack,
        this.selectedHotbarIndex,
      );
      if (!lightSrc) {
        this.sound.playUiClick();
        this.notify('Craft a Torch or Flashlight in [Tab] to use light!', 'warn', 'no_light');
        this.pushHudSnapshot(true);
        return;
      }
      this.torchOn = true;
    } else {
      this.torchOn = false;
    }
    this.sound.playUiClick();
    this.pushHudSnapshot(true);
  };

  public dropActiveSlot = (): void => {
    if (this.phase !== 'playing') return;
    this.dropSlot({ area: 'hotbar', index: this.selectedHotbarIndex }, false);
  };

  private resetRunState(seedWildlife: boolean): void {
    this.health = 100;
    this.hunger = 100;
    this.stamina = 100;
    this.breath = this.maxBreath;
    this.speedBoostTimer = 0;
    this.dayTime = 0.4;
    this.dayCount = 1;
    this.nightsSurvived = 0;
    this.nightType = rollNightType(this.world.seedNum, this.dayCount).type;
    this.playTimeSec = 0;
    this.prevNight = false;
    this.kills = 0;
    this.piecesBuilt = 0;
    this.nodesGathered = 0;
    this.gameOverStats = null;
    this.armor = createInitialArmor();
    this.armorDurability = createInitialArmorDurability();
    this.hotbar = createInitialHotbar();
    this.backpack = createInitialBackpack();
    this.resources = createInitialResources();
    this.selectedHotbarIndex = 0;
    this.selectedBuildPiece = 'foundation';
    this.buildRotSteps = 0;
    this.registeredBedId = null;
    this.openedLootIds.clear();
    this.torchOn = false;
    this.lightDrainAccum = 0;
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.notifications = [];
    this.activeCaveName = null;
    this.undergroundDepth = 0;
    this.inWater = false;
    this.inDeepWater = false;
    this.resetFishing();
    this.combat.setEquippedItem(this.getEquippedVisual());

    for (const node of this.world.nodes) {
      node.alive = true;
      node.hp = node.maxHp;
      node.respawnTimer = 0;
      node.group.visible = true;
    }
    this.building.clearAll();
    this.combat.clearActors();
    this.combat.clearDroppedItems();
    this.combat.clearDeathBackpacks();
    if (seedWildlife || this.combat.actors.length === 0) {
      this.combat.seedInitialWildlife(this.world.groundHeightAt, this.world.caveSites);
    }

    const sy = this.world.groundHeightAt(0, 14);
    this.playerPos.set(0, sy + PLAYER_EYE_HEIGHT, 14);
    this.airPeakFootY = sy;
    this.playerVelY = 0;
    this.yaw = 0;
    this.pitch = -0.04;
    this.grounded = true;
    this.clearInputs();
  }

  private clearInputs(): void {
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
    this.mouseLeftJustPressed = false;
    this.mouseRightJustPressed = false;
    this.interactJustPressed = false;
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.touchSprint = false;
    this.touchActionHeld = false;
    this.touchActionJustPressed = false;
    this.touchAltJustPressed = false;
    this.touchAiming = false;
    this.touchFlyVert = 0;
    this.aiming = false;
  }

  private notify(text: string, tone: HudNotification['tone'], coalesceKey?: string): void {
    const now = performance.now();
    const ttl = this.settings.compactPopups ? 1500 : 2200;
    if (coalesceKey) {
      const existing = this.notifications.find(
        (n) => n.coalesceKey === coalesceKey && n.expiresAt > now,
      );
      if (existing) {
        existing.text = text;
        existing.tone = tone;
        existing.expiresAt = now + ttl;
        return;
      }
    }
    this.notifications.push({
      id: this.notifSeq++,
      text,
      tone,
      expiresAt: now + ttl,
      coalesceKey,
    });
    const maxVisible = this.settings.compactPopups ? 1 : 2;
    while (this.notifications.length > maxVisible) {
      this.notifications.shift();
    }
  }

  private loop = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const rawDt = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;
    const realDt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsed += realDt;

    this.fpsFrames++;
    const fpsSpan = nowMs - this.fpsWindowStartMs;
    if (fpsSpan >= 500) {
      this.currentFps = Math.max(1, Math.round((this.fpsFrames * 1000) / fpsSpan));
      this.fpsFrames = 0;
      this.fpsWindowStartMs = nowMs;
    }

    this.stepFrame(realDt);
    this.shaders.render();

    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepFrame(realDt: number): void {
    const nowMs = performance.now();
    if (this.notifications.length > 0) {
      this.notifications = this.notifications.filter((n) => n.expiresAt > nowMs);
    }

    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - realDt);
    }

    if (this.phase === 'title') {
      const angle = this.elapsed * 0.14;
      const cx = Math.sin(angle) * 34;
      const cz = Math.cos(angle) * 34;
      const cy = Math.max(this.world.groundHeightAt(cx, cz) + 9.5, 11.5);
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(-6, 4.5, -8);
      this.updateDayNight(realDt * 0.25);
      this.world.update(realDt, this.elapsed);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'gameover') {
      return;
    }

    if (!this.isModalsOpen()) {
      this.playTimeSec += realDt;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - realDt);
    }
    const simDt = this.hitstopTimer > 0 ? 0 : realDt;

    // Detect Underground Cave Entry & Depth
    const caveSite = this.world.isInsideCave(this.playerPos.x, this.playerPos.z);
    const prevCave = this.activeCaveName;
    this.activeCaveName = caveSite ? caveSite.name : null;
    this.undergroundDepth = this.world.getCaveDepthAt(this.playerPos.x, this.playerPos.z);
    if (this.activeCaveName && this.activeCaveName !== prevCave) {
      this.notify(`Descending into ${this.activeCaveName} — Press [F] for Light!`, 'info', 'cave_enter');
    }

    this.inWater = this.world.isWaterAt(this.playerPos.x, this.playerPos.z);

    this.updateDayNight(simDt);
    this.world.update(simDt, this.elapsed);
    this.building.update(simDt, this.elapsed);

    const modalsOpen = this.isModalsOpen();
    if (simDt > 0) {
      // Always keep vertical gravity & collisions active so opening menus mid-jump never freezes in air
      this.updatePlayerMovement(simDt, !modalsOpen);
      if (!modalsOpen) {
        this.updatePlayerActions(simDt);
      }
    }

    const equipped = this.getEquippedItem();
    if (equipped !== 'fishing_rod' && this.fishingState !== 'idle') {
      this.resetFishing();
    }

    if (!modalsOpen && simDt > 0 && this.fishingState !== 'idle') {
      this.fishingTimer -= simDt;
      if (this.fishingState === 'waiting' && this.fishingTimer <= 0) {
        this.fishingState = 'bite';
        this.fishingTimer = 2.2;
        this.sound.playFishBite();
        this.notify('Bite on the line! Press [LMB] to reel in!', 'gain', 'fishing');
        this.pushHudSnapshot(true);
      } else if (this.fishingState === 'bite' && this.fishingTimer <= 0) {
        this.resetFishing();
        this.notify('The fish got away!', 'warn', 'fishing');
        this.pushHudSnapshot(true);
      }
    }

    if (this.fishingBobberPos && equipped === 'fishing_rod' && !modalsOpen) {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      const rodTip = this.camera.position
        .clone()
        .addScaledVector(fwd, 1.35)
        .addScaledVector(right, 0.34)
        .addScaledVector(up, 0.08);
      this.combat.setFishingVisual(
        this.fishingBobberPos,
        rodTip,
        this.fishingState === 'bite',
        this.elapsed,
      );
    } else {
      this.combat.setFishingVisual(null, null, false, this.elapsed);
    }

    const freeBuild = this.isSandboxWorld() && this.sandbox.freeBuild;
    this.building.updateGhost({
      active: equipped === 'building_plan' && !modalsOpen,
      pieceType: this.selectedBuildPiece,
      camera: this.camera,
      groundYAt: this.world.groundHeightAt,
      terrainMesh: this.world.terrainMesh,
      playerYaw: this.yaw,
      rotSteps: this.buildRotSteps,
      woodCount: this.resources.wood,
      freeBuild,
      raycaster: this.raycaster,
    });

    const diff = this.getDifficultyProfile();
    const aiCounts = this.combat.update({
      simDt,
      realDt,
      elapsed: this.elapsed,
      playerPos: this.playerPos,
      isNight: isNightTime(this.dayTime),
      dayCount: this.dayCount,
      enemyDamageMult: diff.enemyDamageMult,
      maxRaidersBonus: diff.maxRaidersBonus,
      bloodMoon: this.hasChallenge('blood_moon'),
      groundYAt: this.world.groundHeightAt,
      worldColliders: this.world.colliders,
      worldBoxes: this.world.boxColliders,
      isNodeAlive: (nodeId) => {
        const n = this.world.nodes.find((nd) => nd.id === nodeId);
        return n ? n.alive : true;
      },
      building: this.building,
      onPlayerHit: (dmg, source) => this.damagePlayer(dmg, source),
      onStructureHit: (_id, pos) => {
        this.combat.spawnBurst(pos, 0xa16207, 10, 4.5);
        this.sound.playChopWood();
      },
      onActorShotHit: (actorId, dmg, dir, headshot) => {
        const res = this.combat.damageActor(actorId, dmg, dir, headshot);
        if (res.hit) {
          this.triggerHitmarker(res.killed || headshot);
          if (res.killed && res.kind) {
            this.handleActorKill(res.kind);
          }
        }
      },
      onExplosion: (pos, radius, dmg) => this.handleExplosion(pos, radius, dmg, false),
      onPlacedBarrelShot: (barrelId, pos, dmg) => this.hitPlacedBarrel(barrelId, pos, dmg),
      onChestShot: (chestId, pos, dmg) => this.hitChest(chestId, pos, dmg),
      onTurretShot: (turretId, pos, dmg) => this.hitTurret(turretId, pos, dmg),
      onWorldNodeShot: (nodeId, pos, dmg) => this.hitWorldBarrelNode(nodeId, pos, dmg),
    });

    if (simDt > 0 && this.phase === 'playing') {
      if (this.speedBoostTimer > 0) {
        this.speedBoostTimer = Math.max(0, this.speedBoostTimer - simDt);
        this.stamina = this.maxStamina;
      }

      const godMode = this.isSandboxWorld() && this.sandbox.godMode;
      const swim = stepSwimBreath(this.breath, this.inDeepWater && !godMode, simDt, this.maxBreath);
      this.breath = swim.breath;
      if (swim.drowningDamage > 0 && !godMode) {
        this.health = Math.max(0, this.health - swim.drowningDamage);
        this.notify('Drowning in deep water! Swim back toward shore!', 'danger', 'drowning');
        if (this.health <= 0) {
          this.triggerGameOver('Drowned at Sea');
          return;
        }
      }

      const noRegen = this.hasChallenge('no_regen') || this.hasChallenge('no_heal');
      this.hunger = Math.max(0, this.hunger - simDt * 0.22 * diff.hungerDrainMult);
      if (godMode) {
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;
        this.stamina = this.maxStamina;
        this.breath = this.maxBreath;
      } else if (this.hunger <= 0) {
        this.health -= simDt * 1.15;
      } else if (!noRegen && this.hunger > 70 && this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + simDt * 0.45);
      }

      if (!noRegen && !godMode) {
        for (const cf of this.building.campfires) {
          const d = Math.hypot(this.playerPos.x - cf.x, this.playerPos.z - cf.z);
          if (d < 4.5 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + simDt * 2.5);
          }
        }
      }

      if (this.health <= 0) {
        this.triggerGameOver('Succumbed to the island');
        return;
      }

      this.autoSaveTimer += simDt;
      if (this.autoSaveTimer >= 10) {
        this.autoSaveTimer = 0;
        this.saveProgress();
      }
    }

    this.trauma = Math.max(0, this.trauma - realDt * 2.6);
    const shake = this.trauma * this.trauma;
    const shakeYaw = (Math.random() - 0.5) * 0.045 * shake;
    const shakePitch = (Math.random() - 0.5) * 0.045 * shake;

    this.camera.position.copy(this.playerPos);
    this.camera.rotation.y = this.yaw + shakeYaw;
    this.camera.rotation.x = this.pitch + shakePitch;
    this.camera.rotation.z = 0;

    const sniperScoped = equipped === 'sniper_rifle' && this.aiming && !modalsOpen;
    const baseFov = this.settings.fov;
    const targetFov = sniperScoped ? 24 : this.aiming && !modalsOpen ? Math.max(38, baseFov - 18) : baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 15, realDt);
      this.camera.updateProjectionMatrix();
    }

    // Active light source (craftable Torch or tiered Flashlights) + durability drain
    let lightSrc = findBestLightSource(this.hotbar, this.backpack, this.selectedHotbarIndex);
    if (this.torchOn) {
      if (!lightSrc) {
        this.torchOn = false;
      } else if (simDt > 0 && !modalsOpen) {
        this.lightDrainAccum += simDt;
        if (this.lightDrainAccum >= 1.0) {
          const ticks = Math.floor(this.lightDrainAccum);
          this.lightDrainAccum -= ticks;
          const list = lightSrc.area === 'hotbar' ? this.hotbar : this.backpack;
          const res = damageInventorySlot(list, lightSrc.index, ticks);
          if (res.broken && res.brokenItemId) {
            this.notify(`Your ${ITEMS[res.brokenItemId].name} burned out!`, 'warn', 'tool_break');
            this.combat.setEquippedItem(this.getEquippedVisual());
            this.saveProgress();
            lightSrc = findBestLightSource(this.hotbar, this.backpack, this.selectedHotbarIndex);
            if (!lightSrc) {
              this.torchOn = false;
            }
          }
        }
      }
    } else {
      this.lightDrainAccum = 0;
    }

    if (this.torchOn && lightSrc) {
      if (lightSrc.itemId === 'torch') {
        this.flashlight.intensity = 0;
        this.torchLight.distance = lightSrc.radius;
        this.torchLight.intensity = lightSrc.intensity + Math.sin(this.elapsed * 16) * 0.35;
      } else {
        this.flashlight.distance = lightSrc.radius;
        this.flashlight.intensity = lightSrc.intensity;
        this.torchLight.intensity = 0;
      }
    } else {
      this.flashlight.intensity = 0;
      this.torchLight.intensity = 0;
    }

    this.combat.updateViewmodel(realDt, this.walkDistance, this.aiming, this.elapsed, sniperScoped);
    this.updateInteractPrompt();

    this.mouseLeftJustPressed = false;
    this.mouseRightJustPressed = false;
    this.touchActionJustPressed = false;
    this.touchAltJustPressed = false;
    this.interactJustPressed = false;

    if (nowMs - this.lastHudPushTime > 100) {
      this.pushHudSnapshot(false, aiCounts.wildlifeCount, aiCounts.raiderCount);
    }
  }

  private hitTurret(turretId: string, hitPos: THREE.Vector3, damage: number): boolean {
    const res = this.building.damageTurret(turretId, damage);
    if (!res.turret) return false;
    this.sound.playMineStone();
    this.combat.spawnBurst(hitPos, 0x38bdf8, 10, 4.5);
    this.triggerHitmarker(res.destroyed);
    if (res.destroyed) {
      this.notify('Auto-Turret destroyed!', 'warn', 'turret_break');
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
    return true;
  }

  private hitChest(chestId: string, hitPos: THREE.Vector3, damage: number): boolean {
    const res = this.building.damageChest(chestId, damage);
    if (!res.chest) return false;
    this.sound.playChopWood();
    this.combat.spawnBurst(hitPos, 0xb48a5a, 10, 4.5);
    this.triggerHitmarker(res.destroyed);
    if (res.destroyed) {
      if (this.activeChestId === chestId) {
        this.activeChestId = null;
      }
      for (const slot of res.chest.slots) {
        if (slot.itemId && slot.count > 0) {
          const sx = res.chest.x + (Math.random() - 0.5) * 1.4;
          const sz = res.chest.z + (Math.random() - 0.5) * 1.4;
          const sy = this.world.groundHeightAt(sx, sz);
          this.combat.spawnDroppedItem(
            slot.itemId,
            slot.count,
            sx,
            sy,
            sz,
            undefined,
            slot.durability,
            slot.maxDurability,
          );
        }
      }
      this.notify('Storage Chest destroyed! Contents spilled.', 'warn');
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
    return true;
  }

  private hitPlacedBarrel(barrelId: string, hitPos: THREE.Vector3, damage: number): boolean {
    const barrel = this.building.barrels.find((b) => b.id === barrelId);
    if (!barrel) return false;
    const { nextHp, exploded } = applyBarrelShotDamage(
      barrel.hp,
      damage,
      PLACED_BARREL_EXPLODE_THRESHOLD,
    );
    barrel.hp = nextHp;
    if (exploded) {
      this.building.removeBarrel(barrelId);
      this.triggerHitmarker(true);
      this.saveProgress();
      this.handleExplosion(
        new THREE.Vector3(barrel.x, barrel.y + 0.65, barrel.z),
        7.0,
        145,
        true,
        new Set([barrelId]),
      );
      this.pushHudSnapshot(true);
    } else {
      this.sound.playMineStone();
      this.combat.spawnBurst(hitPos, 0xf59e0b, 10, 4.8);
      this.triggerHitmarker(false);
      this.notify(
        `Explosive Barrel HP: ${Math.round(nextHp)}/${barrel.maxHp} (detonates ≤ ${PLACED_BARREL_EXPLODE_THRESHOLD})`,
        'warn',
        'barrel_hp',
      );
    }
    return true;
  }

  private hitWorldBarrelNode(nodeId: string, hitPos: THREE.Vector3, damage: number): boolean {
    const node = this.world.nodes.find((n) => n.id === nodeId);
    if (!node || !node.alive || node.kind !== 'barrel') return false;
    const { nextHp, exploded } = applyBarrelShotDamage(
      node.hp,
      damage,
      WORLD_BARREL_EXPLODE_THRESHOLD,
    );
    node.hp = nextHp;
    node.shakeTimer = 0.25;
    if (exploded) {
      node.alive = false;
      node.respawnTimer = 60;
      node.group.visible = false;
      this.triggerHitmarker(true);
      this.handleExplosion(
        new THREE.Vector3(node.x, node.y + 0.65, node.z),
        7.0,
        145,
        true,
        new Set([node.id]),
      );
      this.pushHudSnapshot(true);
    } else {
      this.sound.playMineStone();
      this.combat.spawnBurst(hitPos, 0xf59e0b, 10, 4.8);
      this.triggerHitmarker(false);
      this.notify(
        `Barrel HP: ${Math.round(nextHp)}/${node.maxHp} (explodes ≤ ${WORLD_BARREL_EXPLODE_THRESHOLD})`,
        'warn',
      );
    }
    return true;
  }

  private tryPointBlankBarrelShot(
    origin: THREE.Vector3,
    end: THREE.Vector3,
    damage: number,
  ): boolean {
    let bestPlaced: { id: string; t: number; pos: THREE.Vector3 } | null = null;
    for (const barrel of this.building.barrels) {
      const hit = testSegmentCylinderHit(
        origin.x,
        origin.y,
        origin.z,
        end.x,
        end.y,
        end.z,
        barrel.x,
        barrel.y,
        barrel.z,
        0.54,
        1.3,
      );
      if (hit.hit && (!bestPlaced || hit.t < bestPlaced.t)) {
        bestPlaced = {
          id: barrel.id,
          t: hit.t,
          pos: origin.clone().lerp(end, hit.t),
        };
      }
    }
    if (
      bestPlaced &&
      !this.building.isSegmentBlocked(
        origin.x,
        origin.y,
        origin.z,
        bestPlaced.pos.x,
        bestPlaced.pos.y,
        bestPlaced.pos.z,
        false,
      ).blocked &&
      !isSegmentBlockedByWorldBoxes(
        this.world.boxColliders,
        origin.x,
        origin.y,
        origin.z,
        bestPlaced.pos.x,
        bestPlaced.pos.y,
        bestPlaced.pos.z,
      ).blocked
    ) {
      return this.hitPlacedBarrel(bestPlaced.id, bestPlaced.pos, damage);
    }

    let bestNode: { id: string; t: number; pos: THREE.Vector3 } | null = null;
    for (const node of this.world.nodes) {
      if (!node.alive || node.kind !== 'barrel') continue;
      const hit = testSegmentCylinderHit(
        origin.x,
        origin.y,
        origin.z,
        end.x,
        end.y,
        end.z,
        node.x,
        node.y - 0.1,
        node.z,
        node.radius + 0.14,
        1.45,
      );
      if (hit.hit && (!bestNode || hit.t < bestNode.t)) {
        bestNode = {
          id: node.id,
          t: hit.t,
          pos: origin.clone().lerp(end, hit.t),
        };
      }
    }
    if (
      bestNode &&
      !this.building.isSegmentBlocked(
        origin.x,
        origin.y,
        origin.z,
        bestNode.pos.x,
        bestNode.pos.y,
        bestNode.pos.z,
        false,
      ).blocked &&
      !isSegmentBlockedByWorldBoxes(
        this.world.boxColliders,
        origin.x,
        origin.y,
        origin.z,
        bestNode.pos.x,
        bestNode.pos.y,
        bestNode.pos.z,
      ).blocked
    ) {
      return this.hitWorldBarrelNode(bestNode.id, bestNode.pos, damage);
    }
    return false;
  }

  private handleExplosion(
    pos: THREE.Vector3,
    radius: number,
    damage: number,
    canHurtPlayer = false,
    visitedExplosions = new Set<string>(),
  ): void {
    this.combat.spawnBurst(pos, canHurtPlayer ? 0xf97316 : 0x4ade80, 28, 9.5);
    this.combat.spawnBurst(pos, 0xfbbf24, 22, 8.0);
    this.combat.spawnBurst(pos, 0xef4444, 14, 6.5);
    this.sound.playExplosion();
    this.trauma = Math.min(1, this.trauma + 0.68);

    for (const actor of this.combat.actors) {
      if (actor.state === 'ko') continue;
      const d = Math.hypot(actor.x - pos.x, actor.z - pos.z);
      if (d <= radius && Math.abs(actor.y - pos.y) <= radius) {
        const falloff = 1 - d / (radius * 1.15);
        const dir = new THREE.Vector3(actor.x - pos.x, 0, actor.z - pos.z);
        if (dir.lengthSq() > 1e-4) dir.normalize();
        const res = this.combat.damageActor(actor.id, Math.max(12, Math.round(damage * falloff)), dir);
        if (res.hit) {
          this.triggerHitmarker(res.killed);
          if (res.killed && res.kind) {
            this.handleActorKill(res.kind);
          }
        }
      }
    }

    if (canHurtPlayer && this.phase === 'playing') {
      const playerDist = Math.hypot(this.playerPos.x - pos.x, this.playerPos.z - pos.z);
      if (playerDist <= radius && Math.abs(this.playerPos.y - 0.8 - pos.y) <= radius) {
        const falloff = 1 - playerDist / (radius * 1.1);
        const rawPlayerDmg = Math.max(8, Math.round(64 * falloff));
        this.damagePlayer(rawPlayerDmg, 'Barrel Explosion');
      }
    }

    for (const piece of [...this.building.pieces]) {
      const d = Math.hypot(piece.x - pos.x, piece.z - pos.z);
      if (d <= radius * 0.88 && Math.abs(piece.y - pos.y) <= radius) {
        const falloff = 1 - d / (radius * 1.15);
        this.building.damagePiece(piece.id, Math.round(damage * 0.52 * falloff));
      }
    }

    for (const chest of [...this.building.chests]) {
      const d = Math.hypot(chest.x - pos.x, chest.z - pos.z);
      if (d <= radius * 0.88 && Math.abs(chest.y - pos.y) <= radius) {
        const falloff = 1 - d / (radius * 1.15);
        this.hitChest(chest.id, new THREE.Vector3(chest.x, chest.y + 0.35, chest.z), Math.round(damage * 0.65 * falloff));
      }
    }

    for (const turret of [...this.building.turrets]) {
      const d = Math.hypot(turret.x - pos.x, turret.z - pos.z);
      if (d <= radius * 0.88 && Math.abs(turret.y - pos.y) <= radius) {
        const falloff = 1 - d / (radius * 1.15);
        this.hitTurret(turret.id, new THREE.Vector3(turret.x, turret.y + 0.8, turret.z), Math.round(damage * 0.65 * falloff));
      }
    }

    for (const node of this.world.nodes) {
      if (!node.alive || node.kind === 'barrel') continue;
      const d = Math.hypot(node.x - pos.x, node.z - pos.z);
      if (d <= radius * 0.85) {
        this.hitResourceNode(node, 'salvaged_pick', 2.4, pos);
      }
    }

    // Chain-detonate nearby placed explosive barrels & roadside world barrels
    for (const otherBarrel of [...this.building.barrels]) {
      if (visitedExplosions.has(otherBarrel.id)) continue;
      const d = Math.hypot(otherBarrel.x - pos.x, otherBarrel.z - pos.z);
      if (d <= radius * 0.85 && Math.abs(otherBarrel.y - pos.y) <= radius) {
        visitedExplosions.add(otherBarrel.id);
        this.building.removeBarrel(otherBarrel.id);
        this.handleExplosion(
          new THREE.Vector3(otherBarrel.x, otherBarrel.y + 0.65, otherBarrel.z),
          radius,
          damage,
          canHurtPlayer,
          visitedExplosions,
        );
      }
    }

    for (const node of this.world.nodes) {
      if (!node.alive || node.kind !== 'barrel' || visitedExplosions.has(node.id)) continue;
      const d = Math.hypot(node.x - pos.x, node.z - pos.z);
      if (d <= radius * 0.85 && Math.abs(node.y - pos.y) <= radius) {
        visitedExplosions.add(node.id);
        node.alive = false;
        node.respawnTimer = 60;
        node.group.visible = false;
        this.handleExplosion(
          new THREE.Vector3(node.x, node.y + 0.65, node.z),
          radius,
          damage,
          canHurtPlayer,
          visitedExplosions,
        );
      }
    }
  }

  private updateDayNight(dt: number): void {
    const freezeTime = this.isSandboxWorld() && this.sandbox.freezeTime;
    const timeScale = this.isSandboxWorld() ? this.sandbox.timeScale : 1.0;
    if (!freezeTime) {
      this.dayTime += (dt * timeScale) / DAY_CYCLE_SECONDS;
    }
    if (this.dayTime >= 1) {
      this.dayTime -= 1;
      if (this.phase === 'playing') {
        this.dayCount++;
        this.notify(`Day ${this.dayCount} Dawn`, 'info');
        this.saveProgress();
      }
    }

    const nightInfo = rollNightType(this.world.seedNum, this.dayCount);
    this.nightType = nightInfo.type;

    const night = isNightTime(this.dayTime);
    if (this.phase === 'playing' && night !== this.prevNight) {
      const wasNight = this.prevNight;
      this.prevNight = night;
      if (night) {
        this.notify(
          `${nightInfo.label}! Press [F] for Torch/Flashlight or light Campfires.`,
          'danger',
        );
      } else if (wasNight) {
        this.nightsSurvived += 1;
        const wasUnlocked = this.metaProgress.sandboxUnlocked;
        this.metaProgress = recordNightCompletedMeta(this.nightsSurvived);
        if (!wasUnlocked && this.metaProgress.sandboxUnlocked) {
          this.notify('Sandbox Mode Unlocked! Survived 3 nights overall.', 'gain');
        } else {
          this.notify(`Survived Night ${this.nightsSurvived}!`, 'gain');
        }
        this.saveProgress();
        this.pushHudSnapshot(true);
      }
    }

    const sunAngle = (this.dayTime - 0.25) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    this.sunDir.set(sunX, Math.max(-0.2, sunY), 0.35).normalize();
    this.sunLight.position.set(
      this.playerPos.x + sunX * 55,
      Math.max(8, sunY * 65),
      this.playerPos.z + 25,
    );
    this.sunLight.target.position.set(this.playerPos.x, 0, this.playerPos.z);

    const dayFactor = THREE.MathUtils.clamp((sunY + 0.14) / 0.52, 0, 1);
    const duskFactor = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 4.4, 0, 1);

    const nightAmbientMult = THREE.MathUtils.lerp(nightInfo.ambientMult, 1.0, dayFactor);
    const nightSunMult = THREE.MathUtils.lerp(nightInfo.sunMult, 1.0, dayFactor);
    const nightFogMult = THREE.MathUtils.lerp(nightInfo.fogDensityMult, 1.0, dayFactor);

    const daySky = new THREE.Color(0x88b4d8);
    const duskSky = new THREE.Color(0xd97d48);
    const nightSky =
      nightInfo.type === 'moonlit'
        ? new THREE.Color(0x0c1524)
        : nightInfo.type === 'pitch_dark'
          ? new THREE.Color(0x010205)
          : new THREE.Color(0x050810);

    this.skyColor.copy(nightSky).lerp(daySky, dayFactor);
    this.skyColor.lerp(duskSky, duskFactor * 0.55);

    const caveBlend = this.activeCaveName
      ? THREE.MathUtils.clamp(this.undergroundDepth / 4.2, 0.45, 0.94)
      : 0;
    if (caveBlend > 0) {
      this.skyColor.lerp(new THREE.Color(0x040806), caveBlend);
    }

    this.scene.background = this.skyColor;
    this.fog.color.copy(this.skyColor);
    const baseDensity = this.quality === 'high' ? 0.0085 : 0.013;
    const nightFogBoost = (1 - dayFactor) * 0.008 * nightFogMult;
    this.fog.density = this.activeCaveName ? 0.032 : baseDensity + nightFogBoost;

    this.sunLight.intensity =
      THREE.MathUtils.lerp(0.028 * nightSunMult, 2.35, dayFactor) * (1 - caveBlend * 0.92);
    this.sunLight.color
      .setHex(0x637aa8)
      .lerp(new THREE.Color(0xfff1d6), dayFactor)
      .lerp(new THREE.Color(0xffa463), duskFactor * 0.65);

    this.hemiLight.intensity =
      THREE.MathUtils.lerp(0.05 * nightAmbientMult, 0.78, dayFactor) * (1 - caveBlend * 0.85);
    this.scene.environmentIntensity =
      THREE.MathUtils.lerp(0.055 * nightAmbientMult, 0.58, dayFactor) * (1 - caveBlend * 0.82);

    this.shaders.update({
      elapsed: this.elapsed,
      sunDir: this.sunDir,
      dayFactor,
      duskFactor,
      caveBlend,
      fogColor: this.fog.color,
      fogDensity: this.fog.density,
    });

    const riverDist =
      Math.abs(this.playerPos.x - riverCenterAtZ(this.playerPos.z, this.world.seedNum)) -
      riverHalfWidthAtZ(this.playerPos.z, this.world.seedNum);
    const waterProx = this.inWater ? 1 : THREE.MathUtils.clamp(1 - riverDist / 24, 0, 0.85);
    this.sound.updateWind(this.activeCaveName ? 0.6 : 1 - dayFactor, waterProx);
  }

  private updatePlayerMovement(dt: number, allowInput = true): void {
    const keyForward = allowInput
      ? (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
        (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0)
      : 0;
    const keyStrafe = allowInput
      ? (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0)
      : 0;
    const forwardInput = allowInput ? Math.max(-1, Math.min(1, keyForward + this.touchMoveZ)) : 0;
    const strafeInput = allowInput ? Math.max(-1, Math.min(1, keyStrafe + this.touchMoveX)) : 0;

    const flyMode = this.isSandboxWorld() && this.sandbox.flyMode;
    const speedMult = this.isSandboxWorld() ? this.sandbox.speedMult : 1.0;
    const jumpMult = this.isSandboxWorld() ? this.sandbox.jumpMult : 1.0;

    const wantsSprint =
      allowInput &&
      (this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight') || this.touchSprint) &&
      forwardInput > 0.1 &&
      this.stamina > 2;

    if (wantsSprint && this.speedBoostTimer <= 0 && !flyMode) {
      this.stamina = Math.max(0, this.stamina - dt * 18);
    } else if (!wantsSprint) {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 14);
    }

    const boostMult = this.speedBoostTimer > 0 ? 1.42 : 1.0;
    const waterSlow = !flyMode && this.inDeepWater ? 0.62 : !flyMode && this.inWater ? 0.75 : 1.0;
    const baseSpeed = (wantsSprint ? 8.8 : 5.6) * boostMult * speedMult * waterSlow * (flyMode ? 1.65 : 1.0);
    this._scratchForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._scratchRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this._scratchVec.set(0, 0, 0);
    this._scratchVec.addScaledVector(this._scratchForward, forwardInput);
    this._scratchVec.addScaledVector(this._scratchRight, strafeInput);
    const hasMoveInput = this._scratchVec.lengthSq() > 0.001;
    let moveSteps = 1;
    if (hasMoveInput) {
      this._scratchVec.normalize().multiplyScalar(baseSpeed * dt);
      const stepDist = this._scratchVec.length();
      moveSteps = flyMode ? 1 : Math.max(1, Math.min(8, Math.ceil(stepDist / 0.18)));
      this.walkDistance += stepDist;

      if (!flyMode && this.grounded && this.walkDistance >= this.nextStepDistance) {
        this.nextStepDistance = this.walkDistance + (wantsSprint ? 2.4 : 2.0);
        const footNow = this.playerPos.y - PLAYER_EYE_HEIGHT;
        const bldgFloor = this.building.getFloorHeightAt(this.playerPos.x, this.playerPos.z, footNow);
        const boxFloor = getWorldBoxFloorHeightAt(
          this.playerPos.x,
          this.playerPos.z,
          footNow,
          this.world.boxColliders,
        );
        const structY =
          bldgFloor !== null && boxFloor !== null
            ? Math.max(bldgFloor, boxFloor)
            : (bldgFloor ?? boxFloor);
        const surface =
          structY !== null
            ? 'wood'
            : this.world.isWaterAt(this.playerPos.x, this.playerPos.z)
              ? 'water'
              : 'grass';
        this.sound.playFootstep(surface);
      }
    }

    for (let s = 0; s < moveSteps; s++) {
      if (hasMoveInput) {
        this.playerPos.x += this._scratchVec.x / moveSteps;
        this.playerPos.z += this._scratchVec.z / moveSteps;
      }

      const distFromCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
      if (distFromCenter > 178) {
        this.playerPos.x *= 178 / distFromCenter;
        this.playerPos.z *= 178 / distFromCenter;
      }

      if (!flyMode) {
        for (const c of this.world.colliders) {
          if (c.nodeId) {
            const node = this.world.nodes.find((n) => n.id === c.nodeId);
            if (node && !node.alive) continue;
          }
          const dx = this.playerPos.x - c.x;
          const dz = this.playerPos.z - c.z;
          const minD = c.radius + PLAYER_RADIUS;
          const dSq = dx * dx + dz * dz;
          if (dSq < minD * minD && dSq > 0.0001) {
            const d = Math.sqrt(dSq);
            const push = minD - d;
            this.playerPos.x += (dx / d) * push;
            this.playerPos.z += (dz / d) * push;
          }
        }

        resolveWorldBoxCollisions(
          this.playerPos,
          this.world.boxColliders,
          PLAYER_RADIUS,
          PLAYER_EYE_HEIGHT,
        );
        this.building.resolveHorizontalCollision(
          this.playerPos,
          PLAYER_RADIUS,
          PLAYER_EYE_HEIGHT,
          0.5,
        );
      }
    }

    if (flyMode) {
      const keyVert = allowInput
        ? (this.keysHeld.has('Space') ? 1 : 0) -
          (this.keysHeld.has('KeyC') || this.keysHeld.has('ControlLeft') ? 1 : 0)
        : 0;
      const vertInput = allowInput ? Math.max(-1, Math.min(1, keyVert + this.touchFlyVert)) : 0;
      this.playerPos.y += vertInput * baseSpeed * 0.85 * dt;
      const terrainY = this.world.groundHeightAt(this.playerPos.x, this.playerPos.z);
      if (this.playerPos.y < terrainY + PLAYER_EYE_HEIGHT) {
        this.playerPos.y = terrainY + PLAYER_EYE_HEIGHT;
      }
      if (this.playerPos.y > 75) {
        this.playerPos.y = 75;
      }
      this.playerVelY = 0;
      this.grounded = false;
      this.inDeepWater = false;
      this.airPeakFootY = this.playerPos.y - PLAYER_EYE_HEIGHT;
      return;
    }

    if (this.grounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    if (allowInput && this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVelY = 7.4 * jumpMult;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    this.playerVelY -= 20.5 * dt;
    this.playerPos.y += this.playerVelY * dt;

    const footY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    const terrainY = this.world.groundHeightAt(this.playerPos.x, this.playerPos.z);
    const bldgFloorY = this.building.getFloorHeightAt(this.playerPos.x, this.playerPos.z, footY);
    const boxFloorY = getWorldBoxFloorHeightAt(
      this.playerPos.x,
      this.playerPos.z,
      footY,
      this.world.boxColliders,
    );
    const structY =
      bldgFloorY !== null && boxFloorY !== null
        ? Math.max(bldgFloorY, boxFloorY)
        : (bldgFloorY ?? boxFloorY);
    const floorY = structY !== null ? Math.max(terrainY, structY) : terrainY;

    this.inDeepWater = structY === null && terrainY <= -1.15;

    if (!this.grounded) {
      this.airPeakFootY = Math.max(this.airPeakFootY, footY);
    }

    if (footY <= floorY) {
      const landedInWater = structY === null && terrainY <= -0.35;
      if (!this.grounded && !landedInWater && this.playerVelY < -2) {
        const fallDist = Math.max(0, this.airPeakFootY - floorY);
        const impactSpeed = Math.max(0, -this.playerVelY);
        const fallDmg = computeFallDamage(fallDist, impactSpeed);
        if (fallDmg > 0) {
          this.damagePlayer(fallDmg, 'High Fall');
        }
      }
      this.playerPos.y = floorY + PLAYER_EYE_HEIGHT;
      this.playerVelY = 0;
      this.grounded = true;
      this.airPeakFootY = floorY;
    } else {
      this.grounded = false;
    }
  }

  private damageActiveHotbarTool(amount = 1): void {
    const res = damageInventorySlot(this.hotbar, this.selectedHotbarIndex, amount);
    if (!res.damaged) return;
    if (res.broken && res.brokenItemId) {
      this.notify(`Your ${ITEMS[res.brokenItemId].name} broke!`, 'warn', 'tool_break');
      this.combat.setEquippedItem(this.getEquippedVisual());
    }
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  private updatePlayerActions(dt: number): void {
    this.actionCooldown = Math.max(0, this.actionCooldown - dt);
    const equipped = this.getEquippedItem();
    const def = equipped ? ITEMS[equipped] : HAND_STATS;

    const isRanged =
      equipped === 'bow' ||
      equipped === 'crossbow' ||
      equipped === 'pipe_shotgun' ||
      equipped === 'revolver' ||
      equipped === 'smg' ||
      equipped === 'sniper_rifle';
    this.aiming = isRanged && (this.mouseRightHeld || this.touchAiming);

    if (this.interactJustPressed) {
      this.tryInteract();
    }

    // Hammer RMB demolishes Twig piece
    if (equipped === 'hammer' && (this.mouseRightJustPressed || this.touchAltJustPressed)) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      this.raycaster.far = 4.8;
      const hits = this.raycaster.intersectObjects(this.building.hitMeshes, false);
      if (hits.length > 0) {
        const pieceId = hits[0].object.userData.pieceId as string | undefined;
        if (pieceId && this.building.demolishTwigPiece(pieceId)) {
          this.sound.playChopWood();
          this.combat.spawnBurst(hits[0].point, 0xa16207, 10, 4.0);
          this.notify('Demolished Twig piece', 'info');
          this.saveProgress();
          this.pushHudSnapshot(true);
        }
      }
      return;
    }

    const wantsPrimary =
      equipped === null ||
      equipped === 'wood_pickaxe' ||
      equipped === 'torch' ||
      equipped === 'hatchet' ||
      equipped === 'pickaxe' ||
      equipped === 'salvaged_axe' ||
      equipped === 'salvaged_pick' ||
      equipped === 'smg'
        ? this.mouseLeftHeld ||
          this.touchActionHeld ||
          this.mouseLeftJustPressed ||
          this.touchActionJustPressed
        : this.mouseLeftJustPressed || this.touchActionJustPressed;

    if (!wantsPrimary || this.actionCooldown > 0) return;

    this.actionCooldown = def.cooldown ?? 0.4;

    const freeBuild = this.isSandboxWorld() && this.sandbox.freeBuild;
    if (equipped === 'building_plan') {
      const placed = this.building.tryPlaceCurrentPiece(this.selectedBuildPiece, this.resources, freeBuild);
      if (placed.ok && placed.piece) {
        this.piecesBuilt++;
        this.sound.playBuild('twig');
        this.combat.spawnBurst(
          new THREE.Vector3(placed.piece.x, placed.piece.y + 0.4, placed.piece.z),
          0xb48a5a,
          8,
          3.5,
        );
        this.saveProgress();
        this.pushHudSnapshot(true);
      } else {
        this.notify(placed.reason, 'warn', 'build_err');
      }
      return;
    }

    if (equipped === 'hammer') {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      this.raycaster.far = 4.8;
      const hits = this.raycaster.intersectObjects(this.building.hitMeshes, false);
      if (hits.length > 0) {
        const pieceId = hits[0].object.userData.pieceId as string | undefined;
        if (pieceId) {
          const res = this.building.repairOrUpgradePiece(pieceId, this.resources);
          if (res.ok) {
            this.sound.playBuild(res.newTier ?? 'wood');
            this.combat.triggerViewSwing(true);
            this.combat.spawnBurst(
              hits[0].point,
              res.newTier === 'stone' ? 0x9ca3af : 0xc28e54,
              12,
              4.5,
            );
            this.notify(res.reason, 'gain', 'upgrade');
            this.damageActiveHotbarTool(1);
          } else {
            this.notify(res.reason, 'warn', 'upgrade');
          }
          this.pushHudSnapshot(true);
        }
      }
      return;
    }

    if (equipped === 'door_item') {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      this.raycaster.far = 5.5;
      const hits = this.raycaster.intersectObjects(this.building.hitMeshes, false);
      if (hits.length > 0) {
        const pid = hits[0].object.userData.pieceId as string | undefined;
        if (pid && this.building.installDoorOnPiece(pid)) {
          consumeItem(this.hotbar, this.backpack, this.resources, 'door_item', 1);
          this.sound.playBuild('wood');
          this.notify('Door installed! Press [E] to open/close.', 'gain');
          this.combat.setEquippedItem(this.getEquippedVisual());
          this.saveProgress();
          this.pushHudSnapshot(true);
          return;
        }
      }
      this.notify('Aim at an empty Doorway to install Wooden Door', 'warn', 'door_hint');
      return;
    }

    if (
      equipped === 'campfire_item' ||
      equipped === 'lantern_item' ||
      equipped === 'floodlight_item' ||
      equipped === 'barricade_item' ||
      equipped === 'bed_item' ||
      equipped === 'barrel_item' ||
      equipped === 'chest_item' ||
      equipped === 'turret_item'
    ) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      this.raycaster.far =
        equipped === 'bed_item' ||
        equipped === 'barrel_item' ||
        equipped === 'chest_item' ||
        equipped === 'turret_item' ||
        equipped === 'floodlight_item'
          ? 8.5
          : 6.5;
      const hits = this.raycaster.intersectObjects(
        [this.world.terrainMesh, ...this.building.hitMeshes],
        false,
      );

      let px: number | null = null;
      let py = 0;
      let pz = 0;
      if (hits.length > 0) {
        px = hits[0].point.x;
        py = hits[0].point.y;
        pz = hits[0].point.z;
      } else if (
        equipped === 'bed_item' ||
        equipped === 'barrel_item' ||
        equipped === 'chest_item' ||
        equipped === 'turret_item' ||
        equipped === 'floodlight_item'
      ) {
        px = this.playerPos.x - Math.sin(this.yaw) * 2.4;
        pz = this.playerPos.z - Math.cos(this.yaw) * 2.4;
        const footY = this.playerPos.y - PLAYER_EYE_HEIGHT;
        const bldgFloor = this.building.getFloorHeightAt(px, pz, footY + 0.5);
        const boxFloor = getWorldBoxFloorHeightAt(px, pz, footY + 0.5, this.world.boxColliders);
        const structY =
          bldgFloor !== null && boxFloor !== null
            ? Math.max(bldgFloor, boxFloor)
            : (bldgFloor ?? boxFloor);
        const terrainY = this.world.groundHeightAt(px, pz);
        py = structY !== null ? Math.max(terrainY, structY) : terrainY;
      }

      if (px !== null) {
        if (equipped === 'campfire_item') {
          this.building.placeCampfire(px, py, pz);
          this.notify('Campfire lit! Warmth & light nearby.', 'gain');
        } else if (equipped === 'lantern_item') {
          this.building.placeLantern(px, py, pz);
          this.notify('Sludge Lantern placed! ([E] Pick up)', 'gain');
        } else if (equipped === 'floodlight_item') {
          this.building.placeFloodlight(px, py, pz, this.yaw);
          this.notify('Bio-Floodlight Tower deployed! 58m Illumination ([E] Pick up)', 'gain');
        } else if (equipped === 'barricade_item') {
          this.building.placeBarricade(px, py, pz, this.yaw);
          this.notify('Spike Barricade deployed!', 'gain');
        } else if (equipped === 'barrel_item') {
          this.building.placeBarrel(px, py, pz, this.yaw);
          this.notify('Explosive Barrel placed! Shoot to detonate or [E] pick up.', 'gain');
        } else if (equipped === 'chest_item') {
          this.building.placeChest(px, py, pz, this.yaw);
          this.notify('Storage Chest placed! Press [E] to open (6×4).', 'gain');
        } else if (equipped === 'turret_item') {
          this.building.placeTurret(px, py, pz, this.yaw);
          this.notify('Auto-Turret deployed! Guards against Raiders ([E] Pick up).', 'gain');
        } else {
          const bed = this.building.placeBed(px, py, pz, this.yaw);
          this.registeredBedId = bed.id;
          this.notify('Camp Bed placed & registered as respawn point!', 'gain');
        }
        consumeItem(this.hotbar, this.backpack, this.resources, equipped, 1);
        this.sound.playBuild(equipped === 'bed_item' || equipped === 'chest_item' ? 'wood' : 'stone');
        this.combat.setEquippedItem(this.getEquippedVisual());
        this.saveProgress();
        this.pushHudSnapshot(true);
      }
      return;
    }

    if (equipped === 'fishing_rod') {
      if (this.fishingState === 'idle') {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
        let castPos: THREE.Vector3 | null = null;
        for (let dist = 2.5; dist <= 14.5; dist += 0.6) {
          const tx = this.camera.position.x + dir.x * dist;
          const tz = this.camera.position.z + dir.z * dist;
          if (this.world.isWaterAt(tx, tz)) {
            const isRiverHere =
              Math.abs(tx - riverCenterAtZ(tz, this.world.seedNum)) <=
                riverHalfWidthAtZ(tz, this.world.seedNum) + 0.8 &&
              this.world.groundHeightAt(tx, tz) > 0.14;
            castPos = new THREE.Vector3(tx, isRiverHere ? RIVER_WATER_Y + 0.02 : 0.02, tz);
            break;
          }
        }
        if (castPos) {
          this.fishingBobberPos = castPos;
          this.fishingState = 'waiting';
          this.fishingTimer = 2.2 + Math.random() * 2.8;
          this.combat.triggerViewSwing(false);
          this.sound.playFishCast();
          this.notify('Line cast! Wait for the bobber to dip...', 'info', 'fishing');
        } else {
          this.notify('Aim at river or shoreline water to cast your line!', 'warn', 'fishing');
        }
      } else if (this.fishingState === 'waiting') {
        this.resetFishing();
        this.sound.playUiClick();
        this.notify('Reeled in early.', 'info', 'fishing');
      } else if (this.fishingState === 'bite') {
        const caught = rollFishingCatch(Math.random());
        this.giveItemOrDrop(caught.itemId, caught.count);
        this.sound.playFishCatch();
        this.triggerHitmarker(true);
        this.combat.triggerViewSwing(true);
        if (this.fishingBobberPos) {
          this.combat.spawnBurst(this.fishingBobberPos, 0x38bdf8, 12, 4.2);
        }
        this.resetFishing();
        this.notify(`Caught ${caught.count}× ${ITEMS[caught.itemId].name}!`, 'gain', 'fishing');
        this.damageActiveHotbarTool(1);
        this.combat.setEquippedItem(this.getEquippedVisual());
      }
      this.pushHudSnapshot(true);
      return;
    }

    const itemDef = equipped ? ITEMS[equipped] : null;

    // Equip armor directly from hotbar on LMB
    if (equipped && itemDef && itemDef.category === 'armor' && itemDef.armorSlot) {
      this.equipArmor({ area: 'hotbar', index: this.selectedHotbarIndex });
      return;
    }

    if (
      itemDef &&
      (equipped === 'cooked_meat' ||
        equipped === 'raw_fish' ||
        equipped === 'cooked_fish' ||
        equipped === 'berries' ||
        equipped === 'medkit' ||
        equipped === 'sludge_stim')
    ) {
      const consumed = consumeOneFromSlot(this.hotbar, this.backpack, {
        area: 'hotbar',
        index: this.selectedHotbarIndex,
      });
      if (consumed) {
        this.applyConsumableEffect(consumed);
      }
      return;
    }

    if (equipped === 'grenade') {
      if (!consumeItem(this.hotbar, this.backpack, this.resources, 'grenade', 1)) return;
      this.sound.playSwing();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      dir.y += 0.22;
      dir.normalize();
      const origin = this.camera.position.clone().addScaledVector(dir, 0.6);
      this.combat.spawnProjectile({
        origin,
        direction: dir,
        speed: 20,
        gravity: 16,
        damage: def.damage ?? 135,
        isEnemy: false,
        color: 0x4ade80,
        scaleZ: 0.45,
        scaleXY: 3.2,
        isExplosive: true,
        blastRadius: 6.2,
      });
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.pushHudSnapshot(true);
      return;
    }

    if (equipped === 'bow' || equipped === 'crossbow') {
      if (!consumeItem(this.hotbar, this.backpack, this.resources, 'arrow', 1)) {
        this.notify('Out of Arrows! Craft more in [Tab]', 'warn', 'ammo_warn');
        return;
      }
      this.sound.playBowRelease();
      this.combat.triggerViewRecoil(equipped === 'crossbow' ? 0.9 : 0.6);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      const baseDmg = def.damage ?? 46;
      const pbEnd = this.camera.position.clone().addScaledVector(dir, 0.95);
      const pbHit = this.combat.findClosestSweptHit(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
        pbEnd.x,
        pbEnd.y,
        pbEnd.z,
      );
      if (
        pbHit &&
        !this.building.isSegmentBlocked(
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          pbEnd.x,
          pbEnd.y,
          pbEnd.z,
          false,
        ).blocked &&
        !isSegmentBlockedByWorldBoxes(
          this.world.boxColliders,
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          pbEnd.x,
          pbEnd.y,
          pbEnd.z,
        ).blocked
      ) {
        const finalDamage = computeHeadshotDamage(baseDmg, pbHit.headshot, 2.0);
        const res = this.combat.damageActor(pbHit.actorId, finalDamage, dir, pbHit.headshot);
        if (res.hit) {
          this.triggerHitmarker(res.killed || pbHit.headshot);
          if (res.killed && res.kind) this.handleActorKill(res.kind);
        }
      } else if (
        this.tryPointBlankBarrelShot(
          this.camera.position,
          this.camera.position.clone().addScaledVector(dir, 1.3),
          baseDmg,
        )
      ) {
        // Point-blank barrel hit handled
      } else {
        const origin = this.camera.position.clone().addScaledVector(dir, 0.08);
        this.combat.spawnProjectile({
          origin,
          direction: dir,
          speed: equipped === 'crossbow' ? 62 : this.aiming ? 48 : 38,
          gravity: equipped === 'crossbow' ? 3.5 : 7.5,
          damage: baseDmg,
          isEnemy: false,
          color: equipped === 'crossbow' ? 0x93c5fd : 0xe5c07b,
          scaleZ: 1.4,
          headshotMult: 2.0,
        });
      }
      this.damageActiveHotbarTool(1);
      this.pushHudSnapshot(true);
      return;
    }

    if (
      equipped === 'revolver' ||
      equipped === 'pipe_shotgun' ||
      equipped === 'smg' ||
      equipped === 'sniper_rifle'
    ) {
      if (!consumeItem(this.hotbar, this.backpack, this.resources, 'ammo', 1)) {
        this.notify('Out of Handmade Shells! Craft Ammo in [Tab]', 'warn', 'ammo_warn');
        return;
      }
      const isShotgun = equipped === 'pipe_shotgun';
      const isSniper = equipped === 'sniper_rifle';
      const headshotMult = isSniper ? 2.25 : 2.0;
      this.sound.playGunshot(isShotgun ? 'shotgun' : isSniper ? 'sniper' : 'revolver');
      this.combat.triggerViewRecoil(
        isSniper ? 1.5 : isShotgun ? 1.4 : equipped === 'smg' ? 0.45 : 0.9,
      );
      this.trauma = Math.min(
        1,
        this.trauma + (isSniper ? 0.46 : isShotgun ? 0.42 : equipped === 'smg' ? 0.12 : 0.22),
      );

      const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      const origin = this.camera.position.clone().addScaledVector(baseDir, 0.08);
      const muzzlePos = this.camera.position.clone().addScaledVector(baseDir, 0.55);
      const pellets = isShotgun ? 6 : 1;
      const spread = isSniper
        ? this.aiming
          ? 0.0008
          : 0.016
        : isShotgun
          ? 0.085
          : this.aiming
            ? 0.006
            : equipped === 'smg'
              ? 0.028
              : 0.018;
      const baseDmg = def.damage ?? 38;

      for (let p = 0; p < pellets; p++) {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();

        const pbEnd = this.camera.position.clone().addScaledVector(dir, 0.95);
        const pbHit = this.combat.findClosestSweptHit(
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          pbEnd.x,
          pbEnd.y,
          pbEnd.z,
        );
        if (
          pbHit &&
          !this.building.isSegmentBlocked(
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
            pbEnd.x,
            pbEnd.y,
            pbEnd.z,
            false,
          ).blocked &&
          !isSegmentBlockedByWorldBoxes(
            this.world.boxColliders,
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
            pbEnd.x,
            pbEnd.y,
            pbEnd.z,
          ).blocked
        ) {
          const finalDamage = computeHeadshotDamage(baseDmg, pbHit.headshot, headshotMult);
          const res = this.combat.damageActor(pbHit.actorId, finalDamage, dir, pbHit.headshot);
          if (res.hit) {
            this.triggerHitmarker(res.killed || pbHit.headshot);
            if (res.killed && res.kind) this.handleActorKill(res.kind);
          }
          continue;
        }

        if (
          this.tryPointBlankBarrelShot(
            this.camera.position,
            this.camera.position.clone().addScaledVector(dir, 1.3),
            baseDmg,
          )
        ) {
          continue;
        }

        this.combat.spawnProjectile({
          origin,
          direction: dir,
          speed: isSniper ? 148 : 78,
          gravity: isSniper ? 0.15 : 0.4,
          damage: baseDmg,
          isEnemy: false,
          color: isSniper ? 0x67e8f9 : equipped === 'smg' ? 0x4ade80 : 0xfef08a,
          scaleZ: isSniper ? 2.1 : 1.1,
          headshotMult,
        });
      }
      this.combat.spawnBurst(muzzlePos, 0xfbbf24, 6, 3.0);
      this.damageActiveHotbarTool(1);
      this.pushHudSnapshot(true);
      return;
    }

    // Melee gather / attack
    this.combat.triggerViewSwing(
      equipped === 'wood_pickaxe' ||
        equipped === 'hatchet' ||
        equipped === 'pickaxe' ||
        equipped === 'salvaged_axe' ||
        equipped === 'salvaged_pick',
    );
    this.sound.playSwing();

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = def.range ?? 2.8;

    const actorHits = this.raycaster.intersectObjects(this.combat.actorHitMeshes, false);
    if (actorHits.length > 0) {
      const actorId = actorHits[0].object.userData.actorId as string | undefined;
      const actor = actorId ? this.combat.actors.find((a) => a.id === actorId) : undefined;
      if (actorId && actor) {
        const pushDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const head = getActorHeadSphere(actor);
        const hitPt = actorHits[0].point;
        const headDist = Math.hypot(hitPt.x - head.x, hitPt.y - head.y, hitPt.z - head.z);
        const meleeHeadshot = headDist <= head.radius + 0.14;
        const finalDmg = computeHeadshotDamage(def.damage ?? 15, meleeHeadshot, 1.5);
        const res = this.combat.damageActor(actorId, finalDmg, pushDir, meleeHeadshot);
        if (res.hit) {
          this.triggerHitmarker(res.killed || meleeHeadshot);
          this.hitstopTimer = res.killed ? 0.055 : 0.032;
          this.trauma = Math.min(1, this.trauma + 0.25);
          if (res.killed && res.kind) {
            this.handleActorKill(res.kind);
          }
          if (equipped) {
            this.damageActiveHotbarTool(1);
          }
          return;
        }
      }
    }

    const turretHits = this.raycaster.intersectObjects(this.building.turretHitMeshes, false);
    if (turretHits.length > 0) {
      const turretId = turretHits[0].object.userData.turretId as string | undefined;
      if (turretId && this.hitTurret(turretId, turretHits[0].point, def.damage ?? 16)) {
        if (equipped) this.damageActiveHotbarTool(1);
        return;
      }
    }

    const chestHits = this.raycaster.intersectObjects(this.building.chestHitMeshes, false);
    if (chestHits.length > 0) {
      const chestId = chestHits[0].object.userData.chestId as string | undefined;
      if (chestId && this.hitChest(chestId, chestHits[0].point, def.damage ?? 18)) {
        if (equipped) this.damageActiveHotbarTool(1);
        return;
      }
    }

    const placedBarrelHits = this.raycaster.intersectObjects(this.building.barrelHitMeshes, false);
    if (placedBarrelHits.length > 0) {
      const barrelId = placedBarrelHits[0].object.userData.barrelId as string | undefined;
      if (barrelId && this.hitPlacedBarrel(barrelId, placedBarrelHits[0].point, def.damage ?? 18)) {
        if (equipped) this.damageActiveHotbarTool(1);
        return;
      }
    }

    const buildHits = this.raycaster.intersectObjects(this.building.hitMeshes, false);
    if (buildHits.length > 0) {
      const pieceId = buildHits[0].object.userData.pieceId as string | undefined;
      if (pieceId) {
        const broken = this.building.damagePiece(pieceId, def.damage ?? 16);
        this.sound.playChopWood();
        this.combat.spawnBurst(buildHits[0].point, 0xa16207, 9, 4.2);
        this.triggerHitmarker(broken);
        if (broken) {
          this.notify('Structure destroyed', 'warn', 'struct_break');
          this.saveProgress();
        }
        if (equipped) this.damageActiveHotbarTool(1);
        this.pushHudSnapshot(true);
        return;
      }
    }

    const nodeHits = this.raycaster.intersectObjects(this.world.hitMeshes, false);
    if (nodeHits.length > 0) {
      const nodeId = nodeHits[0].object.userData.nodeId as string | undefined;
      const node = this.world.nodes.find((n) => n.id === nodeId);
      if (node && node.alive) {
        const harvested = this.hitResourceNode(
          node,
          equipped ?? 'hand',
          def.gatherPower ?? 1.0,
          nodeHits[0].point,
        );
        if (harvested && equipped) {
          this.damageActiveHotbarTool(1);
        }
      }
    }
  }

  private applyConsumableEffect(itemId: ItemId): void {
    const itemDef = ITEMS[itemId];
    if (!itemDef) return;
    const noHeal = this.hasChallenge('no_heal');
    const heal = noHeal ? 0 : (itemDef.healAmount ?? 0);
    const food = itemDef.hungerAmount ?? 0;
    this.health = Math.min(this.maxHealth, this.health + heal);
    this.hunger = Math.min(this.maxHunger, this.hunger + food);
    if (itemId === 'sludge_stim') {
      this.speedBoostTimer = 12.0;
      this.stamina = this.maxStamina;
      this.notify(
        `${heal > 0 ? `+${heal} HP · ` : ''}Bio-Sludge Speed Surge (12s)!`,
        'gain',
        'consume',
      );
    } else if (noHeal && food === 0) {
      this.notify('Iron Vitality challenge blocks HP healing!', 'warn', 'consume');
    } else {
      const parts: string[] = [];
      if (heal > 0) parts.push(`+${heal} HP`);
      if (food > 0) parts.push(`+${food} Hunger`);
      this.notify(parts.join(' · ') || 'Consumed', 'gain', 'consume');
    }
    this.sound.playLoot();
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  private hitResourceNode(
    node: WorldNode,
    tool: EquippedVisualId,
    power: number,
    hitPoint: THREE.Vector3,
  ): boolean {
    const gate = canHarvestNodeWithTool(tool, node.kind);
    if (!gate.allowed) {
      this.sound.playMineStone();
      this.combat.spawnBurst(hitPoint, 0x9ca3af, 4, 2.2);
      if (gate.reason) {
        this.notify(gate.reason, 'warn', 'gather_gate');
      }
      return false;
    }
    const isTree = node.kind === 'tree';
    const isOre =
      node.kind === 'stone' ||
      node.kind === 'metal' ||
      node.kind === 'sulfur' ||
      node.kind === 'sludge';
    const isBush = node.kind === 'berry_bush';
    const isLoot = node.kind === 'barrel' || node.kind === 'crate';

    const diffGather = this.getDifficultyProfile().gatherMult;
    let mult = power * diffGather;
    if (isTree && (tool === 'hatchet' || tool === 'salvaged_axe')) mult *= 1.35;
    if (isOre && (tool === 'wood_pickaxe' || tool === 'pickaxe' || tool === 'salvaged_pick')) mult *= 1.35;

    const dmg = Math.round(22 * power);
    node.hp -= dmg;
    node.shakeTimer = 0.22;
    this.hitstopTimer = 0.028;
    this.trauma = Math.min(1, this.trauma + 0.16);

    if (isTree) {
      this.sound.playChopWood();
      this.combat.spawnBurst(hitPoint, 0x8b5a2b, 9, 4.5);
      const woodGain = Math.round(14 * mult);
      this.giveItemOrDrop('wood', woodGain);
      this.notify(`+${woodGain} Wood`, 'gain', 'gather_wood');
    } else if (isBush) {
      this.sound.playChopWood();
      this.combat.spawnBurst(hitPoint, 0xdc2626, 8, 3.8);
    } else if (isOre) {
      this.sound.playMineStone();
      const color =
        node.kind === 'sulfur'
          ? 0xfacc15
          : node.kind === 'metal'
            ? 0x64748b
            : node.kind === 'sludge'
              ? 0x4ade80
              : 0x9ca3af;
      this.combat.spawnBurst(hitPoint, color, 10, 5.2);
      if (node.kind === 'stone') {
        const gain = Math.round(14 * mult);
        this.giveItemOrDrop('stone', gain);
        this.notify(`+${gain} Stone`, 'gain', 'gather_stone');
      } else if (node.kind === 'metal') {
        const oreGain = Math.round(10 * mult);
        const stoneGain = Math.round(5 * mult);
        this.giveItemOrDrop('metal_ore', oreGain);
        this.giveItemOrDrop('stone', stoneGain);
        this.notify(`+${oreGain} Metal Ore · +${stoneGain} Stone`, 'gain', 'gather_metal');
      } else if (node.kind === 'sulfur') {
        const sulfurGain = Math.round(11 * mult);
        const stoneGain = Math.round(4 * mult);
        this.giveItemOrDrop('sulfur', sulfurGain);
        this.giveItemOrDrop('stone', stoneGain);
        this.notify(`+${sulfurGain} Sulfur · +${stoneGain} Stone`, 'gain', 'gather_sulfur');
      } else {
        const sludgeGain = Math.round(9 * mult);
        const stoneGain = Math.round(4 * mult);
        this.giveItemOrDrop('sludge', sludgeGain);
        this.giveItemOrDrop('stone', stoneGain);
        this.notify(`+${sludgeGain} Bio-Sludge · +${stoneGain} Stone`, 'gain', 'gather_sludge');
      }
    } else if (isLoot) {
      this.sound.playMineStone();
      this.combat.spawnBurst(hitPoint, 0xc2410c, 10, 4.5);
    }

    if (node.hp <= 0) {
      node.alive = false;
      node.respawnTimer = isLoot || isBush ? 45 : 65;
      node.group.visible = false;
      this.nodesGathered++;
      if (isLoot) {
        this.grantLootDrop(node.kind === 'crate');
      } else if (isBush) {
        this.giveItemOrDrop('berries', 3);
        this.giveItemOrDrop('cloth', 4);
        this.notify('Foraged +3 Wild Berries · +4 Cloth', 'gain', 'gather_bush');
      } else if (isTree) {
        this.giveItemOrDrop('wood', 18);
        this.notify('Tree felled! +18 Wood bonus', 'gain', 'gather_wood');
      } else if (node.kind === 'stone') {
        this.giveItemOrDrop('stone', 18);
      } else if (node.kind === 'metal') {
        this.giveItemOrDrop('metal_ore', 16);
      } else if (node.kind === 'sulfur') {
        this.giveItemOrDrop('sulfur', 16);
      } else if (node.kind === 'sludge') {
        this.giveItemOrDrop('sludge', 14);
      }
    }

    this.pushHudSnapshot(true);
    return true;
  }

  private grantLootDrop(isCrate: boolean): void {
    this.sound.playLoot();
    const frags = isCrate ? 22 : 12;
    const cloth = isCrate ? 14 : 10;
    this.giveItemOrDrop('metal_frags', frags);
    this.giveItemOrDrop('cloth', cloth);

    if (isCrate) {
      this.giveItemOrDrop('ammo', 4);
      this.giveItemOrDrop('sludge', 6);
      this.giveItemOrDrop('cooked_meat', 1);
      this.notify(`Supply Crate: +${frags} Metal Frags, +${cloth} Cloth, +6 Sludge, +4 Ammo`, 'gain');
    } else {
      this.giveItemOrDrop('wood', 15);
      this.notify(`Barrel: +${frags} Metal Frags, +${cloth} Cloth, +15 Wood`, 'gain');
    }
    this.saveProgress();
  }

  private lootDeathBackpackById(bagId: string): boolean {
    const bag = this.combat.deathBackpacks.find((b) => b.data.id === bagId);
    if (!bag) return false;

    const { collectedCount, remaining } = lootDeathBackpack(
      bag.data.items,
      this.hotbar,
      this.backpack,
      this.resources,
      this.armor,
      this.armorDurability,
    );

    if (collectedCount === 0 && remaining.length > 0) {
      this.notify('Inventory full! Make space before looting Death Backpack.', 'warn');
      return false;
    }

    this.combat.updateDeathBackpackItems(bagId, remaining);
    this.sound.playLoot();
    if (remaining.length === 0) {
      this.notify('Recovered all gear & resources from Death Backpack!', 'gain');
    } else {
      this.notify(
        `Recovered items from Death Backpack (${remaining.length} stacks remaining).`,
        'warn',
      );
    }
    this.combat.setEquippedItem(this.getEquippedVisual());
    this.saveProgress();
    this.pushHudSnapshot(true);
    return true;
  }

  private tryInteract(): void {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 4.4;

    const deathBagHits = this.raycaster.intersectObjects(this.combat.deathBackpackHitMeshes, false);
    if (deathBagHits.length > 0) {
      const bagId = deathBagHits[0].object.userData.deathBagId as string | undefined;
      if (bagId && this.lootDeathBackpackById(bagId)) {
        return;
      }
    }

    this.raycaster.far = 4.0;
    const dropHits = this.raycaster.intersectObjects(this.combat.droppedHitMeshes, false);
    if (dropHits.length > 0) {
      const dropId = dropHits[0].object.userData.dropId as string | undefined;
      if (dropId) {
        const bag = this.combat.removeDroppedItem(dropId);
        if (bag) {
          const res = addItemToInventory(
            this.hotbar,
            this.backpack,
            this.resources,
            bag.itemId,
            bag.count,
            bag.durability,
          );
          if (res.overflow > 0) {
            this.combat.spawnDroppedItem(
              bag.itemId,
              res.overflow,
              bag.x,
              bag.y,
              bag.z,
              undefined,
              bag.durability,
              bag.maxDurability,
            );
            this.notify(
              `Picked up ${res.added}× ${ITEMS[bag.itemId].name} (${res.overflow} left on ground)`,
              'warn',
            );
          } else {
            this.sound.playLoot();
            this.notify(`Picked up ${bag.count}× ${ITEMS[bag.itemId].name}`, 'gain');
          }
          this.combat.setEquippedItem(this.getEquippedVisual());
          this.saveProgress();
          this.pushHudSnapshot(true);
          return;
        }
      }
    }

    this.raycaster.far = 4.6;
    const bedHits = this.raycaster.intersectObjects(this.building.bedHitMeshes, false);
    if (bedHits.length > 0) {
      const bedId = bedHits[0].object.userData.bedId as string | undefined;
      const bed = bedId ? this.building.beds.find((b) => b.id === bedId) : undefined;
      if (bed) {
        this.registeredBedId = bed.id;
        this.sound.playLoot();
        this.notify('Camp Bed registered as respawn point!', 'gain');
        this.saveProgress();
        this.pushHudSnapshot(true);
        return;
      }
    }

    this.raycaster.far = 4.4;
    const turretHits = this.raycaster.intersectObjects(this.building.turretHitMeshes, false);
    if (turretHits.length > 0) {
      const turretId = turretHits[0].object.userData.turretId as string | undefined;
      if (turretId && this.building.removeTurret(turretId)) {
        this.sound.playLoot();
        this.giveItemOrDrop('turret_item', 1);
        this.notify('Picked up Auto-Turret Bot!', 'gain');
        this.combat.setEquippedItem(this.getEquippedVisual());
        this.saveProgress();
        this.pushHudSnapshot(true);
        return;
      }
    }

    this.raycaster.far = 4.4;
    const lanternHits = this.raycaster.intersectObjects(this.building.lanternHitMeshes, false);
    if (lanternHits.length > 0) {
      const lanternId = lanternHits[0].object.userData.lanternId as string | undefined;
      const removed = lanternId ? this.building.removeLantern(lanternId) : null;
      if (removed) {
        const itemId = removed.kind === 'floodlight' ? 'floodlight_item' : 'lantern_item';
        this.sound.playLoot();
        this.giveItemOrDrop(itemId, 1);
        this.notify(`Picked up ${ITEMS[itemId].name}!`, 'gain');
        this.combat.setEquippedItem(this.getEquippedVisual());
        this.saveProgress();
        this.pushHudSnapshot(true);
        return;
      }
    }

    this.raycaster.far = 4.4;
    const structLootHits = this.raycaster.intersectObjects(this.world.lootHitMeshes, false);
    if (structLootHits.length > 0) {
      const lootId = structLootHits[0].object.userData.lootId as string | undefined;
      const idx = lootId ? this.world.lootContainers.findIndex((c) => c.id === lootId) : -1;
      if (lootId && idx !== -1) {
        const container = this.world.lootContainers[idx];
        if (!container.opened) {
          this.world.markLootOpened(lootId);
          this.openedLootIds.add(lootId);
          const drops = rollStructureLoot(this.world.seedNum, idx);
          this.sound.playLoot();
          const summaryParts: string[] = [];
          for (const d of drops) {
            this.giveItemOrDrop(d.itemId, d.count);
            summaryParts.push(`+${d.count} ${d.label}`);
          }
          this.notify(`${container.name}: ${summaryParts.join(', ')}`, 'gain');
          this.combat.setEquippedItem(this.getEquippedVisual());
          this.saveProgress();
          this.pushHudSnapshot(true);
        } else {
          this.notify(`${container.name} is already looted.`, 'info', 'loot_empty');
        }
        return;
      }
    }

    this.raycaster.far = 4.0;
    const buildHits = this.raycaster.intersectObjects(this.building.hitMeshes, false);
    if (buildHits.length > 0) {
      const pid = buildHits[0].object.userData.pieceId as string | undefined;
      if (pid) {
        const piece = this.building.pieces.find((p) => p.id === pid);
        if (piece && piece.type === 'doorway') {
          if (piece.hasDoor) {
            this.building.toggleDoor(pid);
            this.sound.playDoorToggle();
            this.saveProgress();
            return;
          }
          if (getItemCount(this.hotbar, this.backpack, this.resources, 'door_item') > 0) {
            if (this.building.installDoorOnPiece(pid)) {
              consumeItem(this.hotbar, this.backpack, this.resources, 'door_item', 1);
              this.sound.playBuild('wood');
              this.notify('Wooden Door installed!', 'gain');
              this.saveProgress();
              this.pushHudSnapshot(true);
              return;
            }
          }
        }
      }
    }

    this.raycaster.far = 4.4;
    const chestHits = this.raycaster.intersectObjects(this.building.chestHitMeshes, false);
    if (chestHits.length > 0) {
      const chestId = chestHits[0].object.userData.chestId as string | undefined;
      if (chestId && this.building.getChestById(chestId)) {
        this.resetFishing();
        this.activeChestId = chestId;
        this.craftingOpen = false;
        this.radialMenuOpen = false;
        this.sandboxMenuOpen = false;
        this.clearInputs();
        document.exitPointerLock?.();
        this.sound.playChestToggle(true);
        this.pushHudSnapshot(true);
        return;
      }
    }

    this.raycaster.far = 4.4;
    const placedBarrelHits = this.raycaster.intersectObjects(this.building.barrelHitMeshes, false);
    if (placedBarrelHits.length > 0) {
      const barrelId = placedBarrelHits[0].object.userData.barrelId as string | undefined;
      if (barrelId && this.building.removeBarrel(barrelId)) {
        this.sound.playLoot();
        this.giveItemOrDrop('barrel_item', 1);
        this.notify('Picked up Explosive Barrel!', 'gain');
        this.combat.setEquippedItem(this.getEquippedVisual());
        this.saveProgress();
        this.pushHudSnapshot(true);
        return;
      }
    }

    this.raycaster.far = 4.0;
    const nodeHits = this.raycaster.intersectObjects(this.world.hitMeshes, false);
    if (nodeHits.length > 0) {
      const nid = nodeHits[0].object.userData.nodeId as string | undefined;
      const node = this.world.nodes.find((n) => n.id === nid);
      if (node && node.alive && (node.kind === 'barrel' || node.kind === 'crate' || node.kind === 'berry_bush')) {
        node.alive = false;
        node.respawnTimer = node.kind === 'barrel' ? 60 : 45;
        node.group.visible = false;
        this.nodesGathered++;
        if (node.kind === 'berry_bush') {
          this.sound.playLoot();
          this.giveItemOrDrop('berries', 3);
          this.giveItemOrDrop('cloth', 4);
          this.notify('Foraged +3 Wild Berries · +4 Cloth', 'gain');
        } else if (node.kind === 'barrel') {
          this.sound.playLoot();
          this.giveItemOrDrop('barrel_item', 1);
          this.notify('Picked up Explosive Barrel! Place with [LMB] & shoot to detonate.', 'gain');
          this.combat.setEquippedItem(this.getEquippedVisual());
          this.saveProgress();
        } else {
          this.grantLootDrop(true);
        }
        this.pushHudSnapshot(true);
        return;
      }
    }

    for (const cf of this.building.campfires) {
      const d = Math.hypot(this.playerPos.x - cf.x, this.playerPos.z - cf.z);
      if (d < 3.5) {
        if (getItemCount(this.hotbar, this.backpack, this.resources, 'raw_fish') > 0) {
          consumeItem(this.hotbar, this.backpack, this.resources, 'raw_fish', 1);
          this.giveItemOrDrop('cooked_fish', 1);
          this.sound.playLoot();
          this.notify('Grilled 1× River Fish at Campfire!', 'gain', 'cook');
          this.combat.setEquippedItem(this.getEquippedVisual());
          this.saveProgress();
          this.pushHudSnapshot(true);
          return;
        }
        if (this.resources.raw_meat > 0) {
          this.resources.raw_meat -= 1;
          this.giveItemOrDrop('cooked_meat', 1);
          this.sound.playLoot();
          this.notify('Cooked 1× Meat at Campfire!', 'gain', 'cook');
          this.combat.setEquippedItem(this.getEquippedVisual());
          this.saveProgress();
          this.pushHudSnapshot(true);
          return;
        }
      }
    }

    // Proximity fallback so standing next to a Death Backpack & pressing [E] / Touch Interact loots all in one tap
    let nearestDeathBagId: string | null = null;
    let nearestDeathBagDist = 2.8;
    for (const db of this.combat.deathBackpacks) {
      const d = Math.hypot(this.playerPos.x - db.data.x, this.playerPos.z - db.data.z);
      if (d < nearestDeathBagDist && Math.abs(this.playerPos.y - PLAYER_EYE_HEIGHT - db.data.y) < 2.4) {
        nearestDeathBagDist = d;
        nearestDeathBagId = db.data.id;
      }
    }
    if (nearestDeathBagId && this.lootDeathBackpackById(nearestDeathBagId)) {
      return;
    }

    // Proximity fallback so standing next to a Camp Bed & pressing [E] ALWAYS registers it
    let nearestBed: (typeof this.building.beds)[number] | null = null;
    let nearestBedDist = 3.2;
    for (const bed of this.building.beds) {
      const d = Math.hypot(this.playerPos.x - bed.x, this.playerPos.z - bed.z);
      if (d < nearestBedDist && Math.abs(this.playerPos.y - PLAYER_EYE_HEIGHT - bed.y) < 2.2) {
        nearestBedDist = d;
        nearestBed = bed;
      }
    }
    if (nearestBed) {
      this.registeredBedId = nearestBed.id;
      this.sound.playLoot();
      this.notify('Camp Bed registered as respawn point!', 'gain');
      this.saveProgress();
      this.pushHudSnapshot(true);
    }
  }

  private updateInteractPrompt(): void {
    const equipped = this.getEquippedItem();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 4.4;

    const deathBagHits = this.raycaster.intersectObjects(this.combat.deathBackpackHitMeshes, false);
    if (deathBagHits.length > 0) {
      const bagId = deathBagHits[0].object.userData.deathBagId as string | undefined;
      const bag = bagId ? this.combat.deathBackpacks.find((b) => b.data.id === bagId) : undefined;
      if (bag) {
        this.interactPrompt = `[E] Loot Death Backpack (${bag.data.items.length} stacks)`;
        return;
      }
    }

    this.raycaster.far = 4.2;
    const dropHits = this.raycaster.intersectObjects(this.combat.droppedHitMeshes, false);
    if (dropHits.length > 0) {
      const did = dropHits[0].object.userData.dropId as string | undefined;
      const bag = this.combat.droppedBags.find((b) => b.data.id === did);
      if (bag) {
        this.interactPrompt = `[E] Pick Up ${bag.data.count}× ${ITEMS[bag.data.itemId].name}`;
        return;
      }
    }

    this.raycaster.far = 4.6;
    const bedHits = this.raycaster.intersectObjects(this.building.bedHitMeshes, false);
    if (bedHits.length > 0) {
      const bid = bedHits[0].object.userData.bedId as string | undefined;
      if (bid) {
        this.interactPrompt =
          this.registeredBedId === bid
            ? '[E] Spawn Bed Active (Re-register)'
            : '[E] Register Spawn Bed';
        return;
      }
    }

    this.raycaster.far = 4.4;
    const turretHits = this.raycaster.intersectObjects(this.building.turretHitMeshes, false);
    if (turretHits.length > 0) {
      const tid = turretHits[0].object.userData.turretId as string | undefined;
      const t = tid ? this.building.getTurretById(tid) : undefined;
      if (t) {
        this.interactPrompt = `[E] Pick Up Auto-Turret (${Math.round(t.hp)}/${t.maxHp} HP)`;
        return;
      }
    }

    this.raycaster.far = 4.4;
    const lanternHits = this.raycaster.intersectObjects(this.building.lanternHitMeshes, false);
    if (lanternHits.length > 0) {
      const lid = lanternHits[0].object.userData.lanternId as string | undefined;
      const ln = lid ? this.building.lanterns.find((l) => l.id === lid) : undefined;
      if (ln) {
        const label = ln.kind === 'floodlight' ? 'Bio-Floodlight Tower' : 'Sludge Lantern';
        this.interactPrompt = `[E] Pick Up ${label}`;
        return;
      }
    }

    this.raycaster.far = 4.4;
    const structLootHits = this.raycaster.intersectObjects(this.world.lootHitMeshes, false);
    if (structLootHits.length > 0) {
      const lid = structLootHits[0].object.userData.lootId as string | undefined;
      const container = lid ? this.world.lootContainers.find((c) => c.id === lid) : undefined;
      if (container) {
        this.interactPrompt = container.opened
          ? `${container.name} (Empty)`
          : `[E] Loot ${container.name}`;
        return;
      }
    }

    this.raycaster.far = 4.4;
    const chestHits = this.raycaster.intersectObjects(this.building.chestHitMeshes, false);
    if (chestHits.length > 0) {
      const cid = chestHits[0].object.userData.chestId as string | undefined;
      if (cid) {
        this.interactPrompt = '[E] Open Storage Chest (6×4)';
        return;
      }
    }

    this.raycaster.far = 4.2;
    const buildHits = this.raycaster.intersectObjects(this.building.hitMeshes, false);
    if (buildHits.length > 0) {
      const pid = buildHits[0].object.userData.pieceId as string | undefined;
      const piece = this.building.pieces.find((p) => p.id === pid);
      if (piece) {
        if (equipped === 'hammer') {
          if (piece.hp < piece.maxHp * 0.95) {
            this.interactPrompt = `[LMB] Repair (${Math.round(piece.hp)}/${piece.maxHp} HP)${piece.tier === 'twig' ? ' · [RMB] Demolish' : ''}`;
          } else {
            const check = canUpgradePiece(piece, this.resources);
            this.interactPrompt = `[LMB] ${check.reason} (${Math.round(piece.hp)}/${piece.maxHp} HP)${piece.tier === 'twig' ? ' · [RMB] Demolish' : ''}`;
          }
          return;
        }
        if (piece.type === 'doorway') {
          if (piece.hasDoor) {
            this.interactPrompt = piece.doorOpen ? '[E] Close Door' : '[E] Open Door';
            return;
          }
          if (getItemCount(this.hotbar, this.backpack, this.resources, 'door_item') > 0) {
            this.interactPrompt = '[E] Install Wooden Door';
            return;
          }
        }
      }
    }

    this.raycaster.far = 4.4;
    const placedBarrelHits = this.raycaster.intersectObjects(this.building.barrelHitMeshes, false);
    if (placedBarrelHits.length > 0) {
      const bid = placedBarrelHits[0].object.userData.barrelId as string | undefined;
      if (bid) {
        this.interactPrompt = '[E] Pick Up Explosive Barrel · Shoot to Detonate';
        return;
      }
    }

    this.raycaster.far = 4.2;
    const nodeHits = this.raycaster.intersectObjects(this.world.hitMeshes, false);
    if (nodeHits.length > 0) {
      const nid = nodeHits[0].object.userData.nodeId as string | undefined;
      const node = this.world.nodes.find((n) => n.id === nid);
      if (node && node.alive) {
        if (node.kind === 'barrel') {
          this.interactPrompt = '[E] Take Explosive Barrel · [LMB] Smash for Scrap';
          return;
        }
        if (node.kind === 'crate') {
          this.interactPrompt = '[E] / [LMB] Open Supply Crate';
          return;
        }
        if (node.kind === 'berry_bush') {
          this.interactPrompt = '[E] Forage Wild Berries';
          return;
        }
      }
    }

    for (const cf of this.building.campfires) {
      if (Math.hypot(this.playerPos.x - cf.x, this.playerPos.z - cf.z) < 3.5) {
        if (getItemCount(this.hotbar, this.backpack, this.resources, 'raw_fish') > 0) {
          this.interactPrompt = '[E] Grill Raw Fish at Campfire';
          return;
        }
        if (this.resources.raw_meat > 0) {
          this.interactPrompt = '[E] Cook Raw Meat at Campfire';
          return;
        }
      }
    }

    for (const db of this.combat.deathBackpacks) {
      if (
        Math.hypot(this.playerPos.x - db.data.x, this.playerPos.z - db.data.z) < 2.8 &&
        Math.abs(this.playerPos.y - PLAYER_EYE_HEIGHT - db.data.y) < 2.4
      ) {
        this.interactPrompt = `[E] Loot Death Backpack (${db.data.items.length} stacks)`;
        return;
      }
    }

    for (const bed of this.building.beds) {
      if (
        Math.hypot(this.playerPos.x - bed.x, this.playerPos.z - bed.z) < 3.0 &&
        Math.abs(this.playerPos.y - PLAYER_EYE_HEIGHT - bed.y) < 2.2
      ) {
        this.interactPrompt =
          this.registeredBedId === bed.id
            ? '[E] Spawn Bed Active (Re-register)'
            : '[E] Register Spawn Bed';
        return;
      }
    }

    this.interactPrompt = null;
  }

  private triggerHitmarker(crit: boolean): void {
    this.hitmarkerTimer = 0.14;
    this.hitmarkerCrit = crit;
    this.sound.playHitmarker(crit);
  }

  private handleActorKill(kind: EnemyKind): void {
    this.kills++;
    if (kind === 'wolf' || kind === 'bear' || kind === 'boar') {
      const meat = kind === 'bear' ? 4 : 2;
      const cloth = kind === 'bear' ? 12 : 8;
      this.giveItemOrDrop('raw_meat', meat);
      this.giveItemOrDrop('cloth', cloth);
      this.notify(`Harvested +${meat} Raw Meat · +${cloth} Cloth`, 'gain', 'kill');
    } else if (kind === 'sludge_crawler') {
      this.giveItemOrDrop('sludge', 14);
      this.giveItemOrDrop('metal_frags', 12);
      this.notify('Sludge Crawler slain! +14 Bio-Sludge · +12 Metal Frags', 'gain', 'kill');
    } else {
      const frags = kind === 'raider_juggernaut' ? 35 : 18;
      const ammo = kind === 'raider_juggernaut' ? 8 : 4;
      this.giveItemOrDrop('metal_frags', frags);
      this.giveItemOrDrop('ammo', ammo);
      this.giveItemOrDrop('sludge', kind === 'raider_juggernaut' ? 12 : 4);
      this.notify(`Raider eliminated! +${frags} Metal Frags · +${ammo} Ammo`, 'gain', 'kill');
    }
    this.saveProgress();
    this.pushHudSnapshot(true);
  }

  private damagePlayer(rawAmount: number, source: string): void {
    if (this.phase !== 'playing') return;
    if (this.isSandboxWorld() && this.sandbox.godMode) return;
    const isFall = source === 'High Fall';
    const defFraction = isFall ? 0 : getArmorDefense(this.armor);
    const amount = applyArmorMitigation(rawAmount, defFraction);
    if (!isFall && defFraction > 0) {
      const armorWear = damageEquippedArmor(this.armor, this.armorDurability, rawAmount);
      for (const brokenId of armorWear.brokenPieces) {
        this.notify(`${ITEMS[brokenId].name} broke!`, 'warn', 'armor_break');
      }
      if (armorWear.brokenPieces.length > 0) {
        this.saveProgress();
      }
    }
    this.health = Math.max(0, this.health - amount);
    this.trauma = Math.min(1, this.trauma + 0.38);
    this.sound.playPlayerHurt();
    this.notify(
      defFraction > 0
        ? `-${amount} HP (${source} · ${Math.round(defFraction * 100)}% Armor)`
        : `-${amount} HP (${source})`,
      'danger',
      'player_hurt',
    );
    if (this.health <= 0) {
      this.triggerGameOver(source);
    } else {
      this.pushHudSnapshot(true);
    }
  }

  private triggerGameOver(cause: string): void {
    this.resetFishing();
    if (this.currentWorld && this.hasChallenge('permadeath')) {
      deleteWorldFromStorage(this.currentWorld.id);
      this.refreshSavePresence();
    } else {
      // Pack all carried items (hotbar, backpack, equipped armor, non-zero resources) into a single Death Backpack
      const drops = collectDeathDrops(
        this.hotbar,
        this.backpack,
        this.resources,
        this.armor,
        this.armorDurability,
      );
      if (drops.length > 0) {
        const dx = this.playerPos.x;
        const dz = this.playerPos.z;
        const footY = this.playerPos.y - PLAYER_EYE_HEIGHT;
        const bldgFloor = this.building.getFloorHeightAt(dx, dz, footY + 0.5);
        const boxFloor = getWorldBoxFloorHeightAt(dx, dz, footY + 0.5, this.world.boxColliders);
        const structY =
          bldgFloor !== null && boxFloor !== null
            ? Math.max(bldgFloor, boxFloor)
            : (bldgFloor ?? boxFloor);
        const terrainY = this.world.groundHeightAt(dx, dz);
        const dy = structY !== null ? Math.max(terrainY, structY) : terrainY;
        this.combat.spawnDeathBackpack(drops, dx, dy, dz);
      }
      this.armor = createInitialArmor();
      this.armorDurability = createInitialArmorDurability();
      this.hotbar = createInitialHotbar();
      this.backpack = createInitialBackpack();
      this.resources = createInitialResources();
      this.selectedHotbarIndex = 0;
      this.combat.setEquippedItem(this.getEquippedVisual());
      this.saveProgress();
    }
    this.phase = 'gameover';
    document.body.dataset.state = 'gameover';
    this.craftingOpen = false;
    this.radialMenuOpen = false;
    this.activeChestId = null;
    this.sandboxMenuOpen = false;
    this.clearInputs();
    this.sound.setActive(false);
    document.exitPointerLock?.();
    this.gameOverStats = {
      daysSurvived: this.dayCount,
      nightsSurvived: this.nightsSurvived,
      playTimeSec: Math.floor(this.playTimeSec),
      kills: this.kills,
      piecesBuilt: this.piecesBuilt,
      nodesGathered: this.nodesGathered,
      causeOfDeath: cause,
    };
    this.pushHudSnapshot(true);
  }

  private getEquippedItem(): ItemId | null {
    return this.hotbar[this.selectedHotbarIndex]?.itemId ?? null;
  }

  private getEquippedVisual(): EquippedVisualId {
    return this.getEquippedItem() ?? 'hand';
  }

  private pushHudSnapshot(force = false, wildlifeCount = 0, raiderCount = 0): void {
    const now = performance.now();
    if (!force && now - this.lastHudPushTime < 95) return;
    this.lastHudPushTime = now;

    const equipped = this.getEquippedItem();
    const modalsOpen = this.isModalsOpen();
    const sniperScoped =
      this.phase === 'playing' &&
      equipped === 'sniper_rifle' &&
      this.aiming &&
      !modalsOpen;

    const activeChest = this.activeChestId ? this.building.getChestById(this.activeChestId) : null;

    this.onHudUpdate({
      phase: this.phase,
      currentWorld: this.currentWorld
        ? { ...this.currentWorld, challenges: [...this.currentWorld.challenges] }
        : null,
      savedWorlds: [...this.savedWorlds],
      hasSavedGame: this.hasSavedGame,
      savedDayCount: this.savedDayCount,
      pointerLocked: this.pointerLocked,
      inCave: Boolean(this.activeCaveName),
      caveName: this.activeCaveName,
      undergroundDepth: this.undergroundDepth,
      inWater: this.inWater,
      inDeepWater: this.inDeepWater,
      breath: Math.round(this.breath),
      maxBreath: this.maxBreath,
      fishingState: this.fishingState,
      speedBoostActive: this.speedBoostTimer > 0,
      sniperScoped,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      hunger: Math.round(this.hunger),
      maxHunger: this.maxHunger,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      armor: { ...this.armor },
      armorDurability: { ...this.armorDurability },
      armorDefensePct: Math.round(getArmorDefense(this.armor) * 100),
      timeOfDay: this.dayTime,
      dayCount: this.dayCount,
      nightsSurvived: this.nightsSurvived,
      playTimeSec: Math.floor(this.playTimeSec),
      isNight: isNightTime(this.dayTime),
      nightType: this.nightType,
      fps: this.currentFps,
      quality: this.quality,
      shadersEnabled: this.shadersEnabled,
      muted: this.sound.isMuted(),
      settings: { ...this.settings },
      activeControlMode: this.activeControlMode,
      torchOn: this.torchOn,
      aiming: this.aiming,
      selectedHotbarIndex: this.selectedHotbarIndex,
      hotbar: this.hotbar.map((s) => ({ ...s })),
      backpack: this.backpack.map((s) => ({ ...s })),
      resources: { ...this.resources },
      selectedBuildPiece: this.selectedBuildPiece,
      buildPreviewValid: this.building.currentPlacementValid,
      buildPreviewReason: this.building.currentPlacementReason,
      hasRegisteredBed: Boolean(
        this.registeredBedId && this.building.beds.some((b) => b.id === this.registeredBedId),
      ),
      interactPrompt: this.interactPrompt,
      hitmarkerActive: this.hitmarkerTimer > 0,
      hitmarkerCrit: this.hitmarkerCrit,
      craftingOpen: this.craftingOpen,
      radialMenuOpen: this.radialMenuOpen,
      activeChestId: activeChest ? activeChest.id : null,
      activeChestSlots: activeChest ? activeChest.slots.map((s) => ({ ...s })) : null,
      sandboxUnlocked: this.metaProgress.sandboxUnlocked,
      maxNightsSurvived: Math.max(
        this.metaProgress.totalNightsSurvived,
        this.metaProgress.maxNightsSurvived,
      ),
      sandboxMenuOpen: this.sandboxMenuOpen,
      sandbox: { ...this.sandbox },
      raidersAlive: raiderCount,
      wildlifeAlive: wildlifeCount,
      kills: this.kills,
      piecesBuilt: this.piecesBuilt,
      nodesGathered: this.nodesGathered,
      notifications: this.notifications.map(({ id, text, tone, expiresAt }) => ({
        id,
        text,
        tone,
        expiresAt,
      })),
      gameOverStats: this.gameOverStats ? { ...this.gameOverStats } : null,
    });
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.shaders.resize(w, h);

    if (this.settings.controlMode === 'auto') {
      const nextIsPhone = probeDeviceIsPhone();
      const nextMode = resolveControlMode('auto', nextIsPhone);
      if (nextMode !== this.activeControlMode) {
        this.isPhoneDevice = nextIsPhone;
        this.activeControlMode = nextMode;
        if (nextMode === 'phone') {
          document.exitPointerLock?.();
        }
        this.clearInputs();
        this.pushHudSnapshot(true);
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Allow typing inside world name / seed inputs on title screen
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (this.phase === 'title') {
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') {
        if (this.isModalsOpen()) {
          this.closeMenus();
        } else {
          this.pauseGame();
        }
        return;
      } else if (this.phase === 'paused' && e.code === 'KeyP') {
        this.resumeGame();
        return;
      }
    }

    if (this.phase !== 'playing') return;

    if (e.code === 'Tab' || e.code === 'KeyB') {
      e.preventDefault();
      this.toggleCrafting();
      return;
    }

    if (e.code === 'KeyQ') {
      e.preventDefault();
      this.toggleRadialMenu();
      return;
    }

    if (e.code === 'KeyK' && this.isSandboxWorld()) {
      e.preventDefault();
      this.toggleSandboxMenu();
      return;
    }

    if (e.code === 'KeyV' && this.isSandboxWorld() && !this.isModalsOpen()) {
      this.updateSandbox({ flyMode: !this.sandbox.flyMode });
      this.notify(this.sandbox.flyMode ? 'Fly Mode ON ([Space] up, [C] down)' : 'Fly Mode OFF', 'info', 'sandbox');
      return;
    }

    if (e.code === 'KeyX') {
      if (this.isModalsOpen()) return;
      e.preventDefault();
      this.dropSlot({ area: 'hotbar', index: this.selectedHotbarIndex }, false);
      return;
    }

    if (e.code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (e.code === 'KeyG') {
      this.toggleQuality();
      return;
    }

    if (e.code === 'KeyF') {
      this.toggleTorch();
      return;
    }

    if (e.code === 'KeyR') {
      if (this.getEquippedItem() === 'building_plan') {
        this.buildRotSteps = (this.buildRotSteps + 1) % 8;
        this.sound.playUiClick();
      }
      return;
    }

    if (e.code === 'KeyE') {
      this.interactJustPressed = true;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!this.keysHeld.has('Space')) {
        this.jumpBufferTimer = 0.12;
      }
    }

    if (e.code >= 'Digit1' && e.code <= 'Digit6') {
      const idx = Number(e.code.replace('Digit', '')) - 1;
      this.selectHotbar(idx);
    }

    this.keysHeld.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    if (this.activeControlMode === 'phone') return;
    if (this.pointerLocked || this.mouseRightHeld) {
      const isSniperScoped = this.getEquippedItem() === 'sniper_rifle' && this.aiming;
      const baseSens = isSniperScoped ? 0.0007 : this.aiming ? 0.0014 : 0.0022;
      const sens = baseSens * this.settings.mouseSensitivity;
      const ySign = this.settings.invertY ? -1 : 1;
      this.yaw -= e.movementX * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * sens * ySign,
        -Math.PI * 0.46,
        Math.PI * 0.46,
      );
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    if (Math.abs(e.deltaY) < 2) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (this.selectedHotbarIndex + dir + this.hotbar.length) % this.hotbar.length;
    this.selectHotbar(next);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || this.isModalsOpen()) return;
    if (this.activeControlMode === 'phone') return;
    if (e.target !== this.renderer.domElement) return;

    this.sound.unlock();
    this.sound.setActive(true);
    if (!this.pointerLocked) {
      this.requestPointerLockSafe();
    }

    if (e.button === 0) {
      this.mouseLeftHeld = true;
      this.mouseLeftJustPressed = true;
    } else if (e.button === 2) {
      this.mouseRightHeld = true;
      this.mouseRightJustPressed = true;
      if (this.getEquippedItem() === 'building_plan') {
        this.buildRotSteps = (this.buildRotSteps + 1) % 8;
        this.sound.playUiClick();
      }
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeftHeld = false;
    if (e.button === 2) this.mouseRightHeld = false;
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.pushHudSnapshot(true);
  };

  private onWindowBlur = (): void => {
    this.clearInputs();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);

    this.sound.dispose();
    this.shaders.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
