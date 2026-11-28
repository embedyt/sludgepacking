import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDATION_HEIGHT,
  FLOOR_THICKNESS,
  WALL_HEIGHT,
  BACKPACK_SIZE,
  DAY_CYCLE_SECONDS,
  HOTBAR_SIZE,
  ITEMS,
  RECIPES,
  TIER_MAX_HP,
} from './gameData';
import {
  PLACED_BARREL_EXPLODE_THRESHOLD,
  PLACED_BARREL_MAX_HP,
  WORLD_BARREL_EXPLODE_THRESHOLD,
  WORLD_BARREL_MAX_HP,
  addItemToInventory,
  applyArmorMitigation,
  applyBarrelShotDamage,
  applyPieceUpgrade,
  canActorAggroVertical,
  canActorReachStructure,
  canHarvestNodeWithTool,
  collectDeathDrops,
  computeBuildPlacement,
  computeFallDamage,
  computeHeadshotDamage,
  consumeOneFromSlot,
  craftRecipe,
  createInitialArmor,
  createInitialArmorDurability,
  createInitialBackpack,
  createInitialChestSlots,
  createInitialHotbar,
  createInitialResources,
  damageEquippedArmor,
  damageInventorySlot,
  detectDeviceIsPhone,
  dropSlotItem,
  equipArmorFromSlot,
  findBestLightSource,
  formatDayClock,
  formatPlayTime,
  getActorHeadSphere,
  getArmorDefense,
  getSurvivalModeInfo,
  getVersionLabel,
  getWorldBoxFloorHeightAt,
  hashSeedString,
  isNightTime,
  isSegmentBlockedByPieces,
  isSegmentBlockedByWorldBoxes,
  lootDeathBackpack,
  moveBetweenContainers,
  moveOrSwapSlot,
  quickMoveSlotBetweenHotbarAndBackpack,
  quickTransferContainerSlot,
  resolveControlMode,
  resolveWorldBoxCollisions,
  rollFishingCatch,
  rollNightType,
  rollStructureLoot,
  snapToGrid,
  stepSwimBreath,
  testSegmentActorHit,
  testSegmentCylinderHit,
  unequipArmorSlot,
  type WorldBoxCollider,
} from './rules';
import { computeCaveSites, groundHeightAt } from './WorldGenerator';
import type { PlacedBuildPiece } from '../types/game';

test('initial hotbar starts empty (bare hands) and 18-slot backpack initializes properly', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  assert.equal(hotbar.length, HOTBAR_SIZE);
  assert.equal(backpack.length, BACKPACK_SIZE);
  for (const slot of hotbar) {
    assert.equal(slot.itemId, null);
    assert.equal(slot.count, 0);
  }
  assert.equal(res.sludge, 0);
});

test('backpack catches overflow when hotbar fills and reports overflow when all 24 slots are full', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();

  for (let i = 0; i < 24; i++) {
    const r = addItemToInventory(hotbar, backpack, res, 'hatchet', 1);
    assert.equal(r.added, 1);
    assert.equal(r.overflow, 0);
  }
  assert.equal(hotbar[5].itemId, 'hatchet');
  assert.equal(backpack[17].itemId, 'hatchet');

  const fullResult = addItemToInventory(hotbar, backpack, res, 'pickaxe', 1);
  assert.equal(fullResult.added, 0);
  assert.equal(fullResult.overflow, 1);
});

test('moveOrSwapSlot and dropSlotItem manage hotbar/backpack slots cleanly', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();

  addItemToInventory(hotbar, backpack, res, 'arrow', 10);
  assert.equal(
    moveOrSwapSlot(hotbar, backpack, { area: 'hotbar', index: 0 }, { area: 'backpack', index: 0 }),
    true,
  );
  assert.equal(hotbar[0].itemId, null);
  assert.equal(backpack[0].itemId, 'arrow');
  assert.equal(backpack[0].count, 10);

  const one = dropSlotItem(hotbar, backpack, { area: 'backpack', index: 0 }, false);
  assert.deepEqual(one, { itemId: 'arrow', count: 1 });
  assert.equal(backpack[0].count, 9);

  const rest = dropSlotItem(hotbar, backpack, { area: 'backpack', index: 0 }, true);
  assert.deepEqual(rest, { itemId: 'arrow', count: 9 });
  assert.equal(backpack[0].itemId, null);
});

test('crafting hatchet consumes wood and stone and places item in hotbar with full durability', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  addItemToInventory(hotbar, backpack, res, 'wood', 60);
  addItemToInventory(hotbar, backpack, res, 'stone', 40);

  const hatchetRecipe = RECIPES.find((r) => r.outputItem === 'hatchet')!;
  const result = craftRecipe(hotbar, backpack, res, hatchetRecipe);

  assert.equal(result.ok, true);
  assert.equal(result.overflow, 0);
  assert.equal(res.wood, 25);
  assert.equal(res.stone, 20);
  assert.equal(hotbar[0].itemId, 'hatchet');
  assert.equal(hotbar[0].durability, ITEMS.hatchet.maxDurability);
});

test('snapToGrid normalizes -0 and aligns to 3m grid', () => {
  assert.equal(Object.is(snapToGrid(-0.7), 0), true);
  assert.equal(snapToGrid(1.6), 3);
  assert.equal(snapToGrid(-4.4), -3);
});

