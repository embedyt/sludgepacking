import {
  BACKPACK_SIZE,
  CHEST_SIZE,
  FLOOR_THICKNESS,
  FOUNDATION_HEIGHT,
  GAME_VERSION_MOBILE,
  GAME_VERSION_PC,
  GRID_SIZE,
  HOTBAR_SIZE,
  ITEMS,
  TIER_MAX_HP,
  TIER_UPGRADE_COST,
  WALL_HEIGHT,
  getBuildPieceDef,
} from './gameData';
import type {
  ActiveControlMode,
  ArmorSlotType,
  BuildPieceType,
  BuildTier,
  ChallengeId,
  ControlModeSetting,
  CraftingRecipe,
  DeathBackpackItem,
  DifficultyLevel,
  EquippedArmor,
  EquippedArmorDurability,
  HpPatternTier,
  InventorySlot,
  ItemId,
  NightType,
  PlacedBuildPiece,
  RecipeIngredient,
  ResourceBag,
  SurvivalModeTier,
} from '../types/game';

export const RESOURCE_KEYS: ReadonlyArray<keyof ResourceBag> = [
  'wood',
  'stone',
  'metal_ore',
  'metal_frags',
  'sulfur',
  'cloth',
  'raw_meat',
  'sludge',
];

export function isResourceKey(id: ItemId): id is keyof ResourceBag {
  return (RESOURCE_KEYS as readonly string[]).includes(id);
}

export interface SurvivalModeInfo {
  tier: SurvivalModeTier;
  label: string;
  hpPatternTier: HpPatternTier;
  challengeCount: number;
  challengeBadge: string | null;
}

export function getSurvivalModeInfo(
  difficulty: DifficultyLevel,
  challenges: ReadonlyArray<ChallengeId>,
  sandbox = false,
): SurvivalModeInfo {
  if (sandbox) {
    return {
      tier: 'sandbox',
      label: 'Sandbox',
      hpPatternTier: 'none',
      challengeCount: challenges.length,
      challengeBadge: null,
    };
  }

  const hasPermadeath = challenges.includes('permadeath');
  const hasNoRegen = challenges.includes('no_regen');
  const hasNoHeal = challenges.includes('no_heal');
  const hasBloodMoon = challenges.includes('blood_moon');
  const count = challenges.length;
  const challengeBadge = count > 0 ? `${count} ${count === 1 ? 'Challenge' : 'Challenges'}` : null;

  if (hasPermadeath) {
    if (hasNoRegen && (hasNoHeal || hasBloodMoon)) {
      return {
        tier: 'true_hardcore',
        label: 'True Hardcore',
        hpPatternTier: 'true_hardcore',
        challengeCount: count,
        challengeBadge,
      };
    }
    if (hasNoRegen) {
      return {
        tier: 'ultrahardcore',
        label: 'Ultrahardcore',
        hpPatternTier: 'ultrahardcore',
        challengeCount: count,
        challengeBadge,
      };
    }
    return {
      tier: 'hardcore',
      label: 'Hardcore',
      hpPatternTier: 'hardcore',
      challengeCount: count,
      challengeBadge,
    };
  }

  if (hasNoHeal || hasBloodMoon || difficulty === 'brutal') {
    return {
      tier: 'brutal',
      label: 'Brutal',
      hpPatternTier: 'brutal',
      challengeCount: count,
      challengeBadge,
    };
  }

  if (difficulty === 'chill' && count === 0) {
    return {
      tier: 'chill',
      label: 'Chill',
      hpPatternTier: 'none',
      challengeCount: 0,
      challengeBadge: null,
    };
  }

  return {
    tier: 'standard',
    label: 'Standard',
    hpPatternTier: 'none',
    challengeCount: count,
    challengeBadge,
  };
}

export function formatPlayTime(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const rem = secs % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
  }
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}

export function hashSeedString(seed: string): number {
  const clean = seed.trim() || 'sludge-island';
  let h = 2166136261 >>> 0;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 42019;
}

export function generateRandomSeedCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `SLUDGE-${num}`;
}

export function createInitialHotbar(): InventorySlot[] {
  return Array.from({ length: HOTBAR_SIZE }, () => ({ itemId: null, count: 0 }));
}

export function createInitialBackpack(): InventorySlot[] {
  return Array.from({ length: BACKPACK_SIZE }, () => ({ itemId: null, count: 0 }));
}

export function createInitialChestSlots(): InventorySlot[] {
  return Array.from({ length: CHEST_SIZE }, () => ({ itemId: null, count: 0 }));
}

export function createInitialResources(): ResourceBag {
  return {
    wood: 0,
    stone: 0,
    metal_ore: 0,
    metal_frags: 0,
    sulfur: 0,
    cloth: 0,
    raw_meat: 0,
    sludge: 0,
  };
}

export function createInitialArmor(): EquippedArmor {
  return {
    head: null,
    chest: null,
    legs: null,
  };
}

export function createInitialArmorDurability(): EquippedArmorDurability {
  return {};
}

export function getArmorDefense(armor: EquippedArmor): number {
  let total = 0;
  for (const key of ['head', 'chest', 'legs'] as const) {
    const id = armor[key];
    if (id && ITEMS[id]?.armorReduction) {
      total += ITEMS[id].armorReduction!;
    }
  }
  return Math.min(0.75, total);
}

export function applyArmorMitigation(rawDamage: number, defenseFraction: number): number {
  const clamped = Math.max(0, Math.min(0.75, defenseFraction));
  return Math.max(1, Math.round(rawDamage * (1 - clamped)));
}

export function equipArmorFromSlot(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  armor: EquippedArmor,
  ref: SlotRef,
  armorDurability?: EquippedArmorDurability,
): { ok: boolean; slot?: ArmorSlotType; itemId?: ItemId } {
  const list = ref.area === 'hotbar' ? hotbar : backpack;
  const slot = list[ref.index];
  if (!slot || !slot.itemId) return { ok: false };
  const def = ITEMS[slot.itemId];
  if (!def || def.category !== 'armor' || !def.armorSlot) return { ok: false };

  const targetSlot = def.armorSlot;
  const incomingDur = slot.durability ?? def.maxDurability;
  const prevEquipped = armor[targetSlot];
  const prevDef = prevEquipped ? ITEMS[prevEquipped] : undefined;
  const prevDur =
    prevEquipped && prevDef?.maxDurability
      ? (armorDurability?.[targetSlot] ?? prevDef.maxDurability)
      : undefined;

  armor[targetSlot] = slot.itemId;
  if (armorDurability) {
    if (incomingDur !== undefined) {
      armorDurability[targetSlot] = incomingDur;
    } else {
      delete armorDurability[targetSlot];
    }
  }

  slot.itemId = prevEquipped;
  slot.count = prevEquipped ? 1 : 0;
  if (prevEquipped && prevDef?.maxDurability) {
    slot.maxDurability = prevDef.maxDurability;
    slot.durability = prevDur ?? prevDef.maxDurability;
  } else {
    delete slot.durability;
    delete slot.maxDurability;
  }
  return { ok: true, slot: targetSlot, itemId: armor[targetSlot]! };
}

export function unequipArmorSlot(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  armor: EquippedArmor,
  slotType: ArmorSlotType,
  armorDurability?: EquippedArmorDurability,
): {
  ok: boolean;
  overflow: number;
  itemId?: ItemId;
  durability?: number;
  maxDurability?: number;
} {
  const equippedId = armor[slotType];
  if (!equippedId) return { ok: false, overflow: 0 };
  const def = ITEMS[equippedId];
  const maxDur = def?.maxDurability;
  const curDur =
    maxDur !== undefined
      ? Math.max(1, Math.min(maxDur, armorDurability?.[slotType] ?? maxDur))
      : undefined;

  const res = addItemToInventory(hotbar, backpack, resources, equippedId, 1, curDur);
  armor[slotType] = null;
  if (armorDurability) {
    delete armorDurability[slotType];
  }
  return {
    ok: true,
    overflow: res.overflow,
    itemId: equippedId,
    durability: curDur,
    maxDurability: maxDur,
  };
}

export function damageEquippedArmor(
  armor: EquippedArmor,
  armorDurability: EquippedArmorDurability,
  rawCombatDamage: number,
): { brokenPieces: ItemId[]; damaged: boolean } {
  if (rawCombatDamage <= 0) return { brokenPieces: [], damaged: false };
  const wear = Math.max(1, Math.round(rawCombatDamage * 0.28));
  const brokenPieces: ItemId[] = [];
  let damaged = false;

  for (const key of ['head', 'chest', 'legs'] as const) {
    const id = armor[key];
    if (!id) continue;
    const maxDur = ITEMS[id]?.maxDurability;
    if (!maxDur || maxDur <= 0) continue;
    const current = armorDurability[key] ?? maxDur;
    const next = current - wear;
    damaged = true;
    if (next <= 0) {
      armor[key] = null;
      delete armorDurability[key];
      brokenPieces.push(id);
    } else {
      armorDurability[key] = next;
    }
  }

  return { brokenPieces, damaged };
}

