export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type QualityPreset = 'high' | 'low';

export type DifficultyLevel = 'chill' | 'standard' | 'brutal';

export type ChallengeId = 'no_regen' | 'no_heal' | 'permadeath' | 'blood_moon';

export type SurvivalModeTier =
  | 'chill'
  | 'standard'
  | 'brutal'
  | 'hardcore'
  | 'ultrahardcore'
  | 'true_hardcore'
  | 'sandbox';

export type HpPatternTier = 'none' | 'brutal' | 'hardcore' | 'ultrahardcore' | 'true_hardcore';

export type ArmorSlotType = 'head' | 'chest' | 'legs';

export interface EquippedArmor {
  head: ItemId | null;
  chest: ItemId | null;
  legs: ItemId | null;
}

export interface EquippedArmorDurability {
  head?: number;
  chest?: number;
  legs?: number;
}

export interface WorldConfig {
  id: string;
  name: string;
  seed: string;
  difficulty: DifficultyLevel;
  challenges: ChallengeId[];
  sandbox?: boolean;
  createdAt: number;
}

export interface WorldSummary extends WorldConfig {
  dayCount: number;
  nightsSurvived: number;
  playTimeSec: number;
  kills: number;
  piecesBuilt: number;
  lastPlayedAt: number;
}

export type ControlModeSetting = 'auto' | 'pc' | 'phone';

export type ActiveControlMode = 'pc' | 'phone';

export interface GameSettings {
  quality: QualityPreset;
  shadersEnabled: boolean;
  muted: boolean;
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  mouseSensitivity: number;
  brightness: number;
  fov: number;
  invertY: boolean;
  showFps: boolean;
  compactPopups: boolean;
  controlMode: ControlModeSetting;
}

export interface MetaProgress {
  maxNightsSurvived: number;
  totalNightsSurvived: number;
  sandboxUnlocked: boolean;
}

export type NightType = 'pitch_dark' | 'overcast' | 'moonlit';

export interface SandboxState {
  flyMode: boolean;
  godMode: boolean;
  freeBuild: boolean;
  freezeTime: boolean;
  speedMult: number;
  jumpMult: number;
  timeScale: number;
}

export type ItemId =
  | 'wood_pickaxe'
  | 'torch'
  | 'flashlight_basic'
  | 'flashlight_tactical'
  | 'flashlight_sludge'
  | 'hatchet'
  | 'pickaxe'
  | 'salvaged_axe'
  | 'salvaged_pick'
  | 'fishing_rod'
  | 'building_plan'
  | 'hammer'
  | 'bow'
  | 'crossbow'
  | 'arrow'
  | 'pipe_shotgun'
  | 'revolver'
  | 'smg'
  | 'sniper_rifle'
  | 'ammo'
  | 'grenade'
  | 'cooked_meat'
  | 'raw_meat'
  | 'raw_fish'
  | 'cooked_fish'
  | 'berries'
  | 'medkit'
  | 'sludge_stim'
  | 'burlap_hood'
  | 'burlap_vest'
  | 'burlap_pants'
  | 'wood_helmet'
  | 'wood_chestplate'
  | 'wood_greaves'
  | 'sludge_helmet'
  | 'sludge_armor'
  | 'sludge_greaves'
  | 'door_item'
  | 'chest_item'
  | 'campfire_item'
  | 'lantern_item'
  | 'floodlight_item'
  | 'barricade_item'
  | 'bed_item'
  | 'barrel_item'
  | 'turret_item'
  | 'wood'
  | 'stone'
  | 'metal_ore'
  | 'metal_frags'
  | 'sulfur'
  | 'cloth'
  | 'sludge';

export type EquippedVisualId = ItemId | 'hand';

export type ItemCategory =
  | 'tool'
  | 'weapon'
  | 'armor'
  | 'ammo'
  | 'building'
  | 'consumable'
  | 'resource';

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  stackMax: number;
  hotkeyRole: string;
  description: string;
  damage?: number;
  gatherPower?: number;
  range?: number;
  cooldown?: number;
  maxDurability?: number;
  lightRadius?: number;
  lightIntensity?: number;
  healAmount?: number;
  hungerAmount?: number;
  armorSlot?: ArmorSlotType;
  armorReduction?: number;
}

export interface InventorySlot {
  itemId: ItemId | null;
  count: number;
  durability?: number;
  maxDurability?: number;
}

export interface RecipeIngredient {
  itemId: ItemId;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  outputItem: ItemId;
  outputCount: number;
  category: 'Tools' | 'Armor' | 'Building' | 'Weapons' | 'Survival';
  ingredients: RecipeIngredient[];
  craftTimeSec: number;
}

export type BuildPieceType =
  | 'foundation'
  | 'wall'
  | 'doorway'
  | 'window_wall'
  | 'floor'
  | 'stairs';