test('building placement fixes negative-side foundation expansion, walls, and roof floors', () => {
  const flatGround = () => 2.0;
  const pieces: PlacedBuildPiece[] = [
    {
      id: 'f0',
      type: 'foundation',
      tier: 'twig',
      x: 0,
      y: 2.0,
      z: 0,
      rotY: 0,
      hp: TIER_MAX_HP.twig,
      maxHp: TIER_MAX_HP.twig,
    },
  ];

  const negExpand = computeBuildPlacement({
    pieceType: 'foundation',
    aimX: -1.5,
    aimZ: 0,
    hitNormalX: -1,
    hitNormalZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
    hitPiece: pieces[0],
  });
  assert.equal(negExpand.valid, true);
  assert.equal(negExpand.x, -3);
  assert.equal(negExpand.z, 0);

  const wall = computeBuildPlacement({
    pieceType: 'wall',
    aimX: 1.4,
    aimZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
  });
  assert.equal(wall.valid, true);
  assert.equal(wall.x, 1.5);
  pieces.push({
    id: 'w1',
    type: 'wall',
    tier: 'twig',
    x: wall.x,
    y: wall.y,
    z: wall.z,
    rotY: wall.rotY,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  });

  const floor = computeBuildPlacement({
    pieceType: 'floor',
    aimX: 1.5,
    aimY: 4.9,
    aimZ: 0,
    hitNormalX: -1,
    hitNormalZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
    hitPiece: pieces[1],
  });
  assert.equal(floor.valid, true);
  assert.equal(floor.x, 0);
  assert.equal(floor.z, 0);
});

test('single foundation supports air-bridging floors in all 4 directions and chaining further in air', () => {
  const flatGround = () => 2.0;
  const f0: PlacedBuildPiece = {
    id: 'f0',
    type: 'foundation',
    tier: 'twig',
    x: 0,
    y: 2.0,
    z: 0,
    rotY: 0,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  const pieces: PlacedBuildPiece[] = [f0];

  const dirs = [
    { aimX: 3.1, aimZ: 0, expectedX: 3, expectedZ: 0 },
    { aimX: -3.1, aimZ: 0, expectedX: -3, expectedZ: 0 },
    { aimX: 0, aimZ: 3.1, expectedX: 0, expectedZ: 3 },
    { aimX: 0, aimZ: -3.1, expectedX: 0, expectedZ: -3 },
  ];

  for (const d of dirs) {
    const res = computeBuildPlacement({
      pieceType: 'floor',
      aimX: d.aimX,
      aimY: 2.45,
      aimZ: d.aimZ,
      groundYAt: flatGround,
      existingPieces: pieces,
      playerYaw: 0,
      rotSteps: 0,
      woodCount: 100,
    });
    assert.equal(res.valid, true);
    assert.equal(res.x, d.expectedX);
    assert.equal(res.z, d.expectedZ);
  }

  // Place +X floor at (3, 0), then extend further into empty air at (6, 0)
  const airFloor1: PlacedBuildPiece = {
    id: 'fl1',
    type: 'floor',
    tier: 'twig',
    x: 3,
    y: 2.45,
    z: 0,
    rotY: 0,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  pieces.push(airFloor1);

  const airFloor2 = computeBuildPlacement({
    pieceType: 'floor',
    aimX: 5.8,
    aimY: 2.45,
    aimZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
    hitPiece: airFloor1,
  });
  assert.equal(airFloor2.valid, true);
  assert.equal(airFloor2.x, 6);
  assert.equal(airFloor2.z, 0);
});

test('isSegmentBlockedByPieces stops melee/raider hits through walls, closed doors, and overhead floors', () => {
  const pieces: PlacedBuildPiece[] = [
    {
      id: 'w1',
      type: 'wall',
      tier: 'wood',
      x: 1.5,
      y: 2.0,
      z: 0,
      rotY: Math.PI / 2,
      hp: TIER_MAX_HP.wood,
      maxHp: TIER_MAX_HP.wood,
    },
    {
      id: 'd1',
      type: 'doorway',
      tier: 'wood',
      x: 0,
      y: 2.0,
      z: 1.5,
      rotY: 0,
      hp: TIER_MAX_HP.wood,
      maxHp: TIER_MAX_HP.wood,
      hasDoor: true,
      doorOpen: false,
    },
    {
      id: 'fl1',
      type: 'floor',
      tier: 'wood',
      x: 0,
      y: 5.2,
      z: 0,
      rotY: 0,
      hp: TIER_MAX_HP.wood,
      maxHp: TIER_MAX_HP.wood,
    },
  ];

  // Strike across wall w1
  const wallHit = isSegmentBlockedByPieces(pieces, 3.0, 3.0, 0, 0.2, 3.0, 0, true);
  assert.equal(wallHit.blocked, true);
  assert.equal(wallHit.pieceId, 'w1');

  // Strike through closed door d1
  const closedDoorHit = isSegmentBlockedByPieces(pieces, 0, 3.0, 3.0, 0, 3.0, 0, true);
  assert.equal(closedDoorHit.blocked, true);
  assert.equal(closedDoorHit.pieceId, 'd1');

  // Open the door -> strike is no longer blocked through center doorway
  pieces[1].doorOpen = true;
  const openDoorHit = isSegmentBlockedByPieces(pieces, 0, 3.0, 3.0, 0, 3.0, 0, true);
  assert.equal(openDoorHit.blocked, false);

  // Strike vertically across floor fl1
  const floorHit = isSegmentBlockedByPieces(pieces, 0, 3.0, 0, 0, 6.2, 0, true);
  assert.equal(floorHit.blocked, true);
  assert.equal(floorHit.pieceId, 'fl1');
});

test('armor equip/unequip and damage mitigation stack correctly up to 75% cap', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  const armor = createInitialArmor();

  addItemToInventory(hotbar, backpack, res, 'sludge_helmet', 1);
  addItemToInventory(hotbar, backpack, res, 'sludge_armor', 1);
  addItemToInventory(hotbar, backpack, res, 'sludge_greaves', 1);

  assert.equal(equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 0 }).ok, true);
  assert.equal(equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 1 }).ok, true);
  assert.equal(equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 2 }).ok, true);

  // 0.20 + 0.30 + 0.20 = 0.70 (70% DR)
  const def = getArmorDefense(armor);
  assert.ok(Math.abs(def - 0.7) < 0.0001);
  assert.equal(applyArmorMitigation(40, def), 12);

  const uneq = unequipArmorSlot(hotbar, backpack, res, armor, 'chest');
  assert.equal(uneq.ok, true);
  assert.equal(armor.chest, null);
  assert.ok(Math.abs(getArmorDefense(armor) - 0.4) < 0.0001);
});