export function getItemCount(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  itemId: ItemId,
): number {
  if (isResourceKey(itemId)) {
    return resources[itemId];
  }
  let total = 0;
  for (const slot of hotbar) {
    if (slot.itemId === itemId) total += slot.count;
  }
  for (const slot of backpack) {
    if (slot.itemId === itemId) total += slot.count;
  }
  return total;
}

export function canAfford(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  ingredients: RecipeIngredient[],
): boolean {
  for (const ing of ingredients) {
    if (getItemCount(hotbar, backpack, resources, ing.itemId) < ing.count) {
      return false;
    }
  }
  return true;
}

export interface AddItemResult {
  added: number;
  overflow: number;
}

export function addItemToInventory(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  itemId: ItemId,
  amount: number,
  customDurability?: number,
): AddItemResult {
  if (amount <= 0) return { added: 0, overflow: 0 };
  if (isResourceKey(itemId)) {
    resources[itemId] += amount;
    return { added: amount, overflow: 0 };
  }

  const def = ITEMS[itemId];
  const stackMax = def?.stackMax ?? 1;
  const maxDur = def?.maxDurability;
  let remaining = amount;

  for (const list of [hotbar, backpack]) {
    for (const slot of list) {
      if (slot.itemId === itemId && slot.count < stackMax && remaining > 0) {
        const room = stackMax - slot.count;
        const add = Math.min(room, remaining);
        slot.count += add;
        remaining -= add;
      }
    }
  }

  for (const list of [hotbar, backpack]) {
    for (const slot of list) {
      if (slot.itemId === null && remaining > 0) {
        const add = Math.min(stackMax, remaining);
        slot.itemId = itemId;
        slot.count = add;
        if (maxDur !== undefined && maxDur > 0 && stackMax === 1) {
          slot.maxDurability = maxDur;
          slot.durability =
            customDurability !== undefined
              ? Math.max(1, Math.min(maxDur, customDurability))
              : maxDur;
        } else {
          delete slot.durability;
          delete slot.maxDurability;
        }
        remaining -= add;
      }
    }
  }

  return {
    added: amount - remaining,
    overflow: remaining,
  };
}

export function consumeItem(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  itemId: ItemId,
  amount: number,
): boolean {
  if (getItemCount(hotbar, backpack, resources, itemId) < amount) return false;
  if (isResourceKey(itemId)) {
    resources[itemId] -= amount;
    return true;
  }
  let remaining = amount;
  for (const list of [hotbar, backpack]) {
    for (const slot of list) {
      if (slot.itemId === itemId && remaining > 0) {
        const take = Math.min(slot.count, remaining);
        slot.count -= take;
        remaining -= take;
        if (slot.count <= 0) {
          slot.itemId = null;
          slot.count = 0;
          delete slot.durability;
          delete slot.maxDurability;
        }
      }
    }
  }
  return remaining === 0;
}

export interface SlotRef {
  area: 'hotbar' | 'backpack';
  index: number;
}

export type ContainerArea = 'hotbar' | 'backpack' | 'chest';

export interface ContainerSlotRef {
  area: ContainerArea;
  index: number;
}

export function moveOrSwapSlot(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  from: SlotRef,
  to: SlotRef,
): boolean {
  return moveBetweenContainers(hotbar, backpack, [], from, to);
}

export function moveBetweenContainers(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  chest: InventorySlot[],
  from: ContainerSlotRef,
  to: ContainerSlotRef,
): boolean {
  const getList = (area: ContainerArea) =>
    area === 'hotbar' ? hotbar : area === 'backpack' ? backpack : chest;
  const srcList = getList(from.area);
  const dstList = getList(to.area);
  const src = srcList[from.index];
  const dst = dstList[to.index];
  if (!src || !dst || (from.area === to.area && from.index === to.index)) return false;
  if (src.itemId === null) return false;

  if (dst.itemId === src.itemId) {
    const stackMax = ITEMS[src.itemId]?.stackMax ?? 1;
    const room = stackMax - dst.count;
    if (room > 0) {
      const moveAmt = Math.min(room, src.count);
      dst.count += moveAmt;
      src.count -= moveAmt;
      if (src.count <= 0) {
        src.itemId = null;
        src.count = 0;
        delete src.durability;
        delete src.maxDurability;
      }
      return true;
    }
  }

  const tmpId = dst.itemId;
  const tmpCount = dst.count;
  const tmpDur = dst.durability;
  const tmpMaxDur = dst.maxDurability;

  dst.itemId = src.itemId;
  dst.count = src.count;
  if (src.durability !== undefined) dst.durability = src.durability;
  else delete dst.durability;
  if (src.maxDurability !== undefined) dst.maxDurability = src.maxDurability;
  else delete dst.maxDurability;

  src.itemId = tmpId;
  src.count = tmpCount;
  if (tmpDur !== undefined) src.durability = tmpDur;
  else delete src.durability;
  if (tmpMaxDur !== undefined) src.maxDurability = tmpMaxDur;
  else delete src.maxDurability;
  return true;
}

export function quickTransferContainerSlot(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  chest: InventorySlot[],
  from: ContainerSlotRef,
): boolean {
  const srcList =
    from.area === 'hotbar' ? hotbar : from.area === 'backpack' ? backpack : chest;
  const src = srcList[from.index];
  if (!src || !src.itemId || src.count <= 0) return false;

  const targetLists = from.area === 'chest' ? [hotbar, backpack] : [chest];
  const stackMax = ITEMS[src.itemId]?.stackMax ?? 1;
  let movedAny = false;

  for (const dstList of targetLists) {
    for (const dst of dstList) {
      if (dst.itemId === src.itemId && dst.count < stackMax && src.count > 0) {
        const moveAmt = Math.min(stackMax - dst.count, src.count);
        dst.count += moveAmt;
        src.count -= moveAmt;
        movedAny = true;
      }
    }
  }

  for (const dstList of targetLists) {
    for (const dst of dstList) {
      if (dst.itemId === null && src.count > 0) {
        const moveAmt = Math.min(stackMax, src.count);
        dst.itemId = src.itemId;
        dst.count = moveAmt;
        if (src.durability !== undefined && stackMax === 1) dst.durability = src.durability;
        if (src.maxDurability !== undefined && stackMax === 1) dst.maxDurability = src.maxDurability;
        src.count -= moveAmt;
        movedAny = true;
      }
    }
  }

  if (src.count <= 0) {
    src.itemId = null;
    src.count = 0;
    delete src.durability;
    delete src.maxDurability;
  }
  return movedAny;
}

export function quickMoveSlotBetweenHotbarAndBackpack(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  from: SlotRef,
): boolean {
  const srcList = from.area === 'hotbar' ? hotbar : backpack;
  const dstList = from.area === 'hotbar' ? backpack : hotbar;
  const src = srcList[from.index];
  if (!src || !src.itemId || src.count <= 0) return false;

  const stackMax = ITEMS[src.itemId]?.stackMax ?? 1;
  let movedAny = false;

  if (stackMax > 1) {
    for (const dst of dstList) {
      if (dst.itemId === src.itemId && dst.count < stackMax && src.count > 0) {
        const moveAmt = Math.min(stackMax - dst.count, src.count);
        dst.count += moveAmt;
        src.count -= moveAmt;
        movedAny = true;
      }
    }
  }

  for (const dst of dstList) {
    if (dst.itemId === null && src.count > 0) {
      const moveAmt = Math.min(stackMax, src.count);
      dst.itemId = src.itemId;
      dst.count = moveAmt;
      if (src.durability !== undefined && stackMax === 1) dst.durability = src.durability;
      else delete dst.durability;
      if (src.maxDurability !== undefined && stackMax === 1) dst.maxDurability = src.maxDurability;
      else delete dst.maxDurability;
      src.count -= moveAmt;
      movedAny = true;
    }
  }

  if (src.count <= 0) {
    src.itemId = null;
    src.count = 0;
    delete src.durability;
    delete src.maxDurability;
  }
  return movedAny;
}

export function consumeOneFromSlot(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  ref: SlotRef,
): ItemId | null {
  const list = ref.area === 'hotbar' ? hotbar : backpack;
  const slot = list[ref.index];
  if (!slot || !slot.itemId || slot.count <= 0) return null;
  const itemId = slot.itemId;
  slot.count -= 1;
  if (slot.count <= 0) {
    slot.itemId = null;
    slot.count = 0;
    delete slot.durability;
    delete slot.maxDurability;
  }
  return itemId;
}

