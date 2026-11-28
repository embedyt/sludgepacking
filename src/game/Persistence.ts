import { ITEMS, SANDBOX_REQUIRED_NIGHTS } from './gameData';
import { createInitialArmor } from './rules';
import type {
  DeathBackpackData,
  DeathBackpackItem,
  EquippedArmor,
  EquippedArmorDurability,
  GameSettings,
  InventorySlot,
  ItemId,
  MetaProgress,
  SaveGameData,
  WorldConfig,
  WorldSummary,
} from '../types/game';

const WORLDS_INDEX_KEY = 'sludge_worlds_index_v1';
const WORLD_SAVE_PREFIX = 'sludge_world_save_v1_';
const LEGACY_SAVE_KEY = 'sludge_survival_save_v1';
const SETTINGS_KEY = 'sludge_settings_v1';
const META_PROGRESS_KEY = 'sludge_meta_progress_v1';

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  quality: 'high',
  shadersEnabled: true,
  muted: false,
  masterVolume: 0.45,
  sfxVolume: 0.85,
  ambientVolume: 0.55,
  mouseSensitivity: 1.0,
  brightness: 1.08,
  fov: 72,
  invertY: false,
  showFps: true,
  compactPopups: false,
  controlMode: 'auto',
};

function clampNumber(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

export function loadStoredSettings(): GameSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_GAME_SETTINGS };
    }
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const controlMode =
      parsed.controlMode === 'pc' || parsed.controlMode === 'phone' || parsed.controlMode === 'auto'
        ? parsed.controlMode
        : DEFAULT_GAME_SETTINGS.controlMode;
    return {
      quality: parsed.quality === 'low' ? 'low' : 'high',
      shadersEnabled:
        typeof parsed.shadersEnabled === 'boolean'
          ? parsed.shadersEnabled
          : DEFAULT_GAME_SETTINGS.shadersEnabled,
      muted: Boolean(parsed.muted),
      masterVolume: clampNumber(parsed.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume, 0, 1),
      sfxVolume: clampNumber(parsed.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume, 0, 1),
      ambientVolume: clampNumber(parsed.ambientVolume, DEFAULT_GAME_SETTINGS.ambientVolume, 0, 1),
      mouseSensitivity: clampNumber(parsed.mouseSensitivity, DEFAULT_GAME_SETTINGS.mouseSensitivity, 0.25, 3.0),
      brightness: clampNumber(parsed.brightness, DEFAULT_GAME_SETTINGS.brightness, 0.65, 1.65),
      fov: clampNumber(parsed.fov, DEFAULT_GAME_SETTINGS.fov, 60, 100),
      invertY: Boolean(parsed.invertY),
      showFps: typeof parsed.showFps === 'boolean' ? parsed.showFps : DEFAULT_GAME_SETTINGS.showFps,
      compactPopups: Boolean(parsed.compactPopups),
      controlMode,
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveStoredSettings(settings: GameSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function loadMetaProgress(): MetaProgress {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { maxNightsSurvived: 0, totalNightsSurvived: 0, sandboxUnlocked: false };
    }
    const raw = window.localStorage.getItem(META_PROGRESS_KEY);
    if (!raw) return { maxNightsSurvived: 0, totalNightsSurvived: 0, sandboxUnlocked: false };
    const parsed = JSON.parse(raw) as Partial<MetaProgress>;
    const best = Math.max(0, Math.floor(parsed.maxNightsSurvived ?? 0));
    const total = Math.max(best, Math.floor(parsed.totalNightsSurvived ?? best));
    const unlocked = Boolean(parsed.sandboxUnlocked) || total >= SANDBOX_REQUIRED_NIGHTS;
    return {
      maxNightsSurvived: best,
      totalNightsSurvived: total,
      sandboxUnlocked: unlocked,
    };
  } catch {
    return { maxNightsSurvived: 0, totalNightsSurvived: 0, sandboxUnlocked: false };
  }
}