test('food heals very little HP while medkit heals heavily, and day cycle is 420s', () => {
  assert.equal(DAY_CYCLE_SECONDS, 420);
  assert.ok((ITEMS.berries.healAmount ?? 0) <= 3);
  assert.ok((ITEMS.cooked_meat.healAmount ?? 0) <= 5);
  assert.ok((ITEMS.medkit.healAmount ?? 0) >= 70);
  assert.ok((ITEMS.sniper_rifle.damage ?? 0) >= 100);
});

test('island seed produces deterministic terrain and deep underground caves', () => {
  const seedA = hashSeedString('IRON-BAY-99');
  const seedB = hashSeedString('IRON-BAY-99');
  const seedC = hashSeedString('OTHER-SEED-12');
  assert.equal(seedA, seedB);
  assert.notEqual(seedA, seedC);

  const cavesA = computeCaveSites(seedA);
  const cavesB = computeCaveSites(seedB);
  assert.equal(cavesA.length, 3);
  assert.deepEqual(cavesA, cavesB);

  // Inside cave floor is recessed deeply below its enclosing hilltop roof
  for (const cave of cavesA) {
    const gy = groundHeightAt(cave.x, cave.z, seedA, cavesA);
    assert.ok(gy <= cave.floorY + 0.2);
    assert.ok(cave.hillHeight - gy >= 5.5);
  }
});

test('hammer upgrades twig -> wood -> stone and caps at stone', () => {
  const res = createInitialResources();
  res.wood = 100;
  res.stone = 100;
  const piece: PlacedBuildPiece = {
    id: 'p1',
    type: 'window_wall',
    tier: 'twig',
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };

  assert.equal(applyPieceUpgrade(piece, res), true);
  assert.equal(piece.tier, 'wood');
  assert.equal(applyPieceUpgrade(piece, res), true);
  assert.equal(piece.tier, 'stone');
  assert.equal(applyPieceUpgrade(piece, res), false);
});

test('day/night cycle helpers compute night and formatted clock', () => {
  assert.equal(formatDayClock(0.5), '12:00');
  assert.equal(isNightTime(0.05), true);
  assert.equal(isNightTime(0.5), false);
});

test('Camp Bed recipe crafts properly and swept shot detection handles headshots and fast bullets without tunneling', () => {
  const bedRecipe = RECIPES.find((r) => r.outputItem === 'bed_item');
  assert.ok(bedRecipe);

  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  res.wood = 50;
  res.cloth = 20;
  const craftRes = craftRecipe(hotbar, backpack, res, bedRecipe);
  assert.equal(craftRes.ok, true);
  assert.equal(hotbar[0].itemId, 'bed_item');

  const raider = {
    kind: 'raider_rusher' as const,
    x: 0,
    y: 2,
    z: 0,
    rotY: 0,
    radius: 0.6,
  };
  const raiderHead = getActorHeadSphere(raider);

  // High-velocity 5m bullet step crossing torso must register body hit (zero tunneling)
  const torsoHit = testSegmentActorHit(-2.5, 3.0, 0, 2.5, 3.0, 0, raider);
  assert.equal(torsoHit.hit, true);
  assert.equal(torsoHit.headshot, false);

  // Shot crossing head sphere registers headshot and boosts damage
  const headShot = testSegmentActorHit(-2.5, raiderHead.y, 0, 2.5, raiderHead.y, 0, raider);
  assert.equal(headShot.hit, true);
  assert.equal(headShot.headshot, true);
  assert.equal(computeHeadshotDamage(125, false, 2.25), 125);
  assert.equal(computeHeadshotDamage(125, true, 2.25), 281);

  // Taller Juggernaut head hit & quadruped Wolf forward head hit
  const jugg = {
    kind: 'raider_juggernaut' as const,
    x: 4,
    y: 0,
    z: 0,
    rotY: 0,
    radius: 0.85,
  };
  const juggHead = getActorHeadSphere(jugg);
  assert.equal(testSegmentActorHit(1.5, juggHead.y, 0, 6.5, juggHead.y, 0, jugg).headshot, true);

  const wolf = {
    kind: 'wolf' as const,
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    radius: 0.65,
  };
  const wolfHead = getActorHeadSphere(wolf);
  assert.equal(
    testSegmentActorHit(-2, wolfHead.y, wolfHead.z, 2, wolfHead.y, wolfHead.z, wolf).headshot,
    true,
  );

  // Shot well above head misses cleanly
  assert.equal(testSegmentActorHit(-2.5, raiderHead.y + 1.0, 0, 2.5, raiderHead.y + 1.0, 0, raider).hit, false);
});