export function collectDeathDrops(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  armor: EquippedArmor,
  armorDurability?: EquippedArmorDurability,
): DeathBackpackItem[] {
  const drops: DeathBackpackItem[] = [];

  for (const key of ['head', 'chest', 'legs'] as const) {
    const id = armor[key];
    if (id) {
      const maxDur = ITEMS[id]?.maxDurability;
      const dur = armorDurability?.[key] ?? maxDur;
      drops.push({
        itemId: id,
        count: 1,
        equippedArmorSlot: key,
        ...(dur !== undefined ? { durability: dur } : {}),
        ...(maxDur !== undefined ? { maxDurability: maxDur } : {}),
      });
      armor[key] = null;
      if (armorDurability) delete armorDurability[key];
    }
  }

  for (const list of [hotbar, backpack]) {
    for (const slot of list) {
      if (slot.itemId && slot.count > 0) {
        drops.push({
          itemId: slot.itemId,
          count: slot.count,
          ...(slot.durability !== undefined ? { durability: slot.durability } : {}),
          ...(slot.maxDurability !== undefined ? { maxDurability: slot.maxDurability } : {}),
        });
      }
      slot.itemId = null;
      slot.count = 0;
      delete slot.durability;
      delete slot.maxDurability;
    }
  }

  for (const key of RESOURCE_KEYS) {
    const qty = Math.floor(resources[key] || 0);
    if (qty > 0) {
      drops.push({ itemId: key, count: qty });
      resources[key] = 0;
    }
  }

  return drops;
}

export function lootDeathBackpack(
  bagItems: ReadonlyArray<DeathBackpackItem>,
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  armor: EquippedArmor,
  armorDurability?: EquippedArmorDurability,
): { collectedCount: number; remaining: DeathBackpackItem[] } {
  let collectedCount = 0;
  const remaining: DeathBackpackItem[] = [];

  for (const entry of bagItems) {
    if (!entry || !entry.itemId || entry.count <= 0) continue;
    const def = ITEMS[entry.itemId];
    if (!def) continue;

    // Auto-equip recovered armor into its original slot if that slot is empty
    if (
      entry.equippedArmorSlot &&
      def.category === 'armor' &&
      def.armorSlot === entry.equippedArmorSlot &&
      armor[entry.equippedArmorSlot] === null
    ) {
      armor[entry.equippedArmorSlot] = entry.itemId;
      if (armorDurability && def.maxDurability) {
        const dur =
          entry.durability !== undefined
            ? Math.max(1, Math.min(def.maxDurability, entry.durability))
            : def.maxDurability;
        armorDurability[entry.equippedArmorSlot] = dur;
      }
      collectedCount += 1;
      continue;
    }

    const res = addItemToInventory(
      hotbar,
      backpack,
      resources,
      entry.itemId,
      entry.count,
      entry.durability,
    );
    collectedCount += res.added;
    if (res.overflow > 0) {
      remaining.push({
        itemId: entry.itemId,
        count: res.overflow,
        ...(entry.durability !== undefined ? { durability: entry.durability } : {}),
        ...(entry.maxDurability !== undefined ? { maxDurability: entry.maxDurability } : {}),
      });
    }
  }

  return { collectedCount, remaining };
}

export function rollFishingCatch(roll: number): {
  itemId: ItemId;
  count: number;
  label: string;
  isTreasure: boolean;
} {
  const r = Math.max(0, Math.min(0.99999, roll));
  if (r < 0.52) {
    return { itemId: 'raw_fish', count: 1, label: 'River Fish', isTreasure: false };
  }
  if (r < 0.64) {
    return { itemId: 'raw_fish', count: 2, label: 'Double River Fish', isTreasure: false };
  }
  if (r < 0.74) {
    return { itemId: 'wood', count: 18, label: 'Driftwood (+18 Wood)', isTreasure: true };
  }
  if (r < 0.82) {
    return { itemId: 'cloth', count: 10, label: 'Salvaged Tarp (+10 Cloth)', isTreasure: true };
  }
  if (r < 0.89) {
    return { itemId: 'metal_frags', count: 14, label: 'Scrap Metal (+14 Frags)', isTreasure: true };
  }
  if (r < 0.94) {
    return { itemId: 'sludge', count: 8, label: 'Sunken Bio-Sludge (+8)', isTreasure: true };
  }
  if (r < 0.97) {
    return { itemId: 'ammo', count: 5, label: 'Waterproof Shells (+5)', isTreasure: true };
  }
  if (r < 0.99) {
    return { itemId: 'medkit', count: 1, label: 'Sealed Medkit', isTreasure: true };
  }
  return { itemId: 'barrel_item', count: 1, label: 'Floating Fuel Drum', isTreasure: true };
}

export function dropSlotItem(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  ref: SlotRef,
  dropAll = true,
): { itemId: ItemId; count: number; durability?: number; maxDurability?: number } | null {
  const list = ref.area === 'hotbar' ? hotbar : backpack;
  const slot = list[ref.index];
  if (!slot || slot.itemId === null || slot.count <= 0) return null;

  const itemId = slot.itemId;
  const count = dropAll ? slot.count : 1;
  const durability = slot.durability;
  const maxDurability = slot.maxDurability;
  slot.count -= count;
  if (slot.count <= 0) {
    slot.itemId = null;
    slot.count = 0;
    delete slot.durability;
    delete slot.maxDurability;
  }
  return {
    itemId,
    count,
    ...(durability !== undefined ? { durability } : {}),
    ...(maxDurability !== undefined ? { maxDurability } : {}),
  };
}

export function craftRecipe(
  hotbar: InventorySlot[],
  backpack: InventorySlot[],
  resources: ResourceBag,
  recipe: CraftingRecipe,
): { ok: boolean; overflow: number; reason?: string } {
  if (!canAfford(hotbar, backpack, resources, recipe.ingredients)) {
    return { ok: false, overflow: 0, reason: 'Missing ingredients' };
  }
  for (const ing of recipe.ingredients) {
    consumeItem(hotbar, backpack, resources, ing.itemId, ing.count);
  }
  const res = addItemToInventory(
    hotbar,
    backpack,
    resources,
    recipe.outputItem,
    recipe.outputCount,
  );
  return {
    ok: true,
    overflow: res.overflow,
    reason: res.overflow > 0 ? 'Inventory full — dropped on ground' : undefined,
  };
}

export function snapToGrid(value: number, gridSize = GRID_SIZE): number {
  const snapped = Math.round(value / gridSize) * gridSize;
  return snapped === 0 ? 0 : snapped;
}

export interface PlacementResult {
  valid: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  reason: string;
}

function isWallLike(type: BuildPieceType): boolean {
  return type === 'wall' || type === 'doorway' || type === 'window_wall';
}