export function saveMetaProgress(meta: MetaProgress): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(META_PROGRESS_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function recordNightSurvivedMeta(nightsSurvived: number): MetaProgress {
  const prev = loadMetaProgress();
  const cleanWorldNights = Math.max(0, Math.floor(nightsSurvived));
  const maxNightsSurvived = Math.max(prev.maxNightsSurvived, cleanWorldNights);
  const totalNightsSurvived = Math.max(prev.totalNightsSurvived, cleanWorldNights);
  const next: MetaProgress = {
    maxNightsSurvived,
    totalNightsSurvived,
    sandboxUnlocked: prev.sandboxUnlocked || totalNightsSurvived >= SANDBOX_REQUIRED_NIGHTS,
  };
  saveMetaProgress(next);
  return next;
}

export function recordNightCompletedMeta(currentWorldNightsSurvived = 0): MetaProgress {
  const prev = loadMetaProgress();
  const totalNightsSurvived = prev.totalNightsSurvived + 1;
  const maxNightsSurvived = Math.max(
    prev.maxNightsSurvived,
    Math.max(0, Math.floor(currentWorldNightsSurvived)),
  );
  const next: MetaProgress = {
    maxNightsSurvived,
    totalNightsSurvived,
    sandboxUnlocked: prev.sandboxUnlocked || totalNightsSurvived >= SANDBOX_REQUIRED_NIGHTS,
  };
  saveMetaProgress(next);
  return next;
}

export function resetAllSavedData(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [
      WORLDS_INDEX_KEY,
      SETTINGS_KEY,
      META_PROGRESS_KEY,
      LEGACY_SAVE_KEY,
    ];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(WORLD_SAVE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function migrateLegacySaveIfNeeded(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const legacyRaw = window.localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw) as Partial<SaveGameData>;
    if (!legacy || !legacy.player || !legacy.progress || !legacy.hotbar || !legacy.resources) {
      window.localStorage.removeItem(LEGACY_SAVE_KEY);
      return;
    }
    const worldConfig: WorldConfig = {
      id: 'legacy_island_1',
      name: 'Starter Island',
      seed: 'SLUDGE-42019',
      difficulty: 'standard',
      challenges: [],
      createdAt: legacy.savedAt ?? Date.now(),
    };
    const migrated: SaveGameData = {
      version: 3,
      savedAt: legacy.savedAt ?? Date.now(),
      world: worldConfig,
      player: legacy.player,
      progress: {
        ...legacy.progress,
        nightsSurvived: legacy.progress.nightsSurvived ?? Math.max(0, (legacy.progress.dayCount ?? 1) - 1),
        playTimeSec: legacy.progress.playTimeSec ?? 0,
      },
      armor: legacy.armor ?? createInitialArmor(),
      hotbar: legacy.hotbar,
      backpack: legacy.backpack ?? [],
      selectedHotbarIndex: legacy.selectedHotbarIndex ?? 0,
      resources: legacy.resources,
      pieces: legacy.pieces ?? [],
      props: legacy.props ?? [],
      chests: legacy.chests ?? {},
      droppedItems: legacy.droppedItems ?? [],
      sandbox: legacy.sandbox,
    };
    saveWorldToStorage(migrated);
    window.localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // ignore
  }
}

export function listSavedWorlds(): WorldSummary[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    migrateLegacySaveIfNeeded();
    const raw = window.localStorage.getItem(WORLDS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as WorldSummary[])
      .map((w) => ({
        ...w,
        nightsSurvived: w.nightsSurvived ?? Math.max(0, (w.dayCount ?? 1) - 1),
        playTimeSec: w.playTimeSec ?? 0,
      }))
      .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
  } catch {
    return [];
  }
}