test('multi-story upward building stacks walls on walls, climbs elevated floors, and snaps upper roofs cleanly', () => {
  const flatGround = () => 2.0;
  const f0: PlacedBuildPiece = {
    id: 'f0',
    type: 'foundation',
    tier: 'twig',
    x: 0,
    y: 2.0,
    z: 0,
    rotY: 0,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  const wall1: PlacedBuildPiece = {
    id: 'w1',
    type: 'wall',
    tier: 'twig',
    x: 1.5,
    y: 2.0 + FOUNDATION_HEIGHT,
    z: 0,
    rotY: Math.PI / 2,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  const pieces: PlacedBuildPiece[] = [f0, wall1];

  // 1. Stacking a Wall directly on top of Wall1 (aiming at hitPiece = wall1)
  const wall2Res = computeBuildPlacement({
    pieceType: 'wall',
    aimX: 1.5,
    aimY: 4.5,
    aimZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
    hitPiece: wall1,
  });
  assert.equal(wall2Res.valid, true);
  assert.equal(wall2Res.x, 1.5);
  assert.equal(wall2Res.z, 0);
  assert.ok(Math.abs(wall2Res.y - (wall1.y + WALL_HEIGHT)) < 0.02);

  // 2. Even if ray misses wall1 (no floor2 yet), aiming at upper elevation on occupied edge climbs upward
  const climbWall = computeBuildPlacement({
    pieceType: 'wall',
    aimX: 1.4,
    aimY: wall1.y + WALL_HEIGHT * 0.7,
    aimZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
  });
  assert.equal(climbWall.valid, true);
  assert.equal(climbWall.x, 1.5);
  assert.ok(Math.abs(climbWall.y - (wall1.y + WALL_HEIGHT)) < 0.02);

  // 3. Adding a 2nd-story Floor above Wall1, then placing a 2nd-story Wall on that Floor without snapping down to Foundation
  const floor2: PlacedBuildPiece = {
    id: 'fl2',
    type: 'floor',
    tier: 'twig',
    x: 0,
    y: wall1.y + WALL_HEIGHT,
    z: 0,
    rotY: 0,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  pieces.push(floor2);

  const upperWall = computeBuildPlacement({
    pieceType: 'wall',
    aimX: -1.4,
    aimY: floor2.y + 0.15,
    aimZ: 0,
    playerY: floor2.y + FLOOR_THICKNESS,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
  });
  assert.equal(upperWall.valid, true);
  assert.equal(upperWall.x, -1.5);
  assert.ok(Math.abs(upperWall.y - (floor2.y + FLOOR_THICKNESS)) < 0.02);

  // 4. Pushing wall2 and placing 3rd-story roof floor above wall2
  const wall2: PlacedBuildPiece = {
    id: 'w2',
    type: 'wall',
    tier: 'twig',
    x: 1.5,
    y: wall2Res.y,
    z: 0,
    rotY: wall2Res.rotY,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  pieces.push(wall2);

  const roof3 = computeBuildPlacement({
    pieceType: 'floor',
    aimX: 0.2,
    aimY: wall2.y + WALL_HEIGHT,
    aimZ: 0,
    groundYAt: flatGround,
    existingPieces: pieces,
    playerYaw: 0,
    rotSteps: 0,
    woodCount: 100,
  });
  assert.equal(roof3.valid, true);
  assert.equal(roof3.x, 0);
  assert.ok(Math.abs(roof3.y - (wall2.y + WALL_HEIGHT)) < 0.02);
});

test('explosive barrels craft cleanly, detonate at HP thresholds, and register fast swept shots', () => {
  assert.ok(ITEMS.barrel_item);
  const barrelRecipe = RECIPES.find((r) => r.outputItem === 'barrel_item');
  assert.ok(barrelRecipe);

  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  res.metal_frags = 40;
  res.sulfur = 40;
  res.sludge = 20;
  const craftRes = craftRecipe(hotbar, backpack, res, barrelRecipe);
  assert.equal(craftRes.ok, true);
  assert.equal(hotbar[0].itemId, 'barrel_item');

  // World barrel: 50 HP, threshold 20 HP
  const smgShot1 = applyBarrelShotDamage(WORLD_BARREL_MAX_HP, 28, WORLD_BARREL_EXPLODE_THRESHOLD);
  assert.equal(smgShot1.nextHp, 22);
  assert.equal(smgShot1.exploded, false);

  const smgShot2 = applyBarrelShotDamage(smgShot1.nextHp, 28, WORLD_BARREL_EXPLODE_THRESHOLD);
  assert.equal(smgShot2.nextHp, 0);
  assert.equal(smgShot2.exploded, true);

  const revShot = applyBarrelShotDamage(WORLD_BARREL_MAX_HP, 40, WORLD_BARREL_EXPLODE_THRESHOLD);
  assert.equal(revShot.nextHp, 10);
  assert.equal(revShot.exploded, true);

  // Placed barrel: 40 HP, threshold 25 HP
  const placedShot = applyBarrelShotDamage(PLACED_BARREL_MAX_HP, 20, PLACED_BARREL_EXPLODE_THRESHOLD);
  assert.equal(placedShot.nextHp, 20);
  assert.equal(placedShot.exploded, true);

  // Fast 5m swept shot hits cylinder barrel and high shot misses
  const hitBarrel = testSegmentCylinderHit(-2.5, 2.6, 0, 2.5, 2.6, 0, 0, 2.0, 0, 0.52, 1.3);
  assert.equal(hitBarrel.hit, true);
  const missAbove = testSegmentCylinderHit(-2.5, 4.0, 0, 2.5, 4.0, 0, 0, 2.0, 0, 0.52, 1.3);
  assert.equal(missAbove.hit, false);
});

test('survival mode classification maps Brutal, Hardcore, Ultrahardcore, True Hardcore and HP patterns correctly', () => {
  assert.deepEqual(getSurvivalModeInfo('standard', []), {
    tier: 'standard',
    label: 'Standard',
    hpPatternTier: 'none',
    challengeCount: 0,
    challengeBadge: null,
  });
  assert.deepEqual(getSurvivalModeInfo('chill', []), {
    tier: 'chill',
    label: 'Chill',
    hpPatternTier: 'none',
    challengeCount: 0,
    challengeBadge: null,
  });
  assert.deepEqual(getSurvivalModeInfo('chill', ['permadeath', 'no_regen'], true), {
    tier: 'sandbox',
    label: 'Sandbox',
    hpPatternTier: 'none',
    challengeCount: 2,
    challengeBadge: null,
  });
  assert.deepEqual(getSurvivalModeInfo('standard', ['blood_moon']), {
    tier: 'brutal',
    label: 'Brutal',
    hpPatternTier: 'brutal',
    challengeCount: 1,
    challengeBadge: '1 Challenge',
  });
  assert.deepEqual(getSurvivalModeInfo('brutal', []), {
    tier: 'brutal',
    label: 'Brutal',
    hpPatternTier: 'brutal',
    challengeCount: 0,
    challengeBadge: null,
  });
  assert.deepEqual(getSurvivalModeInfo('standard', ['permadeath']), {
    tier: 'hardcore',
    label: 'Hardcore',
    hpPatternTier: 'hardcore',
    challengeCount: 1,
    challengeBadge: '1 Challenge',
  });
  assert.deepEqual(getSurvivalModeInfo('standard', ['permadeath', 'no_regen']), {
    tier: 'ultrahardcore',
    label: 'Ultrahardcore',
    hpPatternTier: 'ultrahardcore',
    challengeCount: 2,
    challengeBadge: '2 Challenges',
  });
  assert.deepEqual(getSurvivalModeInfo('standard', ['permadeath', 'no_regen', 'blood_moon']), {
    tier: 'true_hardcore',
    label: 'True Hardcore',
    hpPatternTier: 'true_hardcore',
    challengeCount: 3,
    challengeBadge: '3 Challenges',
  });
  assert.deepEqual(getSurvivalModeInfo('standard', ['permadeath', 'no_regen', 'no_heal']), {
    tier: 'true_hardcore',
    label: 'True Hardcore',
    hpPatternTier: 'true_hardcore',
    challengeCount: 3,
    challengeBadge: '3 Challenges',
  });
});

test('collectDeathDrops gathers hotbar, backpack, equipped armor, and non-zero resources', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const resources = createInitialResources();
  const armor = createInitialArmor();

  hotbar[0] = { itemId: 'wood_pickaxe', count: 1 };
  hotbar[2] = { itemId: 'bow', count: 1 };
  backpack[0] = { itemId: 'cooked_fish', count: 4 };
  armor.head = 'sludge_helmet';
  resources.wood = 75;
  resources.sludge = 12;

  const drops = collectDeathDrops(hotbar, backpack, resources, armor);
  assert.ok(drops.some((d) => d.itemId === 'wood_pickaxe' && d.count === 1));
  assert.ok(drops.some((d) => d.itemId === 'bow' && d.count === 1));
  assert.ok(drops.some((d) => d.itemId === 'cooked_fish' && d.count === 4));
  assert.ok(drops.some((d) => d.itemId === 'sludge_helmet' && d.count === 1));
  assert.ok(drops.some((d) => d.itemId === 'wood' && d.count === 75));
  assert.ok(drops.some((d) => d.itemId === 'sludge' && d.count === 12));
  assert.equal(drops.some((d) => d.itemId === 'stone'), false);
});

test('6x4 chest container supports slot transfers and quick-transfer', () => {
  const chest = createInitialChestSlots();
  assert.equal(chest.length, 24);
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  hotbar[2] = { itemId: 'arrow', count: 12 };
  hotbar[3] = { itemId: 'arrow', count: 8 };

  assert.equal(
    moveBetweenContainers(
      hotbar,
      backpack,
      chest,
      { area: 'hotbar', index: 2 },
      { area: 'chest', index: 0 },
    ),
    true,
  );
  assert.equal(hotbar[2].itemId, null);
  assert.equal(chest[0].itemId, 'arrow');
  assert.equal(chest[0].count, 12);

  assert.equal(
    quickTransferContainerSlot(hotbar, backpack, chest, { area: 'hotbar', index: 3 }),
    true,
  );
  assert.equal(hotbar[3].itemId, null);
  assert.equal(chest[0].count, 20);
});

test('free-form foundation-anchored building rejects without foundation and allows free placement with one', () => {
  const flatGround = () => 2.0;
  const noBase = computeBuildPlacement({
    pieceType: 'wall',
    aimX: 8.4,
    aimZ: 6.2,
    groundYAt: flatGround,
    existingPieces: [],
    playerYaw: 0,
    rotSteps: 1,
    woodCount: 100,
  });
  assert.equal(noBase.valid, false);
  assert.equal(noBase.reason, 'Place a Foundation first');

  const f0: PlacedBuildPiece = {
    id: 'f0',
    type: 'foundation',
    tier: 'twig',
    x: 0,
    y: 2.0,
    z: 0,
    rotY: 0,
    hp: TIER_MAX_HP.twig,
    maxHp: TIER_MAX_HP.twig,
  };
  const freeWall = computeBuildPlacement({
    pieceType: 'wall',
    aimX: 8.4,
    aimZ: 6.2,
    groundYAt: flatGround,
    existingPieces: [f0],
    playerYaw: 0,
    rotSteps: 1,
    woodCount: 100,
  });
  assert.equal(freeWall.valid, true);
  assert.equal(freeWall.x, 8.4);
  assert.equal(freeWall.z, 6.2);
});

test('rollFishingCatch and formatPlayTime return valid outputs', () => {
  assert.equal(rollFishingCatch(0.1).itemId, 'raw_fish');
  assert.equal(rollFishingCatch(0.78).itemId, 'cloth');
  assert.equal(rollFishingCatch(0.995).itemId, 'barrel_item');
  assert.equal(formatPlayTime(45), '0m 45s');
  assert.equal(formatPlayTime(3665), '1h 01m 05s');
});

test('detectDeviceIsPhone and resolveControlMode auto-switch and honor overrides', () => {
  assert.equal(
    detectDeviceIsPhone({
      hasTouch: false,
      coarsePointer: false,
      innerWidth: 1440,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }),
    false,
  );
  // Desktop touchscreen laptop with fine mouse pointer stays PC
  assert.equal(
    detectDeviceIsPhone({
      hasTouch: true,
      coarsePointer: false,
      innerWidth: 1366,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }),
    false,
  );
  // Phone with coarse touch pointer or mobile UA resolves to Phone
  assert.equal(
    detectDeviceIsPhone({
      hasTouch: true,
      coarsePointer: true,
      innerWidth: 390,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    }),
    true,
  );
  assert.equal(
    detectDeviceIsPhone({
      hasTouch: true,
      coarsePointer: true,
      innerWidth: 844,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    }),
    true,
  );

  assert.equal(resolveControlMode('auto', false), 'pc');
  assert.equal(resolveControlMode('auto', true), 'phone');
  assert.equal(resolveControlMode('pc', true), 'pc');
  assert.equal(resolveControlMode('phone', false), 'phone');
});

test('getVersionLabel outputs 1.3 for PC and 1.3-mobile for phone', () => {
  assert.equal(getVersionLabel('pc'), '1.3');
  assert.equal(getVersionLabel('phone'), '1.3-mobile');
});

test('progression gating: hands punch trees only, wooden pickaxe mines stone, stone/salvaged pick mines ores', () => {
  assert.equal(canHarvestNodeWithTool('hand', 'tree').allowed, true);
  assert.equal(canHarvestNodeWithTool('hand', 'berry_bush').allowed, true);
  assert.equal(canHarvestNodeWithTool('hand', 'barrel').allowed, true);
  assert.equal(canHarvestNodeWithTool('hand', 'stone').allowed, false);
  assert.equal(canHarvestNodeWithTool('hand', 'metal').allowed, false);

  assert.equal(canHarvestNodeWithTool('wood_pickaxe', 'stone').allowed, true);
  assert.equal(canHarvestNodeWithTool('wood_pickaxe', 'metal').allowed, false);
  assert.equal(canHarvestNodeWithTool('wood_pickaxe', 'sludge').allowed, false);

  assert.equal(canHarvestNodeWithTool('pickaxe', 'metal').allowed, true);
  assert.equal(canHarvestNodeWithTool('pickaxe', 'sulfur').allowed, true);
  assert.equal(canHarvestNodeWithTool('salvaged_pick', 'sludge').allowed, true);
});

test('tool durability decays on use and breaks cleanly at zero', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  addItemToInventory(hotbar, backpack, res, 'wood_pickaxe', 1);

  assert.equal(hotbar[0].itemId, 'wood_pickaxe');
  assert.equal(hotbar[0].durability, ITEMS.wood_pickaxe.maxDurability);

  const hit1 = damageInventorySlot(hotbar, 0, 10);
  assert.equal(hit1.damaged, true);
  assert.equal(hit1.broken, false);
  assert.equal(hit1.remaining, (ITEMS.wood_pickaxe.maxDurability ?? 36) - 10);

  const breakHit = damageInventorySlot(hotbar, 0, 50);
  assert.equal(breakHit.damaged, true);
  assert.equal(breakHit.broken, true);
  assert.equal(breakHit.brokenItemId, 'wood_pickaxe');
  assert.equal(hotbar[0].itemId, null);
  assert.equal(hotbar[0].count, 0);
});

test('tiered lights: torch vs flashlights resolve best available light source', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  assert.equal(findBestLightSource(hotbar, backpack, 0), null);

  hotbar[2] = { itemId: 'torch', count: 1, durability: 80, maxDurability: 90 };
  backpack[0] = { itemId: 'flashlight_tactical', count: 1, durability: 300, maxDurability: 420 };

  // Selecting slot 2 (torch) uses the held torch
  const heldTorch = findBestLightSource(hotbar, backpack, 2);
  assert.equal(heldTorch?.itemId, 'torch');

  // Selecting empty slot 0 picks the highest-intensity carried light (tactical flashlight)
  const bestCarried = findBestLightSource(hotbar, backpack, 0);
  assert.equal(bestCarried?.itemId, 'flashlight_tactical');
});

test('fall damage scales past safe drop height and drowning drains breath in deep water', () => {
  assert.equal(computeFallDamage(3.0, 7.5), 0);
  assert.ok(computeFallDamage(9.0, 15.0) >= 40);

  let breath = 100;
  for (let i = 0; i < 8; i++) {
    breath = stepSwimBreath(breath, true, 1.0).breath;
  }
  assert.equal(breath, 0);
  const drownTick = stepSwimBreath(breath, true, 1.0);
  assert.ok(drownTick.drowningDamage > 10);

  const recoverTick = stepSwimBreath(50, false, 1.0);
  assert.ok(recoverTick.breath > 75);
  assert.equal(recoverTick.drowningDamage, 0);
});

test('vertical aggro range and raider reach ignore high unreachable structures', () => {
  assert.equal(canActorAggroVertical(2, 5.5, false), true);
  assert.equal(canActorAggroVertical(2, 11.0, false), false);
  assert.equal(canActorAggroVertical(2, 11.0, true), true);
  assert.equal(canActorAggroVertical(2, 16.0, true), false);

  // Wall 2 stories up (y=7.6) is unreachable by ground raider at y=2
  assert.equal(canActorReachStructure(2, 7.6, 'wall'), false);
  // Ground wall at y=2.45 is reachable
  assert.equal(canActorReachStructure(2, 2.45, 'wall'), true);
});

test('night types include pitch_dark, overcast, and moonlit and structure loot rolls valid items', () => {
  const seen = new Set<string>();
  for (let d = 1; d <= 30; d++) {
    seen.add(rollNightType(12345, d).type);
  }
  assert.equal(seen.has('pitch_dark'), true);
  assert.equal(seen.has('overcast'), true);
  assert.equal(seen.has('moonlit'), true);

  const loot = rollStructureLoot(98765, 0);
  assert.equal(loot.length, 3);
  for (const drop of loot) {
    assert.ok(ITEMS[drop.itemId]);
    assert.ok(drop.count >= 1);
  }
});

test('world structure OBB colliders block clipping, support walkable decks, and stop projectiles', () => {
  const boxes: WorldBoxCollider[] = [
    // Rotated solid bunker wall
    {
      cx: 10,
      cz: 5,
      rotY: Math.PI / 4,
      halfW: 2.0,
      halfD: 0.25,
      minY: 1.0,
      maxY: 4.0,
      walkable: false,
      blocksProjectiles: true,
    },
    // Walkable dock deck
    {
      cx: 0,
      cz: 0,
      rotY: 0,
      halfW: 3.0,
      halfD: 4.0,
      minY: 0.0,
      maxY: 0.55,
      walkable: true,
      blocksProjectiles: true,
    },
  ];

  // Player penetrating the rotated wall gets pushed out cleanly
  const pos = { x: 10, y: 2.85, z: 5.05 };
  resolveWorldBoxCollisions(pos, boxes, 0.45, 1.65);
  const dx = pos.x - 10;
  const dz = pos.z - 5;
  const cos = Math.cos(Math.PI / 4);
  const sin = Math.sin(Math.PI / 4);
  const localZ = dx * sin + dz * cos;
  assert.ok(Math.abs(localZ) >= 0.25 + 0.45 - 0.01);

  // Player stepping onto walkable dock deck gets deck floor height without horizontal pushback
  const dockWalkPos = { x: 0, y: 1.85, z: 0 };
  resolveWorldBoxCollisions(dockWalkPos, boxes, 0.45, 1.65);
  assert.equal(dockWalkPos.x, 0);
  assert.equal(dockWalkPos.z, 0);
  assert.equal(getWorldBoxFloorHeightAt(0, 0, 0.2, boxes), 0.55);

  // Segment through the rotated wall is blocked; segment in open air is clear
  assert.equal(isSegmentBlockedByWorldBoxes(boxes, 8, 2.5, 3, 12, 2.5, 7).blocked, true);
  assert.equal(isSegmentBlockedByWorldBoxes(boxes, -5, 2.5, -5, -5, 2.5, 5).blocked, false);
});

test('quickMoveSlotBetweenHotbarAndBackpack moves/stacks items and consumeOneFromSlot decrements cleanly', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();

  addItemToInventory(hotbar, backpack, res, 'revolver', 1, 42);
  addItemToInventory(hotbar, backpack, res, 'berries', 3);

  // Shift+click revolver from hotbar[0] -> moves to backpack[0] preserving durability 42
  assert.equal(
    quickMoveSlotBetweenHotbarAndBackpack(hotbar, backpack, { area: 'hotbar', index: 0 }),
    true,
  );
  assert.equal(hotbar[0].itemId, null);
  assert.equal(backpack[0].itemId, 'revolver');
  assert.equal(backpack[0].durability, 42);

  // Fill remaining hotbar slots then stack berries from backpack into hotbar[1]
  backpack[1] = { itemId: 'berries', count: 5 };
  assert.equal(
    quickMoveSlotBetweenHotbarAndBackpack(hotbar, backpack, { area: 'backpack', index: 1 }),
    true,
  );
  assert.equal(hotbar[1].itemId, 'berries');
  assert.equal(hotbar[1].count, 8);
  assert.equal(backpack[1].itemId, null);

  // Double-click consumeOneFromSlot eats 1 berry
  const consumed = consumeOneFromSlot(hotbar, backpack, { area: 'hotbar', index: 1 });
  assert.equal(consumed, 'berries');
  assert.equal(hotbar[1].count, 7);

  // Fill backpack completely and confirm quickMoveSlot returns false when destination has no free slot
  for (let i = 0; i < backpack.length; i++) {
    if (backpack[i].itemId === null) {
      backpack[i] = { itemId: 'hatchet', count: 1 };
    }
  }
  assert.equal(
    quickMoveSlotBetweenHotbarAndBackpack(hotbar, backpack, { area: 'hotbar', index: 1 }),
    false,
  );
});