export function computeBuildPlacement(params: {
  pieceType: BuildPieceType;
  aimX: number;
  aimY?: number;
  aimZ: number;
  playerY?: number;
  hitNormalX?: number;
  hitNormalY?: number;
  hitNormalZ?: number;
  groundYAt: (x: number, z: number) => number;
  existingPieces: PlacedBuildPiece[];
  playerYaw: number;
  rotSteps: number;
  woodCount: number;
  freeBuild?: boolean;
  hitPiece?: PlacedBuildPiece | null;
}): PlacementResult {
  const {
    pieceType,
    aimX,
    aimY,
    aimZ,
    playerY,
    hitNormalX = 0,
    hitNormalY = 1,
    hitNormalZ = 0,
    groundYAt,
    existingPieces,
    playerYaw,
    rotSteps,
    woodCount,
    freeBuild = false,
    hitPiece,
  } = params;

  const def = getBuildPieceDef(pieceType);
  const half = GRID_SIZE * 0.5;
  const effectiveWood = freeBuild ? Math.max(woodCount, def.twigCost) : woodCount;

  const baseCardinal = Math.round(playerYaw / (Math.PI / 2)) * (Math.PI / 2);
  const rotY = baseCardinal + rotSteps * (Math.PI / 4);
  const normalizedRot = ((Math.round(rotY / (Math.PI / 4)) % 8) + 8) % 8;
  const snappedRotY = normalizedRot * (Math.PI / 4);

  if (pieceType === 'foundation') {
    const nudgedX = hitPiece?.type === 'foundation' ? aimX + hitNormalX * 0.65 : aimX;
    const nudgedZ = hitPiece?.type === 'foundation' ? aimZ + hitNormalZ * 0.65 : aimZ;
    const gx = snapToGrid(nudgedX);
    const gz = snapToGrid(nudgedZ);
    const gy = groundYAt(gx, gz);

    let targetY = gy;
    let snappedAdjacent = false;
    for (const p of existingPieces) {
      if (p.type === 'foundation') {
        const dx = Math.abs(p.x - gx);
        const dz = Math.abs(p.z - gz);
        if (
          (dx < 0.2 && Math.abs(dz - GRID_SIZE) < 0.2) ||
          (dz < 0.2 && Math.abs(dx - GRID_SIZE) < 0.2)
        ) {
          targetY = p.y;
          snappedAdjacent = true;
          break;
        }
      }
    }

    const freeRotated = !snappedAdjacent && rotSteps % 2 !== 0;
    const placeX = freeRotated ? Math.round(aimX * 100) / 100 : gx;
    const placeZ = freeRotated ? Math.round(aimZ * 100) / 100 : gz;
    const placeY = freeRotated ? groundYAt(placeX, placeZ) : targetY;
    const placeRot = snappedAdjacent ? 0 : (rotSteps * (Math.PI / 4)) % (Math.PI * 2);

    const occupied = existingPieces.some(
      (p) => p.type === 'foundation' && Math.abs(p.x - placeX) < 0.35 && Math.abs(p.z - placeZ) < 0.35,
    );
    if (occupied) {
      return { valid: false, x: placeX, y: placeY, z: placeZ, rotY: placeRot, reason: 'Occupied' };
    }
    if (!freeBuild && Math.abs(placeY - gy) > 12.0) {
      return { valid: false, x: placeX, y: placeY, z: placeZ, rotY: placeRot, reason: 'Too steep' };
    }
    if (effectiveWood < def.twigCost) {
      return {
        valid: false,
        x: placeX,
        y: placeY,
        z: placeZ,
        rotY: placeRot,
        reason: `Need ${def.twigCost} Wood`,
      };
    }
    return { valid: true, x: placeX, y: placeY, z: placeZ, rotY: placeRot, reason: 'Ready' };
  }

  const foundations = existingPieces.filter((p) => p.type === 'foundation');
  const hasFoundationAnchor = foundations.some(
    (f) => Math.hypot(f.x - aimX, f.z - aimZ) <= 56,
  );
  if (foundations.length === 0 && !freeBuild) {
    const gx = snapToGrid(aimX);
    const gz = snapToGrid(aimZ);
    return {
      valid: false,
      x: gx,
      y: groundYAt(gx, gz) + FOUNDATION_HEIGHT,
      z: gz,
      rotY: snappedRotY,
      reason: 'Place a Foundation first',
    };
  }


  if (isWallLike(pieceType)) {
    // Allow stacking Wall / Doorway / Window directly upwards on top of an existing Wall-like piece!
    if (rotSteps % 2 === 0 && hitPiece && isWallLike(hitPiece.type)) {
      const stackBaseY = Math.round((hitPiece.y + WALL_HEIGHT) * 100) / 100;
      const adjacentFloor = existingPieces.find(
        (p) =>
          p.type === 'floor' &&
          Math.abs(p.y - stackBaseY) < 0.3 &&
          Math.abs(p.x - hitPiece.x) <= half + 0.25 &&
          Math.abs(p.z - hitPiece.z) <= half + 0.25,
      );
      const targetY = adjacentFloor
        ? Math.round((adjacentFloor.y + FLOOR_THICKNESS) * 100) / 100
        : stackBaseY;

      const stackOccupied = existingPieces.some(
        (p) =>
          isWallLike(p.type) &&
          Math.abs(p.x - hitPiece.x) < 0.2 &&
          Math.abs(p.z - hitPiece.z) < 0.2 &&
          Math.abs(p.y - targetY) < 0.35,
      );
      if (!stackOccupied) {
        if (effectiveWood < def.twigCost) {
          return {
            valid: false,
            x: hitPiece.x,
            y: targetY,
            z: hitPiece.z,
            rotY: hitPiece.rotY,
            reason: `Need ${def.twigCost} Wood`,
          };
        }
        return {
          valid: true,
          x: hitPiece.x,
          y: targetY,
          z: hitPiece.z,
          rotY: hitPiece.rotY,
          reason: 'Ready',
        };
      }
    }

    const support =
      rotSteps % 2 !== 0
        ? null
        : hitPiece && (hitPiece.type === 'foundation' || hitPiece.type === 'floor')
          ? hitPiece
          : findNearestSupport(aimX, aimY, aimZ, existingPieces, playerY);

    if (!support) {
      if (hasFoundationAnchor || freeBuild) {
        const freeX = Math.round(aimX * 100) / 100;
        const freeZ = Math.round(aimZ * 100) / 100;
        const gy = groundYAt(freeX, freeZ);
        const freeY =
          aimY !== undefined && aimY > gy + 0.15
            ? Math.round(aimY * 100) / 100
            : Math.round((gy + FOUNDATION_HEIGHT) * 100) / 100;
        const freeOccupied = existingPieces.some(
          (p) =>
            isWallLike(p.type) &&
            Math.abs(p.x - freeX) < 0.45 &&
            Math.abs(p.z - freeZ) < 0.45 &&
            Math.abs(p.y - freeY) < 0.45,
        );
        if (freeOccupied) {
          return { valid: false, x: freeX, y: freeY, z: freeZ, rotY: snappedRotY, reason: 'Occupied' };
        }
        if (effectiveWood < def.twigCost) {
          return {
            valid: false,
            x: freeX,
            y: freeY,
            z: freeZ,
            rotY: snappedRotY,
            reason: `Need ${def.twigCost} Wood`,
          };
        }
        return { valid: true, x: freeX, y: freeY, z: freeZ, rotY: snappedRotY, reason: 'Ready' };
      }

      const gx = snapToGrid(aimX);
      const gz = snapToGrid(aimZ);
      return {
        valid: false,
        x: gx,
        y: groundYAt(gx, gz) + FOUNDATION_HEIGHT,
        z: gz,
        rotY: snappedRotY,
        reason: 'Needs Foundation anchor nearby',
      };
    }

    const dx = aimX - support.x;
    const dz = aimZ - support.z;
    let ex = support.x;
    let ez = support.z;
    let edgeRotY = 0;

    if (Math.abs(dx) > Math.abs(dz)) {
      ex = support.x + (dx >= 0 ? half : -half);
      edgeRotY = Math.PI / 2;
    } else {
      ez = support.z + (dz >= 0 ? half : -half);
      edgeRotY = 0;
    }

    let baseTopY =
      support.type === 'foundation'
        ? support.y + FOUNDATION_HEIGHT
        : support.y + FLOOR_THICKNESS;

    let occupiedPiece = existingPieces.find(
      (p) =>
        isWallLike(p.type) &&
        Math.abs(p.x - ex) < 0.2 &&
        Math.abs(p.z - ez) < 0.2 &&
        Math.abs(p.y - baseTopY) < 0.35,
    );

    // If the ground edge is occupied and player is aiming/standing higher, climb up the wall stack!
    const elevHint = aimY ?? playerY;
    if (occupiedPiece && elevHint !== undefined && elevHint >= baseTopY + WALL_HEIGHT * 0.55) {
      let topWall = occupiedPiece;
      for (let guard = 0; guard < 8; guard++) {
        const nextY = Math.round((topWall.y + WALL_HEIGHT) * 100) / 100;
        const above = existingPieces.find(
          (p) =>
            isWallLike(p.type) &&
            Math.abs(p.x - ex) < 0.2 &&
            Math.abs(p.z - ez) < 0.2 &&
            Math.abs(p.y - nextY) < 0.35,
        );
        if (!above) {
          baseTopY = nextY;
          occupiedPiece = undefined;
          break;
        }
        topWall = above;
      }
    }

    if (occupiedPiece) {
      return { valid: false, x: ex, y: baseTopY, z: ez, rotY: edgeRotY, reason: 'Edge occupied' };
    }
    if (effectiveWood < def.twigCost) {
      return {
        valid: false,
        x: ex,
        y: baseTopY,
        z: ez,
        rotY: edgeRotY,
        reason: `Need ${def.twigCost} Wood`,
      };
    }
    return { valid: true, x: ex, y: baseTopY, z: ez, rotY: edgeRotY, reason: 'Ready' };
  }

  if (pieceType === 'floor') {
    let adjX = aimX;
    let adjZ = aimZ;
    if (hitPiece && isWallLike(hitPiece.type)) {
      adjX = aimX + hitNormalX * 0.65;
      adjZ = aimZ + hitNormalZ * 0.65;
    } else if (
      hitPiece &&
      (hitPiece.type === 'foundation' || hitPiece.type === 'floor') &&
      Math.abs(hitNormalY) < 0.55
    ) {
      // Aimed at the side rim of a foundation or elevated floor: extend outward into air
      adjX = aimX + hitNormalX * 1.1;
      adjZ = aimZ + hitNormalZ * 1.1;
    }

    const target = rotSteps % 2 === 0 ? findFloorPlacementTarget(adjX, aimY, adjZ, existingPieces) : null;

    if (!target) {
      if (hasFoundationAnchor || freeBuild) {
        const freeX = Math.round(adjX * 100) / 100;
        const freeZ = Math.round(adjZ * 100) / 100;
        const gy = groundYAt(freeX, freeZ);
        const freeY =
          aimY !== undefined && aimY > gy + 0.15
            ? Math.round(aimY * 100) / 100
            : Math.round((gy + FOUNDATION_HEIGHT + WALL_HEIGHT) * 100) / 100;
        const freeOccupied = existingPieces.some(
          (p) =>
            p.type === 'floor' &&
            Math.abs(p.x - freeX) < 0.45 &&
            Math.abs(p.z - freeZ) < 0.45 &&
            Math.abs(p.y - freeY) < 0.45,
        );
        if (freeOccupied) {
          return { valid: false, x: freeX, y: freeY, z: freeZ, rotY: snappedRotY, reason: 'Occupied' };
        }
        if (effectiveWood < def.twigCost) {
          return {
            valid: false,
            x: freeX,
            y: freeY,
            z: freeZ,
            rotY: snappedRotY,
            reason: `Need ${def.twigCost} Wood`,
          };
        }
        return { valid: true, x: freeX, y: freeY, z: freeZ, rotY: snappedRotY, reason: 'Ready' };
      }

      const gx = snapToGrid(adjX);
      const gz = snapToGrid(adjZ);
      return {
        valid: false,
        x: gx,
        y: groundYAt(gx, gz) + FOUNDATION_HEIGHT + WALL_HEIGHT,
        z: gz,
        rotY: 0,
        reason: 'Needs Foundation anchor nearby',
      };
    }

    const { cellX, cellZ, roofY, hasSupport } = target;
    const occupied = existingPieces.some(
      (p) =>
        (p.type === 'floor' &&
          Math.abs(p.x - cellX) < 0.2 &&
          Math.abs(p.z - cellZ) < 0.2 &&
          Math.abs(p.y - roofY) < 0.3) ||
        (p.type === 'foundation' &&
          Math.abs(p.x - cellX) < 0.2 &&
          Math.abs(p.z - cellZ) < 0.2 &&
          Math.abs(p.y + FOUNDATION_HEIGHT - roofY) < 0.35),
    );

    if (occupied) {
      return { valid: false, x: cellX, y: roofY, z: cellZ, rotY: 0, reason: 'Occupied' };
    }
    if (!hasSupport) {
      return {
        valid: false,
        x: cellX,
        y: roofY,
        z: cellZ,
        rotY: 0,
        reason: 'Needs Foundation, Floor, or Wall',
      };
    }
    if (effectiveWood < def.twigCost) {
      return {
        valid: false,
        x: cellX,
        y: roofY,
        z: cellZ,
        rotY: 0,
        reason: `Need ${def.twigCost} Wood`,
      };
    }
    return { valid: true, x: cellX, y: roofY, z: cellZ, rotY: 0, reason: 'Ready' };
  }

  // Stairs (works on any foundation, floating air floor, or free-form when anchored to a foundation!)
  const support =
    hitPiece && (hitPiece.type === 'foundation' || hitPiece.type === 'floor')
      ? hitPiece
      : findNearestSupport(aimX, aimY, aimZ, existingPieces, playerY);

  if (!support) {
    if (hasFoundationAnchor || freeBuild) {
      const freeX = Math.round(aimX * 100) / 100;
      const freeZ = Math.round(aimZ * 100) / 100;
      const gy = groundYAt(freeX, freeZ);
      const freeY =
        aimY !== undefined && aimY > gy + 0.15
          ? Math.round(aimY * 100) / 100
          : Math.round((gy + FOUNDATION_HEIGHT) * 100) / 100;
      const freeOccupied = existingPieces.some(
        (p) =>
          p.type === 'stairs' &&
          Math.abs(p.x - freeX) < 0.45 &&
          Math.abs(p.z - freeZ) < 0.45 &&
          Math.abs(p.y - freeY) < 0.45,
      );
      if (freeOccupied) {
        return { valid: false, x: freeX, y: freeY, z: freeZ, rotY: snappedRotY, reason: 'Occupied' };
      }
      if (effectiveWood < def.twigCost) {
        return {
          valid: false,
          x: freeX,
          y: freeY,
          z: freeZ,
          rotY: snappedRotY,
          reason: `Need ${def.twigCost} Wood`,
        };
      }
      return { valid: true, x: freeX, y: freeY, z: freeZ, rotY: snappedRotY, reason: 'Ready' };
    }

    const gx = snapToGrid(aimX);
    const gz = snapToGrid(aimZ);
    return {
      valid: false,
      x: gx,
      y: groundYAt(gx, gz) + FOUNDATION_HEIGHT,
      z: gz,
      rotY: snappedRotY,
      reason: 'Needs Foundation anchor nearby',
    };
  }
  const baseTopY =
    support.type === 'foundation'
      ? support.y + FOUNDATION_HEIGHT
      : support.y + FLOOR_THICKNESS;
  const occupied = existingPieces.some(
    (p) =>
      p.type === 'stairs' &&
      Math.abs(p.x - support.x) < 0.2 &&
      Math.abs(p.z - support.z) < 0.2 &&
      Math.abs(p.y - baseTopY) < 0.3,
  );
  if (occupied) {
    return {
      valid: false,
      x: support.x,
      y: baseTopY,
      z: support.z,
      rotY: snappedRotY,
      reason: 'Occupied',
    };
  }
  if (effectiveWood < def.twigCost) {
    return {
      valid: false,
      x: support.x,
      y: baseTopY,
      z: support.z,
      rotY: snappedRotY,
      reason: `Need ${def.twigCost} Wood`,
    };
  }
  return {
    valid: true,
    x: support.x,
    y: baseTopY,
    z: support.z,
    rotY: snappedRotY,
    reason: 'Ready',
  };
}