export type BuildTier = 'twig' | 'wood' | 'stone';

export interface BuildPieceDef {
  type: BuildPieceType;
  label: string;
  hotkey: string;
  twigCost: number;
  role: string;
}

export interface PlacedBuildPiece {
  id: string;
  type: BuildPieceType;
  tier: BuildTier;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  maxHp: number;
  hasDoor?: boolean;
  doorOpen?: boolean;
}

export interface PlacedPropData {
  id: string;
  kind: 'campfire' | 'lantern' | 'floodlight' | 'barricade' | 'bed' | 'explosive_barrel' | 'chest' | 'turret';
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
}

export interface DroppedItemData {
  id: string;
  itemId: ItemId;
  count: number;
  x: number;
  y: number;
  z: number;
  durability?: number;
  maxDurability?: number;
}

export interface DeathBackpackItem {
  itemId: ItemId;
  count: number;
  durability?: number;
  maxDurability?: number;
  equippedArmorSlot?: ArmorSlotType;
}

export interface DeathBackpackData {
  id: string;
  x: number;
  y: number;
  z: number;
  createdAt: number;
  items: DeathBackpackItem[];
}

export interface ResourceBag {
  wood: number;
  stone: number;
  metal_ore: number;
  metal_frags: number;
  sulfur: number;
  cloth: number;
  raw_meat: number;
  sludge: number;
}

export interface HudNotification {
  id: number;
  text: string;
  tone: 'gain' | 'warn' | 'danger' | 'info';
  expiresAt: number;
}

export interface GameStatsSnapshot {
  daysSurvived: number;
  nightsSurvived: number;
  playTimeSec: number;
  kills: number;
  piecesBuilt: number;
  nodesGathered: number;
  causeOfDeath?: string;
}

export interface SaveGameData {
  version: number;
  savedAt: number;
  world: WorldConfig;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    stamina: number;
    torchOn: boolean;
  };
  progress: {
    dayTime: number;
    dayCount: number;
    nightsSurvived: number;
    playTimeSec: number;
    kills: number;
    piecesBuilt: number;
    nodesGathered: number;
  };
  armor: EquippedArmor;
  armorDurability?: EquippedArmorDurability;
  hotbar: InventorySlot[];
  backpack: InventorySlot[];
  selectedHotbarIndex: number;
  resources: ResourceBag;
  pieces: PlacedBuildPiece[];
  props: PlacedPropData[];
  chests?: Record<string, InventorySlot[]>;
  openedLootIds?: string[];
  droppedItems: DroppedItemData[];
  deathBackpacks?: DeathBackpackData[];
  registeredBedId?: string | null;
  sandbox?: SandboxState;
}

export type FishingState = 'idle' | 'waiting' | 'bite';

export interface HudSnapshot {
  phase: GamePhase;
  currentWorld: WorldConfig | null;
  savedWorlds: WorldSummary[];
  hasSavedGame: boolean;
  savedDayCount: number;
  pointerLocked: boolean;
  inCave: boolean;
  caveName: string | null;
  undergroundDepth: number;
  inWater: boolean;
  inDeepWater: boolean;
  breath: number;
  maxBreath: number;
  fishingState: FishingState;
  speedBoostActive: boolean;
  sniperScoped: boolean;
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  stamina: number;
  maxStamina: number;
  armor: EquippedArmor;
  armorDurability: EquippedArmorDurability;
  armorDefensePct: number;
  timeOfDay: number;
  dayCount: number;
  nightsSurvived: number;
  playTimeSec: number;
  isNight: boolean;
  nightType: NightType;
  fps: number;
  settings: GameSettings;
  activeControlMode: ActiveControlMode;
  quality: QualityPreset;
  shadersEnabled: boolean;
  muted: boolean;
  torchOn: boolean;
  aiming: boolean;
  hasRegisteredBed: boolean;
  selectedHotbarIndex: number;
  hotbar: InventorySlot[];
  backpack: InventorySlot[];
  resources: ResourceBag;
  selectedBuildPiece: BuildPieceType;
  buildPreviewValid: boolean;
  buildPreviewReason: string;
  interactPrompt: string | null;
  hitmarkerActive: boolean;
  hitmarkerCrit: boolean;
  craftingOpen: boolean;
  radialMenuOpen: boolean;
  activeChestId: string | null;
  activeChestSlots: InventorySlot[] | null;
  sandboxUnlocked: boolean;
  maxNightsSurvived: number;
  sandboxMenuOpen: boolean;
  sandbox: SandboxState;
  raidersAlive: number;
  wildlifeAlive: number;
  kills: number;
  piecesBuilt: number;
  nodesGathered: number;
  notifications: HudNotification[];
  gameOverStats: GameStatsSnapshot | null;
}