test('weapon and armor durability track wear, preserve across equip/unequip/drop, and break at zero', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  const armor = createInitialArmor();
  const armorDur = createInitialArmorDurability();

  // Weapon durability decays per shot and breaks at 0
  addItemToInventory(hotbar, backpack, res, 'revolver', 1);
  assert.equal(hotbar[0].durability, ITEMS.revolver.maxDurability);
  const wHit = damageInventorySlot(hotbar, 0, 20);
  assert.equal(wHit.broken, false);
  assert.equal(hotbar[0].durability, (ITEMS.revolver.maxDurability ?? 95) - 20);
  const wBreak = damageInventorySlot(hotbar, 0, 999);
  assert.equal(wBreak.broken, true);
  assert.equal(wBreak.brokenItemId, 'revolver');
  assert.equal(hotbar[0].itemId, null);

  // Armor durability persists across equip -> combat wear -> unequip -> death drops
  addItemToInventory(hotbar, backpack, res, 'wood_helmet', 1, 30);
  addItemToInventory(hotbar, backpack, res, 'burlap_vest', 1, 10);
  assert.equal(
    equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 0 }, armorDur).ok,
    true,
  );
  assert.equal(
    equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 1 }, armorDur).ok,
    true,
  );
  assert.equal(armorDur.head, 30);
  assert.equal(armorDur.chest, 10);

  // Combat hit of 40 raw -> 11 wear: chest (10 -> <=0) breaks, head (30 -> 19) survives
  const wear = damageEquippedArmor(armor, armorDur, 40);
  assert.equal(wear.damaged, true);
  assert.deepEqual(wear.brokenPieces, ['burlap_vest']);
  assert.equal(armor.chest, null);
  assert.equal(armorDur.chest, undefined);
  assert.equal(armor.head, 'wood_helmet');
  assert.equal(armorDur.head, 19);

  // Unequip head preserves remaining durability 19
  const uneq = unequipArmorSlot(hotbar, backpack, res, armor, 'head', armorDur);
  assert.equal(uneq.ok, true);
  assert.equal(hotbar[0].itemId, 'wood_helmet');
  assert.equal(hotbar[0].durability, 19);

  // Re-equip and collectDeathDrops preserves durability 19
  equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 0 }, armorDur);
  const drops = collectDeathDrops(hotbar, backpack, res, armor, armorDur);
  const helmDrop = drops.find((d) => d.itemId === 'wood_helmet');
  assert.ok(helmDrop);
  assert.equal(helmDrop.durability, 19);
});