function findNearestSupport(
  x: number,
  y: number | undefined,
  z: number,
  pieces: PlacedBuildPiece[],
  playerY?: number,
): PlacedBuildPiece | null {
  let best: PlacedBuildPiece | null = null;
  let bestScore = Infinity;
  const elevRef = y ?? playerY;
  for (const p of pieces) {
    if (p.type !== 'foundation' && p.type !== 'floor') continue;
    const dXZ = Math.hypot(p.x - x, p.z - z);
    if (dXZ > GRID_SIZE * 1.45) continue;
    const topY = p.type === 'foundation' ? p.y + FOUNDATION_HEIGHT : p.y + FLOOR_THICKNESS;
    const dY = elevRef !== undefined ? Math.abs(topY - elevRef) * 2.1 : 0;
    const score = dXZ + dY;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function findFloorPlacementTarget(
  x: number,
  y: number | undefined,
  z: number,
  pieces: ReadonlyArray<PlacedBuildPiece>,
): { cellX: number; cellZ: number; roofY: number; hasSupport: boolean } | null {
  const gx = snapToGrid(x);
  const gz = snapToGrid(z);
  const half = GRID_SIZE * 0.5;

  const candidateElevations: number[] = [];
  const pushElev = (val: number) => {
    const rounded = Math.round(val * 100) / 100;
    // Skip if already occupied at this exact cell and elevation by floor or foundation deck
    const alreadyTaken = pieces.some(
      (p) =>
        (p.type === 'floor' &&
          Math.abs(p.x - gx) < 0.2 &&
          Math.abs(p.z - gz) < 0.2 &&
          Math.abs(p.y - rounded) < 0.3) ||
        (p.type === 'foundation' &&
          Math.abs(p.x - gx) < 0.2 &&
          Math.abs(p.z - gz) < 0.2 &&
          Math.abs(p.y + FOUNDATION_HEIGHT - rounded) < 0.35),
    );
    if (!alreadyTaken && !candidateElevations.some((c) => Math.abs(c - rounded) < 0.08)) {
      candidateElevations.push(rounded);
    }
  };

  for (const p of pieces) {
    if (isWallLike(p.type)) {
      if (Math.abs(p.x - gx) <= half + 0.25 && Math.abs(p.z - gz) <= half + 0.25) {
        pushElev(p.y + WALL_HEIGHT);
      }
    } else if (p.type === 'floor') {
      const dx = Math.abs(p.x - gx);
      const dz = Math.abs(p.z - gz);
      // Cardinal neighbor floors allow extending indefinitely in ANY air direction
      const isCardinalNeighbor =
        (dx < 0.25 && Math.abs(dz - GRID_SIZE) < 0.25) ||
        (dz < 0.25 && Math.abs(dx - GRID_SIZE) < 0.25);
      if (isCardinalNeighbor) {
        pushElev(p.y);
      }
    } else if (p.type === 'foundation') {
      const dx = Math.abs(p.x - gx);
      const dz = Math.abs(p.z - gz);
      // Allow floating floors to branch directly outward in any direction from ONE foundation!
      const isCardinalNeighbor =
        (dx < 0.25 && Math.abs(dz - GRID_SIZE) < 0.25) ||
        (dz < 0.25 && Math.abs(dx - GRID_SIZE) < 0.25);
      if (isCardinalNeighbor) {
        pushElev(p.y + FOUNDATION_HEIGHT);
      }
    } else if (p.type === 'stairs') {
      const dx = Math.abs(p.x - gx);
      const dz = Math.abs(p.z - gz);
      if ((dx < 0.25 && dz <= GRID_SIZE + 0.25) || (dz < 0.25 && dx <= GRID_SIZE + 0.25)) {
        pushElev(p.y + WALL_HEIGHT);
      }
    }
  }

  if (candidateElevations.length > 0) {
    let chosenY = candidateElevations[0];
    if (y !== undefined) {
      let bestDy = Infinity;
      for (const cy of candidateElevations) {
        const dy = Math.abs(cy - y);
        if (dy < bestDy) {
          bestDy = dy;
          chosenY = cy;
        }
      }
    }
    return { cellX: gx, cellZ: gz, roofY: chosenY, hasSupport: true };
  }

  return null;
}

function segmentIntersectsLocalBox(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  const slabs: Array<[number, number, number, number]> = [
    [x1, dx, minX, maxX],
    [y1, dy, minY, maxY],
    [z1, dz, minZ, maxZ],
  ];
  for (const [p, d, lo, hi] of slabs) {
    if (Math.abs(d) < 1e-6) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function isSegmentBlockedByPieces(
  pieces: ReadonlyArray<PlacedBuildPiece>,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  blockWindowOpenings = true,
): { blocked: boolean; pieceId?: string } {
  const half = GRID_SIZE * 0.5;
  for (const p of pieces) {
    const cos = Math.cos(p.rotY);
    const sin = Math.sin(p.rotY);

    const dx1 = x1 - p.x;
    const dz1 = z1 - p.z;
    const lx1 = dx1 * cos - dz1 * sin;
    const lz1 = dx1 * sin + dz1 * cos;
    const ly1 = y1 - p.y;

    const dx2 = x2 - p.x;
    const dz2 = z2 - p.z;
    const lx2 = dx2 * cos - dz2 * sin;
    const lz2 = dx2 * sin + dz2 * cos;
    const ly2 = y2 - p.y;

    if (p.type === 'wall') {
      if (segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, half, 0, WALL_HEIGHT, -0.16, 0.16)) {
        return { blocked: true, pieceId: p.id };
      }
    } else if (p.type === 'doorway') {
      const leftJamb = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, -0.58, 0, WALL_HEIGHT, -0.16, 0.16);
      const rightJamb = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, 0.58, half, 0, WALL_HEIGHT, -0.16, 0.16);
      const lintel = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -0.62, 0.62, 2.32, WALL_HEIGHT, -0.16, 0.16);
      const closedDoor =
        p.hasDoor && !p.doorOpen
          ? segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -0.58, 0.58, 0, 2.34, -0.14, 0.14)
          : false;
      if (leftJamb || rightJamb || lintel || closedDoor) {
        return { blocked: true, pieceId: p.id };
      }
    } else if (p.type === 'window_wall') {
      if (blockWindowOpenings) {
        if (segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, half, 0, WALL_HEIGHT, -0.16, 0.16)) {
          return { blocked: true, pieceId: p.id };
        }
      } else {
        const lower = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, half, 0, 1.05, -0.16, 0.16);
        const upper = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, half, 2.1, WALL_HEIGHT, -0.16, 0.16);
        const left = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, -0.68, 1.05, 2.1, -0.16, 0.16);
        const right = segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, 0.68, half, 1.05, 2.1, -0.16, 0.16);
        if (lower || upper || left || right) {
          return { blocked: true, pieceId: p.id };
        }
      }
    } else if (p.type === 'floor') {
      if (segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, half, -0.1, FLOOR_THICKNESS + 0.05, -half, half)) {
        return { blocked: true, pieceId: p.id };
      }
    } else if (p.type === 'foundation') {
      if (segmentIntersectsLocalBox(lx1, ly1, lz1, lx2, ly2, lz2, -half, half, -0.5, FOUNDATION_HEIGHT, -half, half)) {
        return { blocked: true, pieceId: p.id };
      }
    }
  }
  return { blocked: false };
}