export function saveWorldToStorage(data: SaveGameData): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const worldId = data.world.id;
    const normalized: SaveGameData = {
      ...data,
      version: 3,
      progress: {
        ...data.progress,
        nightsSurvived: data.progress.nightsSurvived ?? Math.max(0, data.progress.dayCount - 1),
        playTimeSec: data.progress.playTimeSec ?? 0,
      },
      chests: data.chests ?? {},
      deathBackpacks: data.deathBackpacks ?? [],
    };
    window.localStorage.setItem(`${WORLD_SAVE_PREFIX}${worldId}`, JSON.stringify(normalized));

    const existing = listSavedWorlds().filter((w) => w.id !== worldId);
    const summary: WorldSummary = {
      ...normalized.world,
      dayCount: normalized.progress.dayCount,
      nightsSurvived: normalized.progress.nightsSurvived ?? 0,
      playTimeSec: normalized.progress.playTimeSec ?? 0,
      kills: normalized.progress.kills,
      piecesBuilt: normalized.progress.piecesBuilt,
      lastPlayedAt: normalized.savedAt,
    };
    existing.unshift(summary);
    window.localStorage.setItem(WORLDS_INDEX_KEY, JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

function normalizeSlotList(slots: InventorySlot[]): InventorySlot[] {
  return slots.map((s) => {
    const rawId = s?.itemId as string | null | undefined;
    if (!rawId || rawId === 'rock' || !(rawId in ITEMS)) {
      return { itemId: null, count: 0 };
    }
    const def = ITEMS[rawId as keyof typeof ITEMS];
    const maxDur = def.maxDurability;
    const out: InventorySlot = {
      itemId: def.id,
      count: Math.max(1, s.count || 1),
    };
    if (maxDur !== undefined && maxDur > 0 && def.stackMax === 1) {
      out.maxDurability = s.maxDurability ?? maxDur;
      out.durability = s.durability !== undefined ? Math.min(out.maxDurability, Math.max(1, s.durability)) : out.maxDurability;
    }
    return out;
  });
}

function normalizeDeathBackpacks(raw: unknown): DeathBackpackData[] {
  if (!Array.isArray(raw)) return [];
  const out: DeathBackpackData[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Partial<DeathBackpackData>;
    if (typeof obj.id !== 'string' || !Array.isArray(obj.items)) continue;
    const items: DeathBackpackItem[] = [];
    for (const it of obj.items) {
      if (!it || typeof it !== 'object') continue;
      const rawId = it.itemId as string | undefined;
      if (!rawId || !(rawId in ITEMS)) continue;
      const def = ITEMS[rawId as ItemId];
      const item: DeathBackpackItem = {
        itemId: def.id,
        count: Math.max(1, Math.floor(it.count || 1)),
      };
      if (
        it.equippedArmorSlot === 'head' ||
        it.equippedArmorSlot === 'chest' ||
        it.equippedArmorSlot === 'legs'
      ) {
        item.equippedArmorSlot = it.equippedArmorSlot;
      }
      if (def.maxDurability && def.maxDurability > 0) {
        item.maxDurability = it.maxDurability ?? def.maxDurability;
        item.durability =
          typeof it.durability === 'number' && Number.isFinite(it.durability)
            ? Math.min(item.maxDurability, Math.max(1, it.durability))
            : item.maxDurability;
      }
      items.push(item);
    }
    if (items.length === 0) continue;
    out.push({
      id: obj.id,
      x: typeof obj.x === 'number' && Number.isFinite(obj.x) ? obj.x : 0,
      y: typeof obj.y === 'number' && Number.isFinite(obj.y) ? obj.y : 0,
      z: typeof obj.z === 'number' && Number.isFinite(obj.z) ? obj.z : 0,
      createdAt: typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : Date.now(),
      items,
    });
  }
  return out;
}

export function loadWorldFromStorage(worldId: string): SaveGameData | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${WORLD_SAVE_PREFIX}${worldId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveGameData>;
    if (
      !parsed ||
      !parsed.world ||
      !parsed.player ||
      !parsed.progress ||
      !Array.isArray(parsed.hotbar) ||
      !Array.isArray(parsed.backpack) ||
      !parsed.resources
    ) {
      return null;
    }
    const rawChests = parsed.chests ?? {};
    const chests: Record<string, InventorySlot[]> = {};
    for (const [k, v] of Object.entries(rawChests)) {
      if (Array.isArray(v)) chests[k] = normalizeSlotList(v);
    }
    const armor: EquippedArmor = { ...createInitialArmor(), ...(parsed.armor ?? {}) };
    const rawArmorDur = parsed.armorDurability ?? {};
    const armorDurability: EquippedArmorDurability = {};
    for (const slotKey of ['head', 'chest', 'legs'] as const) {
      const eqId = armor[slotKey];
      if (eqId && ITEMS[eqId]?.maxDurability) {
        const maxDur = ITEMS[eqId].maxDurability!;
        const stored = rawArmorDur[slotKey];
        armorDurability[slotKey] =
          typeof stored === 'number' && Number.isFinite(stored)
            ? Math.min(maxDur, Math.max(1, stored))
            : maxDur;
      }
    }
    return {
      ...(parsed as SaveGameData),
      hotbar: normalizeSlotList(parsed.hotbar),
      backpack: normalizeSlotList(parsed.backpack),
      progress: {
        ...parsed.progress,
        nightsSurvived: parsed.progress.nightsSurvived ?? Math.max(0, (parsed.progress.dayCount ?? 1) - 1),
        playTimeSec: parsed.progress.playTimeSec ?? 0,
      },
      armor,
      armorDurability,
      chests,
      openedLootIds: Array.isArray(parsed.openedLootIds) ? parsed.openedLootIds : [],
      deathBackpacks: normalizeDeathBackpacks(parsed.deathBackpacks),
    };
  } catch {
    return null;
  }
}

export function deleteWorldFromStorage(worldId: string): WorldSummary[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    window.localStorage.removeItem(`${WORLD_SAVE_PREFIX}${worldId}`);
    const next = listSavedWorlds().filter((w) => w.id !== worldId);
    window.localStorage.setItem(WORLDS_INDEX_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