test('lootDeathBackpack recovers gear, auto-equips empty armor slots with durability, and preserves overflow', () => {
  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  const armor = createInitialArmor();
  const armorDur = createInitialArmorDurability();

  addItemToInventory(hotbar, backpack, res, 'sniper_rifle', 1, 52);
  addItemToInventory(hotbar, backpack, res, 'wood', 180);
  addItemToInventory(hotbar, backpack, res, 'sludge_helmet', 1, 91);
  equipArmorFromSlot(hotbar, backpack, armor, { area: 'hotbar', index: 1 }, armorDur);

  const bagItems = collectDeathDrops(hotbar, backpack, res, armor, armorDur);
  assert.equal(hotbar[0].itemId, null);
  assert.equal(armor.head, null);
  assert.equal(res.wood, 0);

  const recovered = lootDeathBackpack(bagItems, hotbar, backpack, res, armor, armorDur);
  assert.equal(recovered.remaining.length, 0);
  assert.equal(armor.head, 'sludge_helmet');
  assert.equal(armorDur.head, 91);
  assert.equal(res.wood, 180);
  assert.equal(hotbar[0].itemId, 'sniper_rifle');
  assert.equal(hotbar[0].durability, 52);

  // Overflow case: fill all 24 slots, then loot a bag with an extra non-stackable rifle
  for (let i = 0; i < hotbar.length; i++) {
    if (!hotbar[i].itemId) hotbar[i] = { itemId: 'hatchet', count: 1 };
  }
  for (let i = 0; i < backpack.length; i++) {
    if (!backpack[i].itemId) backpack[i] = { itemId: 'pickaxe', count: 1 };
  }
  const overflowRes = lootDeathBackpack(
    [{ itemId: 'revolver', count: 1, durability: 44, maxDurability: 95 }],
    hotbar,
    backpack,
    res,
    armor,
    armorDur,
  );
  assert.equal(overflowRes.collectedCount, 0);
  assert.equal(overflowRes.remaining.length, 1);
  assert.equal(overflowRes.remaining[0].itemId, 'revolver');
  assert.equal(overflowRes.remaining[0].durability, 44);
});

test('Bio-Floodlight Tower recipe is craftable under Building category', () => {
  const floodRecipe = RECIPES.find((r) => r.outputItem === 'floodlight_item');
  assert.ok(floodRecipe);
  assert.equal(floodRecipe.category, 'Building');

  const hotbar = createInitialHotbar();
  const backpack = createInitialBackpack();
  const res = createInitialResources();
  res.metal_frags = 30;
  res.sludge = 20;
  res.wood = 15;

  const result = craftRecipe(hotbar, backpack, res, floodRecipe);
  assert.equal(result.ok, true);
  assert.equal(hotbar[0].itemId, 'floodlight_item');
  assert.equal(res.metal_frags, 0);
  assert.equal(res.sludge, 0);
  assert.equal(res.wood, 0);
});