export function canUpgradePiece(
  piece: PlacedBuildPiece,
  resources: ResourceBag,
): {
  ok: boolean;
  nextTier?: BuildTier;
  costItem?: 'wood' | 'stone';
  costAmount?: number;
  reason: string;
} {
  const rule = TIER_UPGRADE_COST[piece.tier];
  if (!rule) {
    return { ok: false, reason: 'Max Stone Tier' };
  }
  const have = resources[rule.itemId];
  if (have < rule.amount) {
    return {
      ok: false,
      nextTier: rule.nextTier,
      costItem: rule.itemId,
      costAmount: rule.amount,
      reason: `Need ${rule.amount} ${rule.itemId === 'wood' ? 'Wood' : 'Stone'}`,
    };
  }
  return {
    ok: true,
    nextTier: rule.nextTier,
    costItem: rule.itemId,
    costAmount: rule.amount,
    reason: `Upgrade to ${rule.nextTier.toUpperCase()} (${rule.amount} ${rule.itemId})`,
  };
}

export function applyPieceUpgrade(piece: PlacedBuildPiece, resources: ResourceBag): boolean {
  const check = canUpgradePiece(piece, resources);
  if (!check.ok || !check.nextTier || !check.costItem || !check.costAmount) return false;
  resources[check.costItem] -= check.costAmount;
  piece.tier = check.nextTier;
  piece.maxHp = TIER_MAX_HP[check.nextTier];
  piece.hp = piece.maxHp;
  return true;
}

export function isNightTime(timeOfDay: number): boolean {
  return timeOfDay < 0.24 || timeOfDay > 0.77;
}

export function formatDayClock(timeOfDay: number): string {
  const totalMinutes = Math.floor((((timeOfDay % 1) + 1) % 1) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export type ActorHitKind =
  | 'wolf'
  | 'bear'
  | 'boar'
  | 'sludge_crawler'
  | 'raider_rusher'
  | 'raider_rifleman'
  | 'raider_sapper'
  | 'raider_juggernaut';

export interface ActorHitboxInput {
  kind: ActorHitKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  radius: number;
}

export interface SegmentActorHitResult {
  hit: boolean;
  headshot: boolean;
  t: number;
}

function closestDistSqSegmentToPoint(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  px: number,
  py: number,
  pz: number,
): { distSq: number; t: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;
  const wx = px - ax;
  const wy = py - ay;
  const wz = pz - az;
  const lenSq = vx * vx + vy * vy + vz * vz;
  const t = lenSq > 1e-8 ? Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / lenSq)) : 0;
  const cx = ax + vx * t;
  const cy = ay + vy * t;
  const cz = az + vz * t;
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return { distSq: dx * dx + dy * dy + dz * dz, t };
}

function closestDistSqSegmentToSegment(
  a1x: number,
  a1y: number,
  a1z: number,
  a2x: number,
  a2y: number,
  a2z: number,
  b1x: number,
  b1y: number,
  b1z: number,
  b2x: number,
  b2y: number,
  b2z: number,
): { distSq: number; s: number } {
  const ux = a2x - a1x;
  const uy = a2y - a1y;
  const uz = a2z - a1z;
  const vx = b2x - b1x;
  const vy = b2y - b1y;
  const vz = b2z - b1z;
  const wx = a1x - b1x;
  const wy = a1y - b1y;
  const wz = a1z - b1z;

  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const D = a * c - b * b;

  let sN: number;
  let sD = D;
  let tN: number;
  let tD = D;

  if (D < 1e-8) {
    sN = 0.0;
    sD = 1.0;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0.0) {
      sN = 0.0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0.0) {
    tN = 0.0;
    if (-d < 0.0) sN = 0.0;
    else if (-d > a) sN = sD;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0.0) sN = 0.0;
    else if (-d + b > a) sN = sD;
    else {
      sN = -d + b;
      sD = a;
    }
  }

  const sc = Math.abs(sN) < 1e-8 ? 0.0 : sN / sD;
  const tc = Math.abs(tN) < 1e-8 ? 0.0 : tN / tD;

  const dPx = wx + sc * ux - tc * vx;
  const dPy = wy + sc * uy - tc * vy;
  const dPz = wz + sc * uz - tc * vz;
  return { distSq: dPx * dPx + dPy * dPy + dPz * dPz, s: sc };
}

export function getActorHeadSphere(actor: ActorHitboxInput): {
  x: number;
  y: number;
  z: number;
  radius: number;
} {
  if (actor.kind === 'wolf' || actor.kind === 'bear' || actor.kind === 'boar') {
    const scale = actor.kind === 'bear' ? 1.45 : actor.kind === 'boar' ? 0.88 : 0.95;
    const fwdX = Math.sin(actor.rotY);
    const fwdZ = Math.cos(actor.rotY);
    return {
      x: actor.x + fwdX * 0.72 * scale,
      y: actor.y + 0.72 * scale,
      z: actor.z + fwdZ * 0.72 * scale,
      radius: 0.36 * scale,
    };
  }
  if (actor.kind === 'sludge_crawler') {
    const fwdX = Math.sin(actor.rotY);
    const fwdZ = Math.cos(actor.rotY);
    return {
      x: actor.x + fwdX * 0.15,
      y: actor.y + 1.56,
      z: actor.z + fwdZ * 0.15,
      radius: 0.36,
    };
  }
  const scale = actor.kind === 'raider_juggernaut' ? 1.26 : 1.0;
  return {
    x: actor.x,
    y: actor.y + 1.72 * scale,
    z: actor.z,
    radius: 0.32 * scale,
  };
}

export function testSegmentActorHit(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  actor: ActorHitboxInput,
): SegmentActorHitResult {
  const head = getActorHeadSphere(actor);
  const headTest = closestDistSqSegmentToPoint(ax, ay, az, bx, by, bz, head.x, head.y, head.z);
  const hitHead = headTest.distSq <= head.radius * head.radius;

  let hitBody = false;
  let bodyT = 1.0;

  if (actor.kind === 'wolf' || actor.kind === 'bear' || actor.kind === 'boar') {
    const scale = actor.kind === 'bear' ? 1.45 : actor.kind === 'boar' ? 0.88 : 0.95;
    const fwdX = Math.sin(actor.rotY);
    const fwdZ = Math.cos(actor.rotY);
    const bodyTest = closestDistSqSegmentToSegment(
      ax,
      ay,
      az,
      bx,
      by,
      bz,
      actor.x - fwdX * 0.45 * scale,
      actor.y + 0.56 * scale,
      actor.z - fwdZ * 0.45 * scale,
      actor.x + fwdX * 0.5 * scale,
      actor.y + 0.58 * scale,
      actor.z + fwdZ * 0.5 * scale,
    );
    const bodyRadius = 0.52 * scale;
    if (bodyTest.distSq <= bodyRadius * bodyRadius) {
      hitBody = true;
      bodyT = bodyTest.s;
    }
  } else {
    const scale = actor.kind === 'raider_juggernaut' ? 1.26 : 1.0;
    const bodyTop = actor.kind === 'sludge_crawler' ? 1.42 : 1.54 * scale;
    const bodyTest = closestDistSqSegmentToSegment(
      ax,
      ay,
      az,
      bx,
      by,
      bz,
      actor.x,
      actor.y + 0.12,
      actor.z,
      actor.x,
      actor.y + bodyTop,
      actor.z,
    );
    const bodyRadius = Math.max(actor.radius, 0.52 * scale) + 0.12;
    if (bodyTest.distSq <= bodyRadius * bodyRadius) {
      hitBody = true;
      bodyT = bodyTest.s;
    }
  }

  if (hitHead && (!hitBody || headTest.t <= bodyT + 0.15)) {
    return { hit: true, headshot: true, t: headTest.t };
  }
  if (hitBody) {
    return { hit: true, headshot: false, t: bodyT };
  }
  if (hitHead) {
    return { hit: true, headshot: true, t: headTest.t };
  }
  return { hit: false, headshot: false, t: 1.0 };
}

export function computeHeadshotDamage(
  baseDamage: number,
  headshot: boolean,
  multiplier = 2.0,
): number {
  if (!headshot) return baseDamage;
  return Math.max(baseDamage + 1, Math.round(baseDamage * multiplier));
}

export const WORLD_BARREL_MAX_HP = 50;
export const WORLD_BARREL_EXPLODE_THRESHOLD = 20;
export const PLACED_BARREL_MAX_HP = 40;
export const PLACED_BARREL_EXPLODE_THRESHOLD = 25;

export function applyBarrelShotDamage(
  currentHp: number,
  damage: number,
  explodeThreshold: number,
): { nextHp: number; exploded: boolean } {
  const nextHp = currentHp - damage;
  return {
    nextHp: Math.max(0, nextHp),
    exploded: nextHp <= explodeThreshold,
  };
}

export function testSegmentCylinderHit(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
): { hit: boolean; t: number } {
  const seg = closestDistSqSegmentToSegment(
    ax,
    ay,
    az,
    bx,
    by,
    bz,
    cx,
    cy + 0.08,
    cz,
    cx,
    cy + height,
    cz,
  );
  return {
    hit: seg.distSq <= radius * radius,
    t: seg.s,
  };
}

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function detectDeviceIsPhone(env: {
  hasTouch: boolean;
  coarsePointer: boolean;
  innerWidth: number;
  userAgent?: string;
}): boolean {
  if (env.userAgent && MOBILE_UA_REGEX.test(env.userAgent)) {
    return true;
  }
  if (env.coarsePointer && env.hasTouch) {
    return true;
  }
  if (env.hasTouch && env.innerWidth <= 920) {
    return true;
  }
  return false;
}

export function probeDeviceIsPhone(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch =
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    'ontouchstart' in window;
  const coarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const innerWidth = window.innerWidth || 1280;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return detectDeviceIsPhone({ hasTouch, coarsePointer, innerWidth, userAgent });
}

export function resolveControlMode(
  setting: ControlModeSetting,
  isPhoneDevice: boolean,
): ActiveControlMode {
  if (setting === 'pc') return 'pc';
  if (setting === 'phone') return 'phone';
  return isPhoneDevice ? 'phone' : 'pc';
}

export function getVersionLabel(mode: ActiveControlMode): string {
  return mode === 'phone' ? GAME_VERSION_MOBILE : GAME_VERSION_PC;
}

export type HarvestNodeKind =
  | 'tree'
  | 'stone'
  | 'metal'
  | 'sulfur'
  | 'sludge'
  | 'berry_bush'
  | 'barrel'
  | 'crate';

export function canHarvestNodeWithTool(
  toolOrHand: ItemId | 'hand',
  nodeKind: HarvestNodeKind,
): { allowed: boolean; reason?: string } {
  if (
    nodeKind === 'tree' ||
    nodeKind === 'berry_bush' ||
    nodeKind === 'barrel' ||
    nodeKind === 'crate'
  ) {
    return { allowed: true };
  }
  if (nodeKind === 'stone') {
    if (
      toolOrHand === 'wood_pickaxe' ||
      toolOrHand === 'pickaxe' ||
      toolOrHand === 'salvaged_pick'
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Punch trees for Wood and craft a Wooden Pickaxe to mine Stone',
    };
  }
  if (toolOrHand === 'pickaxe' || toolOrHand === 'salvaged_pick') {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Requires a Stone Pickaxe or Salvaged Pick to mine Metal, Sulfur & Sludge',
  };
}

export function damageInventorySlot(
  list: InventorySlot[],
  index: number,
  amount = 1,
): { damaged: boolean; broken: boolean; brokenItemId?: ItemId; remaining?: number } {
  const slot = list[index];
  if (!slot || !slot.itemId || slot.count <= 0) {
    return { damaged: false, broken: false };
  }
  const def = ITEMS[slot.itemId];
  const maxDur = slot.maxDurability ?? def?.maxDurability;
  if (!maxDur || maxDur <= 0) {
    return { damaged: false, broken: false };
  }
  const current = slot.durability ?? maxDur;
  const next = current - amount;
  slot.maxDurability = maxDur;
  if (next <= 0) {
    const brokenId = slot.itemId;
    slot.itemId = null;
    slot.count = 0;
    delete slot.durability;
    delete slot.maxDurability;
    return { damaged: true, broken: true, brokenItemId: brokenId, remaining: 0 };
  }
  slot.durability = next;
  return { damaged: true, broken: false, remaining: next };
}

export function isLightItem(id: ItemId | null | undefined): boolean {
  return (
    id === 'torch' ||
    id === 'flashlight_basic' ||
    id === 'flashlight_tactical' ||
    id === 'flashlight_sludge'
  );
}

export interface ActiveLightSource {
  area: 'hotbar' | 'backpack';
  index: number;
  itemId: ItemId;
  radius: number;
  intensity: number;
}

export function findBestLightSource(
  hotbar: ReadonlyArray<InventorySlot>,
  backpack: ReadonlyArray<InventorySlot>,
  selectedHotbarIndex: number,
): ActiveLightSource | null {
  const sel = hotbar[selectedHotbarIndex];
  if (sel?.itemId && isLightItem(sel.itemId) && (sel.durability === undefined || sel.durability > 0)) {
    const def = ITEMS[sel.itemId];
    return {
      area: 'hotbar',
      index: selectedHotbarIndex,
      itemId: sel.itemId,
      radius: def.lightRadius ?? 20,
      intensity: def.lightIntensity ?? 3.4,
    };
  }

  let best: ActiveLightSource | null = null;
  const checkList = (area: 'hotbar' | 'backpack', list: ReadonlyArray<InventorySlot>) => {
    for (let i = 0; i < list.length; i++) {
      const slot = list[i];
      if (!slot.itemId || !isLightItem(slot.itemId)) continue;
      if (slot.durability !== undefined && slot.durability <= 0) continue;
      const def = ITEMS[slot.itemId];
      const intensity = def.lightIntensity ?? 3.4;
      if (!best || intensity > best.intensity) {
        best = {
          area,
          index: i,
          itemId: slot.itemId,
          radius: def.lightRadius ?? 20,
          intensity,
        };
      }
    }
  };
  checkList('hotbar', hotbar);
  checkList('backpack', backpack);
  return best;
}

export function computeFallDamage(fallDistance: number, impactSpeed = 0): number {
  if (fallDistance <= 4.8 && impactSpeed <= 11.2) return 0;
  const distOver = Math.max(0, fallDistance - 4.5);
  const speedOver = Math.max(0, impactSpeed - 11.2) * 2.2;
  const raw = Math.max(distOver * 11.5, speedOver);
  return Math.max(4, Math.round(raw));
}

export function stepSwimBreath(
  currentBreath: number,
  inDeepWater: boolean,
  dt: number,
  maxBreath = 100,
): { breath: number; drowningDamage: number } {
  if (dt <= 0) return { breath: currentBreath, drowningDamage: 0 };
  if (inDeepWater) {
    const nextBreath = Math.max(0, currentBreath - 12.5 * dt);
    const drowningDamage = nextBreath <= 0 ? 14.5 * dt : 0;
    return { breath: nextBreath, drowningDamage };
  }
  return {
    breath: Math.min(maxBreath, currentBreath + 32 * dt),
    drowningDamage: 0,
  };
}

export function canActorAggroVertical(
  actorY: number,
  playerFootY: number,
  isRanged: boolean,
): boolean {
  return Math.abs(playerFootY - actorY) <= (isRanged ? 9.5 : 5.0);
}

export function canActorReachStructure(
  actorY: number,
  pieceY: number,
  pieceType: BuildPieceType,
  maxVertReach = 2.6,
): boolean {
  const pieceBot = pieceType === 'foundation' ? pieceY - 0.5 : pieceY;
  const pieceTop =
    pieceType === 'foundation'
      ? pieceY + FOUNDATION_HEIGHT
      : pieceType === 'floor'
        ? pieceY + FLOOR_THICKNESS
        : pieceY + WALL_HEIGHT;
  return pieceBot <= actorY + maxVertReach && pieceTop >= actorY - 0.5;
}

export interface NightTypeInfo {
  type: NightType;
  label: string;
  ambientMult: number;
  sunMult: number;
  fogDensityMult: number;
}

export function rollNightType(seedNum: number, dayCount: number): NightTypeInfo {
  let h = (seedNum ^ Math.imul(dayCount + 17, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  const roll = (h % 100) / 100;
  if (roll < 0.35) {
    return {
      type: 'pitch_dark',
      label: 'Pitch-Dark Night',
      ambientMult: 0.42,
      sunMult: 0.35,
      fogDensityMult: 1.28,
    };
  }
  if (roll < 0.7) {
    return {
      type: 'overcast',
      label: 'Overcast Night',
      ambientMult: 1.0,
      sunMult: 1.0,
      fogDensityMult: 1.0,
    };
  }
  return {
    type: 'moonlit',
    label: 'Moonlit Night',
    ambientMult: 1.85,
    sunMult: 1.75,
    fogDensityMult: 0.78,
  };
}

export function rollStructureLoot(
  seedNum: number,
  structureIndex: number,
): Array<{ itemId: ItemId; count: number; label: string }> {
  let h = (seedNum ^ Math.imul(structureIndex + 31, 0x45d9f3b)) >>> 0;
  const nextRand = () => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    return (h % 1000) / 1000;
  };
  const items: Array<{ itemId: ItemId; count: number; label: string }> = [];
  const r1 = nextRand();
  if (r1 < 0.32) items.push({ itemId: 'flashlight_basic', count: 1, label: 'Scrap Flashlight' });
  else if (r1 < 0.56) items.push({ itemId: 'flashlight_tactical', count: 1, label: 'Tactical Flashlight' });
  else if (r1 < 0.78) items.push({ itemId: 'hatchet', count: 1, label: 'Stone Hatchet' });
  else items.push({ itemId: 'pickaxe', count: 1, label: 'Stone Pickaxe' });

  const r2 = nextRand();
  if (r2 < 0.4) items.push({ itemId: 'ammo', count: 10 + Math.floor(nextRand() * 10), label: 'Shells' });
  else if (r2 < 0.75) items.push({ itemId: 'medkit', count: 1, label: 'Field Medkit' });
  else items.push({ itemId: 'cooked_meat', count: 2 + Math.floor(nextRand() * 2), label: 'Cooked Meat' });

  const r3 = nextRand();
  if (r3 < 0.22) {
    items.push({ itemId: 'turret_item', count: 1, label: 'Auto-Turret Bot' });
  } else if (r3 < 0.62) {
    items.push({ itemId: 'metal_frags', count: 20 + Math.floor(nextRand() * 20), label: 'Metal Frags' });
  } else {
    items.push({ itemId: 'sludge', count: 8 + Math.floor(nextRand() * 10), label: 'Bio-Sludge' });
  }
  return items;
}

export interface WorldBoxCollider {
  cx: number;
  cz: number;
  rotY: number;
  halfW: number;
  halfD: number;
  minY: number;
  maxY: number;
  walkable?: boolean;
  blocksProjectiles?: boolean;
}

export function resolveCircleVsOBB2D(
  pos: { x: number; z: number },
  centerX: number,
  centerZ: number,
  rotY: number,
  halfW: number,
  halfD: number,
  radius: number,
): boolean {
  const dx = pos.x - centerX;
  const dz = pos.z - centerZ;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);

  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;

  const cx = Math.max(-halfW, Math.min(halfW, lx));
  const cz = Math.max(-halfD, Math.min(halfD, lz));

  const rx = lx - cx;
  const rz = lz - cz;
  const distSq = rx * rx + rz * rz;
  if (distSq >= radius * radius) return false;

  let pushLX = 0;
  let pushLZ = 0;

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    pushLX = (rx / dist) * overlap;
    pushLZ = (rz / dist) * overlap;
  } else {
    const penLeft = lx + halfW;
    const penRight = halfW - lx;
    const penBack = lz + halfD;
    const penFront = halfD - lz;
    const minPen = Math.min(penLeft, penRight, penBack, penFront);
    if (minPen === penLeft) pushLX = -(penLeft + radius);
    else if (minPen === penRight) pushLX = penRight + radius;
    else if (minPen === penBack) pushLZ = -(penBack + radius);
    else pushLZ = penFront + radius;
  }

  pos.x += pushLX * cos + pushLZ * sin;
  pos.z += -pushLX * sin + pushLZ * cos;
  return true;
}

export function resolveWorldBoxCollisions(
  pos: { x: number; y: number; z: number },
  boxes: ReadonlyArray<WorldBoxCollider>,
  radius: number,
  eyeHeight = 1.65,
): void {
  if (boxes.length === 0) return;
  const footY = pos.y - eyeHeight;
  const headY = footY + 1.65;

  for (let pass = 0; pass < 2; pass++) {
    for (const box of boxes) {
      if (footY >= box.maxY - 0.16 || headY <= box.minY + 0.05) continue;
      // Allow stepping cleanly up onto low walkable slabs/decks/dock ramps
      if (box.walkable && footY >= box.maxY - 0.62) continue;
      resolveCircleVsOBB2D(pos, box.cx, box.cz, box.rotY, box.halfW, box.halfD, radius);
    }
  }
}

export function getWorldBoxFloorHeightAt(
  x: number,
  z: number,
  currentFootY: number,
  boxes: ReadonlyArray<WorldBoxCollider>,
  margin = 0.12,
): number | null {
  let highest: number | null = null;
  for (const box of boxes) {
    if (!box.walkable) continue;
    const dx = x - box.cx;
    const dz = z - box.cz;
    const cos = Math.cos(box.rotY);
    const sin = Math.sin(box.rotY);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= box.halfW + margin && Math.abs(lz) <= box.halfD + margin) {
      if (currentFootY >= box.maxY - 0.65 && (highest === null || box.maxY > highest)) {
        highest = box.maxY;
      }
    }
  }
  return highest;
}

export function isSegmentBlockedByWorldBoxes(
  boxes: ReadonlyArray<WorldBoxCollider>,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): { blocked: boolean; t: number } {
  let earliestT = 1.0;
  let blocked = false;

  for (const box of boxes) {
    if (box.blocksProjectiles === false) continue;
    const cos = Math.cos(box.rotY);
    const sin = Math.sin(box.rotY);

    const dx1 = x1 - box.cx;
    const dz1 = z1 - box.cz;
    const lx1 = dx1 * cos - dz1 * sin;
    const lz1 = dx1 * sin + dz1 * cos;

    const dx2 = x2 - box.cx;
    const dz2 = z2 - box.cz;
    const lx2 = dx2 * cos - dz2 * sin;
    const lz2 = dx2 * sin + dz2 * cos;

    if (
      segmentIntersectsLocalBox(
        lx1,
        y1,
        lz1,
        lx2,
        y2,
        lz2,
        -box.halfW,
        box.halfW,
        box.minY,
        box.maxY,
        -box.halfD,
        box.halfD,
      )
    ) {
      blocked = true;
      // Approximate entry t via midpoint check or return true
      const distTotal = Math.hypot(x2 - x1, y2 - y1, z2 - z1) || 1;
      const distBox = Math.max(0, Math.hypot(box.cx - x1, box.cz - z1) - Math.max(box.halfW, box.halfD));
      const approxT = Math.min(1, distBox / distTotal);
      if (approxT < earliestT) earliestT = approxT;
    }
  }

  return { blocked, t: earliestT };
}



