import * as THREE from 'three';
import type { BuildingSystem } from './BuildingSystem';
import {
  type WorldBoxCollider,
  canActorAggroVertical,
  canActorReachStructure,
  computeHeadshotDamage,
  isSegmentBlockedByWorldBoxes,
  resolveWorldBoxCollisions,
  testSegmentActorHit,
  testSegmentCylinderHit,
} from './rules';
import type { ProceduralTextureSet } from './Textures';
import type { CaveSite } from './WorldGenerator';
import type { DeathBackpackData, DeathBackpackItem, DroppedItemData, EquippedVisualId, ItemId } from '../types/game';

export type EnemyKind =
  | 'wolf'
  | 'bear'
  | 'boar'
  | 'sludge_crawler'
  | 'raider_rusher'
  | 'raider_rifleman'
  | 'raider_sapper'
  | 'raider_juggernaut';

export interface ActorEntity {
  id: string;
  kind: EnemyKind;
  isRaider: boolean;
  isCaveMutant: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  rotY: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackRange: number;
  aggroRange: number;
  radius: number;
  state: 'wander' | 'chase' | 'strafe' | 'windup' | 'recover' | 'ko';
  stateTimer: number;
  windupDuration: number;
  flashTimer: number;
  koTimer: number;
  barricadeCooldown: number;
  wanderAngle: number;
  strafeDir: number;
  targetPieceId: string | null;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  telegraphRing: THREE.Mesh;
  limbs: THREE.Object3D[];
}

export interface DroppedBagVisual {
  data: DroppedItemData;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
}

export interface DeathBackpackVisual {
  data: DeathBackpackData;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  beacon: THREE.Mesh;
  ring: THREE.Mesh;
}

interface Projectile {
  active: boolean;
  isEnemy: boolean;
  isExplosive: boolean;
  blastRadius: number;
  headshotMult: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  damage: number;
  life: number;
  mesh: THREE.Mesh;
}

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

const PARTICLE_POOL_SIZE = 200;
const PROJECTILE_POOL_SIZE = 36;
const MAX_SIMULTANEOUS_ATTACK_TOKENS = 3;

export class CombatAndAI {
  public readonly worldRoot = new THREE.Group();
  public readonly viewmodelRoot = new THREE.Group();
  public readonly actors: ActorEntity[] = [];
  public readonly actorHitMeshes: THREE.Object3D[] = [];
  public readonly droppedBags: DroppedBagVisual[] = [];
  public readonly droppedHitMeshes: THREE.Object3D[] = [];
  public readonly deathBackpacks: DeathBackpackVisual[] = [];
  public readonly deathBackpackHitMeshes: THREE.Object3D[] = [];

  private particleMesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private particleCursor = 0;
  private projectiles: Projectile[] = [];

  private viewModels = new Map<EquippedVisualId, THREE.Group>();
  private currentEquipped: EquippedVisualId = 'hand';
  private swingAnim = 0;
  private recoilAnim = 0;

  private fishingBobberGroup: THREE.Group;
  private fishingLine: THREE.Line;
  private fishingLinePositions: Float32Array;

  private actorIdSeq = 1;
  private dropIdSeq = 1;
  private deathBagIdSeq = 1;
  private spawnTimer = 3.0;
  private raiderSpawnTimer = 4.0;

  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();
  private readonly _vecA = new THREE.Vector3();
  private readonly _vecB = new THREE.Vector3();

  private shadowMat: THREE.MeshBasicMaterial;

  constructor(private textures: ProceduralTextureSet) {
    this.worldRoot.name = 'CombatAIRoot';
    this.viewmodelRoot.name = 'ViewModelRoot';

    this.shadowMat = new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    const pGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        scale: 1,
        color: new THREE.Color(0xffffff),
      });
      this._dummy.scale.setScalar(0);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, this._color.setHex(0xffffff));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.worldRoot.add(this.particleMesh);

    const projGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.48, 6);
    projGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const mesh = new THREE.Mesh(projGeo, mat);
      mesh.visible = false;
      this.worldRoot.add(mesh);
      this.projectiles.push({
        active: false,
        isEnemy: false,
        isExplosive: false,
        blastRadius: 0,
        headshotMult: 2.0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        gravity: 0,
        damage: 25,
        life: 0,
        mesh,
      });
    }

    // 3D Fishing bobber & taut line
    this.fishingBobberGroup = new THREE.Group();
    const bobTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    );
    bobTop.position.y = 0.06;
    const bobBot = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
    );
    bobBot.position.y = -0.02;
    const bobPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    bobPin.position.y = 0.16;
    this.fishingBobberGroup.add(bobTop, bobBot, bobPin);
    this.fishingBobberGroup.visible = false;
    this.worldRoot.add(this.fishingBobberGroup);

    this.fishingLinePositions = new Float32Array(6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.fishingLinePositions, 3));
    this.fishingLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.78 }),
    );
    this.fishingLine.frustumCulled = false;
    this.fishingLine.visible = false;
    this.worldRoot.add(this.fishingLine);

    this.buildViewModels();
  }

  public setFishingVisual(
    bobberPos: THREE.Vector3 | null,
    rodTipPos: THREE.Vector3 | null,
    isBite: boolean,
    elapsed: number,
  ): void {
    if (!bobberPos) {
      this.fishingBobberGroup.visible = false;
      this.fishingLine.visible = false;
      return;
    }
    this.fishingBobberGroup.visible = true;
    const bobOffset = isBite
      ? -0.11 + Math.sin(elapsed * 24) * 0.08
      : Math.sin(elapsed * 2.8) * 0.035;
    this.fishingBobberGroup.position.set(bobberPos.x, bobberPos.y + bobOffset, bobberPos.z);

    if (rodTipPos) {
      this.fishingLine.visible = true;
      this.fishingLinePositions[0] = rodTipPos.x;
      this.fishingLinePositions[1] = rodTipPos.y;
      this.fishingLinePositions[2] = rodTipPos.z;
      this.fishingLinePositions[3] = bobberPos.x;
      this.fishingLinePositions[4] = bobberPos.y + bobOffset + 0.16;
      this.fishingLinePositions[5] = bobberPos.z;
      this.fishingLine.geometry.attributes.position.needsUpdate = true;
    } else {
      this.fishingLine.visible = false;
    }
  }

  public spawnBurst(pos: THREE.Vector3, hexColor: number, count: number, speed = 5.5): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;

      p.active = true;
      p.pos.copy(pos);
      p.vel.set(
        (Math.random() - 0.5) * speed * 1.4,
        Math.random() * speed * 1.1 + 1.2,
        (Math.random() - 0.5) * speed * 1.4,
      );
      p.maxLife = 0.28 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.scale = 0.65 + Math.random() * 0.9;
      p.color.setHex(hexColor);
    }
  }

  public spawnProjectile(params: {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    speed: number;
    gravity: number;
    damage: number;
    isEnemy: boolean;
    color: number;
    scaleZ?: number;
    scaleXY?: number;
    isExplosive?: boolean;
    blastRadius?: number;
    headshotMult?: number;
  }): void {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.isEnemy = params.isEnemy;
    slot.isExplosive = Boolean(params.isExplosive);
    slot.blastRadius = params.blastRadius ?? 0;
    slot.headshotMult = params.headshotMult ?? 2.0;
    slot.pos.copy(params.origin);
    slot.vel.copy(params.direction).normalize().multiplyScalar(params.speed);
    slot.gravity = params.gravity;
    slot.damage = params.damage;
    slot.life = params.isExplosive ? 3.0 : 2.4;
    slot.mesh.visible = true;
    slot.mesh.position.copy(slot.pos);
    (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(params.color);
    const xy = params.scaleXY ?? 1;
    slot.mesh.scale.set(xy, xy, params.scaleZ ?? 1);
    this._vecA.copy(slot.pos).add(slot.vel);
    slot.mesh.lookAt(this._vecA);
  }

  public findClosestSweptHit(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ): { actorId: string; headshot: boolean; t: number } | null {
    let best: { actorId: string; headshot: boolean; t: number } | null = null;
    for (const actor of this.actors) {
      if (actor.state === 'ko') continue;
      const res = testSegmentActorHit(ax, ay, az, bx, by, bz, actor);
      if (res.hit && (!best || res.t < best.t)) {
        best = { actorId: actor.id, headshot: res.headshot, t: res.t };
      }
    }
    return best;
  }

  public spawnDroppedItem(
    itemId: ItemId,
    count: number,
    x: number,
    y: number,
    z: number,
    idOverride?: string,
    durability?: number,
    maxDurability?: number,
  ): DroppedItemData {
    const id = idOverride ?? `drop_${this.dropIdSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y + 0.18, z);

    const sackMat = new THREE.MeshStandardMaterial({
      color: 0x8b6b46,
      roughness: 0.88,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.5,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.32), sackMat);
    crate.castShadow = true;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.34), bandMat);
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowMat);
    beacon.position.y = 0.24;

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.65, 0.65),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.userData.dropId = id;

    group.add(crate, strap, beacon, hitMesh);
    this.worldRoot.add(group);
    this.droppedHitMeshes.push(hitMesh);

    const data: DroppedItemData = {
      id,
      itemId,
      count,
      x,
      y,
      z,
      ...(durability !== undefined ? { durability } : {}),
      ...(maxDurability !== undefined ? { maxDurability } : {}),
    };
    this.droppedBags.push({ data, group, hitMesh });
    return data;
  }

  public removeDroppedItem(dropId: string): DroppedItemData | null {
    const idx = this.droppedBags.findIndex((b) => b.data.id === dropId);
    if (idx === -1) return null;
    const bag = this.droppedBags[idx];
    this.worldRoot.remove(bag.group);
    const hIdx = this.droppedHitMeshes.indexOf(bag.hitMesh);
    if (hIdx !== -1) this.droppedHitMeshes.splice(hIdx, 1);
    this.droppedBags.splice(idx, 1);
    return bag.data;
  }

  public exportDroppedItems(): DroppedItemData[] {
    return this.droppedBags.map((b) => ({ ...b.data }));
  }

  public restoreDroppedItems(items: DroppedItemData[]): void {
    this.clearDroppedItems();
    let maxId = 0;
    for (const d of items) {
      this.spawnDroppedItem(d.itemId, d.count, d.x, d.y, d.z, d.id, d.durability, d.maxDurability);
      const n = Number(d.id.replace(/\D+/g, ''));
      if (Number.isFinite(n) && n > maxId) maxId = n;
    }
    this.dropIdSeq = Math.max(1, maxId + 1);
  }

  public clearDroppedItems(): void {
    for (const bag of this.droppedBags) {
      this.worldRoot.remove(bag.group);
    }
    this.droppedBags.length = 0;
    this.droppedHitMeshes.length = 0;
  }

  public spawnDeathBackpack(
    items: DeathBackpackItem[],
    x: number,
    y: number,
    z: number,
    idOverride?: string,
    createdAtOverride?: number,
  ): DeathBackpackData {
    const id = idOverride ?? `deathbag_${this.deathBagIdSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const packMat = new THREE.MeshStandardMaterial({
      color: 0x3b4836,
      roughness: 0.85,
      metalness: 0.1,
    });
    const flapMat = new THREE.MeshStandardMaterial({
      color: 0x6c4c2f,
      roughness: 0.78,
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.45,
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.38), packMat);
    body.position.y = 0.34;
    body.rotation.x = -0.14;
    body.castShadow = true;

    const topFlap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.42), flapMat);
    topFlap.position.set(0, 0.62, -0.02);
    topFlap.rotation.x = -0.14;

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.14), flapMat);
    pocket.position.set(0, 0.25, 0.21);

    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.44), strapMat);
    strapL.position.set(-0.16, 0.36, 0);
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.44), strapMat);
    strapR.position.set(0.16, 0.36, 0);

    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), beaconMat);
    beacon.position.y = 1.12;

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 20), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.35, 1.15),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.55;
    hitMesh.userData.deathBagId = id;

    group.add(body, topFlap, pocket, strapL, strapR, beacon, ring, hitMesh);
    this.worldRoot.add(group);
    this.deathBackpackHitMeshes.push(hitMesh);

    const data: DeathBackpackData = {
      id,
      x,
      y,
      z,
      createdAt: createdAtOverride ?? Date.now(),
      items: items.map((it) => ({ ...it })),
    };
    this.deathBackpacks.push({ data, group, hitMesh, beacon, ring });
    return data;
  }

  public updateDeathBackpackItems(bagId: string, remaining: DeathBackpackItem[]): void {
    const bag = this.deathBackpacks.find((b) => b.data.id === bagId);
    if (!bag) return;
    if (remaining.length === 0) {
      this.removeDeathBackpack(bagId);
    } else {
      bag.data.items = remaining.map((it) => ({ ...it }));
    }
  }

  public removeDeathBackpack(bagId: string): DeathBackpackData | null {
    const idx = this.deathBackpacks.findIndex((b) => b.data.id === bagId);
    if (idx === -1) return null;
    const bag = this.deathBackpacks[idx];
    this.worldRoot.remove(bag.group);
    const hIdx = this.deathBackpackHitMeshes.indexOf(bag.hitMesh);
    if (hIdx !== -1) this.deathBackpackHitMeshes.splice(hIdx, 1);
    this.deathBackpacks.splice(idx, 1);
    return bag.data;
  }

  public exportDeathBackpacks(): DeathBackpackData[] {
    return this.deathBackpacks.map((b) => ({
      ...b.data,
      items: b.data.items.map((it) => ({ ...it })),
    }));
  }

  public restoreDeathBackpacks(bags: DeathBackpackData[]): void {
    this.clearDeathBackpacks();
    let maxId = 0;
    for (const bag of bags) {
      if (!bag.items || bag.items.length === 0) continue;
      this.spawnDeathBackpack(bag.items, bag.x, bag.y, bag.z, bag.id, bag.createdAt);
      const n = Number(bag.id.replace(/\D+/g, ''));
      if (Number.isFinite(n) && n > maxId) maxId = n;
    }
    this.deathBagIdSeq = Math.max(1, maxId + 1);
  }

  public clearDeathBackpacks(): void {
    for (const bag of this.deathBackpacks) {
      this.worldRoot.remove(bag.group);
    }
    this.deathBackpacks.length = 0;
    this.deathBackpackHitMeshes.length = 0;
  }

  public triggerViewSwing(heavy = false): void {
    this.swingAnim = heavy ? 1.15 : 1.0;
  }

  public triggerViewRecoil(strength = 1.0): void {
    this.recoilAnim = Math.min(1.5, this.recoilAnim + strength);
  }

  public setEquippedItem(itemId: EquippedVisualId): void {
    this.currentEquipped = itemId;
    for (const [id, grp] of this.viewModels.entries()) {
      grp.visible = id === itemId;
    }
  }

  public updateViewmodel(
    dt: number,
    walkDist: number,
    aiming: boolean,
    elapsed: number,
    hideForScope = false,
  ): void {
    this.viewmodelRoot.visible = !hideForScope;
    this.swingAnim = Math.max(0, this.swingAnim - dt * 4.2);
    this.recoilAnim = Math.max(0, this.recoilAnim - dt * 6.5);

    const isGunOrBow =
      this.currentEquipped === 'bow' ||
      this.currentEquipped === 'crossbow' ||
      this.currentEquipped === 'pipe_shotgun' ||
      this.currentEquipped === 'revolver' ||
      this.currentEquipped === 'smg' ||
      this.currentEquipped === 'sniper_rifle';

    const targetX = aiming && isGunOrBow ? 0.04 : 0.34;
    const targetY = aiming && isGunOrBow ? -0.21 : -0.29;
    const targetZ = aiming && isGunOrBow ? -0.44 : -0.52;

    const bobX = Math.cos(walkDist * 2.1) * (aiming ? 0.004 : 0.016);
    const bobY = Math.abs(Math.sin(walkDist * 2.1)) * (aiming ? 0.004 : 0.018);

    this.viewmodelRoot.position.x = THREE.MathUtils.damp(
      this.viewmodelRoot.position.x,
      targetX + bobX,
      16,
      dt,
    );
    this.viewmodelRoot.position.y = THREE.MathUtils.damp(
      this.viewmodelRoot.position.y,
      targetY - bobY,
      16,
      dt,
    );
    this.viewmodelRoot.position.z = THREE.MathUtils.damp(
      this.viewmodelRoot.position.z,
      targetZ + this.recoilAnim * 0.09,
      18,
      dt,
    );

    const swingCurve = Math.sin(this.swingAnim * Math.PI);
    this.viewmodelRoot.rotation.x =
      -swingCurve * 0.85 + this.recoilAnim * 0.18 + Math.sin(elapsed * 2.0) * 0.006;
    this.viewmodelRoot.rotation.y = swingCurve * 0.42;
    this.viewmodelRoot.rotation.z = swingCurve * 0.3;
  }

  public seedInitialWildlife(
    groundYAt: (x: number, z: number) => number,
    caveSites: readonly CaveSite[] = [],
  ): void {
    const spots: Array<{ kind: EnemyKind; x: number; z: number }> = [
      { kind: 'boar', x: -16, z: 22 },
      { kind: 'boar', x: 20, z: 18 },
      { kind: 'wolf', x: -24, z: 18 },
      { kind: 'wolf', x: 26, z: -16 },
      { kind: 'wolf', x: 18, z: 32 },
      { kind: 'bear', x: -32, z: -26 },
      { kind: 'bear', x: 34, z: 10 },
    ];
    for (const s of spots) {
      this.spawnActor(s.kind, s.x, s.z, groundYAt);
    }

    // Spawn Sludge Crawler cave guardians in underground caves
    for (const cave of caveSites) {
      const gx = cave.x + Math.cos(cave.entranceAngle + Math.PI) * 3.8;
      const gz = cave.z + Math.sin(cave.entranceAngle + Math.PI) * 3.8;
      this.spawnActor('sludge_crawler', gx, gz, groundYAt);
    }
  }

  public spawnActor(
    kind: EnemyKind,
    x: number,
    z: number,
    groundYAt: (x: number, z: number) => number,
  ): ActorEntity {
    const isRaider =
      kind === 'raider_rusher' ||
      kind === 'raider_rifleman' ||
      kind === 'raider_sapper' ||
      kind === 'raider_juggernaut';
    const isCaveMutant = kind === 'sludge_crawler';
    const built = this.createActorMesh(kind);
    const y = groundYAt(x, z);
    built.group.position.set(x, y, z);
    this.worldRoot.add(built.group);

    const id = `actor_${this.actorIdSeq++}`;
    built.hitMesh.userData.actorId = id;
    this.actorHitMeshes.push(built.hitMesh);

    const stats: Record<
      EnemyKind,
      { hp: number; speed: number; dmg: number; range: number; aggro: number; radius: number; windup: number }
    > = {
      boar: { hp: 65, speed: 5.0, dmg: 9, range: 2.0, aggro: 16, radius: 0.65, windup: 0.4 },
      wolf: { hp: 75, speed: 5.8, dmg: 12, range: 2.1, aggro: 22, radius: 0.65, windup: 0.35 },
      bear: { hp: 165, speed: 4.5, dmg: 22, range: 2.5, aggro: 20, radius: 1.0, windup: 0.55 },
      sludge_crawler: { hp: 120, speed: 5.2, dmg: 18, range: 2.2, aggro: 16, radius: 0.72, windup: 0.42 },
      raider_rusher: { hp: 95, speed: 5.1, dmg: 14, range: 2.1, aggro: 65, radius: 0.6, windup: 0.4 },
      raider_rifleman: { hp: 80, speed: 3.9, dmg: 13, range: 22, aggro: 65, radius: 0.6, windup: 0.55 },
      raider_sapper: { hp: 125, speed: 4.2, dmg: 32, range: 2.6, aggro: 70, radius: 0.7, windup: 0.5 },
      raider_juggernaut: { hp: 230, speed: 3.5, dmg: 26, range: 2.6, aggro: 75, radius: 0.85, windup: 0.55 },
    };

    const st = stats[kind];
    const actor: ActorEntity = {
      id,
      kind,
      isRaider,
      isCaveMutant,
      x,
      y,
      z,
      vx: 0,
      vz: 0,
      rotY: Math.random() * Math.PI * 2,
      hp: st.hp,
      maxHp: st.hp,
      speed: st.speed,
      attackDamage: st.dmg,
      attackRange: st.range,
      aggroRange: st.aggro,
      radius: st.radius,
      state: 'wander',
      stateTimer: 1.0 + Math.random() * 2.0,
      windupDuration: st.windup,
      flashTimer: 0,
      koTimer: 0,
      barricadeCooldown: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      targetPieceId: null,
      group: built.group,
      hitMesh: built.hitMesh,
      telegraphRing: built.telegraphRing,
      limbs: built.limbs,
    };
    this.actors.push(actor);
    return actor;
  }

  public damageActor(
    actorId: string,
    damage: number,
    knockDir?: THREE.Vector3,
    headshot = false,
  ): { hit: boolean; killed: boolean; kind?: EnemyKind; pos?: THREE.Vector3; headshot: boolean } {
    const actor = this.actors.find((a) => a.id === actorId);
    if (!actor || actor.state === 'ko') return { hit: false, killed: false, headshot: false };

    actor.hp -= damage;
    actor.flashTimer = headshot ? 0.14 : 0.08;
    if (knockDir) {
      const knockScale = headshot ? 7.2 : 5.5;
      actor.vx += knockDir.x * knockScale;
      actor.vz += knockDir.z * knockScale;
    }

    const burstY = headshot
      ? actor.y + (actor.isRaider || actor.isCaveMutant ? 1.65 : 0.85)
      : actor.y + 1.0;
    const hitPos = new THREE.Vector3(actor.x, burstY, actor.z);
    this.spawnBurst(
      hitPos,
      actor.isCaveMutant ? 0x4ade80 : actor.isRaider ? 0xdc2626 : 0xb91c1c,
      headshot ? 16 : 10,
      headshot ? 5.8 : 4.5,
    );
    if (headshot) {
      this.spawnBurst(hitPos, 0xfef08a, 10, 6.2);
    }

    if (actor.hp <= 0) {
      actor.state = 'ko';
      actor.koTimer = 0.42;
      actor.telegraphRing.visible = false;
      this.spawnBurst(hitPos, 0xfef08a, 14, 6.0);
      return { hit: true, killed: true, kind: actor.kind, pos: hitPos, headshot };
    }

    if (actor.state === 'wander') {
      actor.state = 'chase';
      actor.stateTimer = 2.0;
    }
    return { hit: true, killed: false, kind: actor.kind, pos: hitPos, headshot };
  }

  public update(params: {
    simDt: number;
    realDt: number;
    elapsed: number;
    playerPos: THREE.Vector3;
    isNight: boolean;
    dayCount: number;
    enemyDamageMult?: number;
    maxRaidersBonus?: number;
    bloodMoon?: boolean;
    groundYAt: (x: number, z: number) => number;
    worldColliders?: ReadonlyArray<{ x: number; z: number; radius: number; height?: number; nodeId?: string }>;
    worldBoxes?: ReadonlyArray<WorldBoxCollider>;
    isNodeAlive?: (nodeId: string) => boolean;
    building: BuildingSystem;
    onPlayerHit: (damage: number, sourceLabel: string) => void;
    onStructureHit: (pieceId: string, pos: THREE.Vector3) => void;
    onActorShotHit: (actorId: string, damage: number, dir: THREE.Vector3, headshot: boolean) => void;
    onExplosion?: (pos: THREE.Vector3, radius: number, damage: number) => void;
    onPlacedBarrelShot?: (barrelId: string, pos: THREE.Vector3, damage: number) => boolean;
    onChestShot?: (chestId: string, pos: THREE.Vector3, damage: number) => boolean;
    onTurretShot?: (turretId: string, pos: THREE.Vector3, damage: number) => boolean;
    onWorldNodeShot?: (nodeId: string, pos: THREE.Vector3, damage: number) => boolean;
  }): { wildlifeCount: number; raiderCount: number } {
    const {
      simDt,
      realDt,
      elapsed,
      playerPos,
      isNight,
      dayCount,
      enemyDamageMult = 1.0,
      maxRaidersBonus = 0,
      bloodMoon = false,
      groundYAt,
      worldColliders = [],
      worldBoxes = [],
      isNodeAlive,
      building,
      onPlayerHit,
      onStructureHit,
      onActorShotHit,
      onExplosion,
      onPlacedBarrelShot,
      onChestShot,
      onTurretShot,
      onWorldNodeShot,
    } = params;

    const dmgScale = enemyDamageMult * (bloodMoon && isNight ? 1.25 : 1.0);
    const playerFootY = playerPos.y - 1.68;

    // Spin dropped loot bags gently
    for (let i = 0; i < this.droppedBags.length; i++) {
      const bag = this.droppedBags[i];
      bag.group.rotation.y = elapsed * 1.4 + i;
      bag.group.position.y = bag.data.y + 0.18 + Math.sin(elapsed * 3.0 + i) * 0.05;
    }

    // Pulse & hover Death Backpack beacons
    for (let i = 0; i < this.deathBackpacks.length; i++) {
      const db = this.deathBackpacks[i];
      db.beacon.rotation.y = elapsed * 2.2 + i;
      db.beacon.position.y = 1.12 + Math.sin(elapsed * 3.4 + i) * 0.1;
      const ringPulse = 0.92 + Math.sin(elapsed * 3.2 + i) * 0.12;
      db.ring.scale.set(ringPulse, ringPulse, 1);
    }

    // 1. Update pooled particles
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= realDt;
      if (p.life <= 0) {
        p.active = false;
        this._dummy.scale.setScalar(0);
        this._dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      p.vel.y -= 13.5 * realDt;
      p.pos.addScaledVector(p.vel, realDt);
      const t = p.life / p.maxLife;
      this._dummy.position.copy(p.pos);
      this._dummy.rotation.set(elapsed * 4 + i, elapsed * 3, i);
      this._dummy.scale.setScalar(p.scale * t);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // 2. Update Projectiles (with Building Wall/Door/Floor & World Obstacle occlusion)
    if (simDt > 0) {
      for (const proj of this.projectiles) {
        if (!proj.active) continue;
        proj.life -= simDt;
        if (proj.life <= 0) {
          if (proj.isExplosive && onExplosion) {
            onExplosion(proj.pos.clone(), proj.blastRadius, proj.damage);
          }
          proj.active = false;
          proj.mesh.visible = false;
          continue;
        }
        proj.vel.y -= proj.gravity * simDt;
        this._vecA.copy(proj.pos);
        proj.pos.addScaledVector(proj.vel, simDt);
        proj.mesh.position.copy(proj.pos);
        this._vecB.copy(proj.pos).add(proj.vel);
        proj.mesh.lookAt(this._vecB);

        // Check swept player-projectile vs enemies first along segment (ensuring no wall stands between origin and impact point)
        if (!proj.isEnemy) {
          const swept = this.findClosestSweptHit(
            this._vecA.x,
            this._vecA.y,
            this._vecA.z,
            proj.pos.x,
            proj.pos.y,
            proj.pos.z,
          );
          if (swept) {
            const impactX = THREE.MathUtils.lerp(this._vecA.x, proj.pos.x, swept.t);
            const impactY = THREE.MathUtils.lerp(this._vecA.y, proj.pos.y, swept.t);
            const impactZ = THREE.MathUtils.lerp(this._vecA.z, proj.pos.z, swept.t);
            const occludedByWall = building.isSegmentBlocked(
              this._vecA.x,
              this._vecA.y,
              this._vecA.z,
              impactX,
              impactY,
              impactZ,
              false,
            );
            if (!occludedByWall.blocked) {
              if (proj.isExplosive && onExplosion) {
                onExplosion(new THREE.Vector3(impactX, impactY, impactZ), proj.blastRadius, proj.damage);
              } else {
                this._vecB.copy(proj.vel).normalize();
                const finalDamage = computeHeadshotDamage(
                  proj.damage,
                  swept.headshot,
                  proj.headshotMult,
                );
                onActorShotHit(swept.actorId, finalDamage, this._vecB, swept.headshot);
              }
              proj.active = false;
              proj.mesh.visible = false;
              continue;
            }
          }
        }

        // Check swept projectile vs placed Explosive Barrels
        let hitPlacedBarrel: { id: string; t: number; pos: THREE.Vector3 } | null = null;
        for (const barrel of building.barrels) {
          const hit = testSegmentCylinderHit(
            this._vecA.x,
            this._vecA.y,
            this._vecA.z,
            proj.pos.x,
            proj.pos.y,
            proj.pos.z,
            barrel.x,
            barrel.y,
            barrel.z,
            0.52,
            1.28,
          );
          if (hit.hit && (!hitPlacedBarrel || hit.t < hitPlacedBarrel.t)) {
            hitPlacedBarrel = {
              id: barrel.id,
              t: hit.t,
              pos: new THREE.Vector3(
                THREE.MathUtils.lerp(this._vecA.x, proj.pos.x, hit.t),
                THREE.MathUtils.lerp(this._vecA.y, proj.pos.y, hit.t),
                THREE.MathUtils.lerp(this._vecA.z, proj.pos.z, hit.t),
              ),
            };
          }
        }
        if (hitPlacedBarrel) {
          const occluded = building.isSegmentBlocked(
            this._vecA.x,
            this._vecA.y,
            this._vecA.z,
            hitPlacedBarrel.pos.x,
            hitPlacedBarrel.pos.y,
            hitPlacedBarrel.pos.z,
            false,
          );
          if (!occluded.blocked) {
            if (proj.isExplosive && onExplosion) {
              onExplosion(hitPlacedBarrel.pos, proj.blastRadius, proj.damage);
            } else {
              onPlacedBarrelShot?.(hitPlacedBarrel.id, hitPlacedBarrel.pos, proj.damage);
            }
            proj.active = false;
            proj.mesh.visible = false;
            continue;
          }
        }

        // Placed Chest impact check (friendly fire / explosive breach)
        if (building.chests.length > 0 && !proj.isEnemy) {
          let hitChest: { id: string; t: number; pos: THREE.Vector3 } | null = null;
          for (const chest of building.chests) {
            const hit = testSegmentCylinderHit(
              this._vecA.x,
              this._vecA.y,
              this._vecA.z,
              proj.pos.x,
              proj.pos.y,
              proj.pos.z,
              chest.x,
              chest.y,
              chest.z,
              0.62,
              0.82,
            );
            if (hit.hit && (!hitChest || hit.t < hitChest.t)) {
              hitChest = {
                id: chest.id,
                t: hit.t,
                pos: new THREE.Vector3(
                  THREE.MathUtils.lerp(this._vecA.x, proj.pos.x, hit.t),
                  THREE.MathUtils.lerp(this._vecA.y, proj.pos.y, hit.t),
                  THREE.MathUtils.lerp(this._vecA.z, proj.pos.z, hit.t),
                ),
              };
            }
          }
          if (hitChest) {
            if (proj.isExplosive && onExplosion) {
              onExplosion(hitChest.pos, proj.blastRadius, proj.damage);
            } else {
              this.spawnBurst(hitChest.pos, 0xc28e54, 6, 3.6);
              onChestShot?.(hitChest.id, hitChest.pos, proj.damage);
            }
            proj.active = false;
            proj.mesh.visible = false;
            continue;
          }
        }

        // Placed Auto-Turret impact check (friendly fire or enemy shot)
        if (building.turrets.length > 0) {
          let hitTurret: { id: string; t: number; pos: THREE.Vector3 } | null = null;
          for (const turret of building.turrets) {
            // Avoid turret shooting itself at muzzle origin
            if (!proj.isEnemy && Math.hypot(this._vecA.x - turret.x, this._vecA.z - turret.z) < 0.7 && Math.abs(this._vecA.y - (turret.y + 0.98)) < 0.45) {
              continue;
            }
            const hit = testSegmentCylinderHit(
              this._vecA.x,
              this._vecA.y,
              this._vecA.z,
              proj.pos.x,
              proj.pos.y,
              proj.pos.z,
              turret.x,
              turret.y,
              turret.z,
              0.48,
              1.25,
            );
            if (hit.hit && (!hitTurret || hit.t < hitTurret.t)) {
              hitTurret = {
                id: turret.id,
                t: hit.t,
                pos: new THREE.Vector3(
                  THREE.MathUtils.lerp(this._vecA.x, proj.pos.x, hit.t),
                  THREE.MathUtils.lerp(this._vecA.y, proj.pos.y, hit.t),
                  THREE.MathUtils.lerp(this._vecA.z, proj.pos.z, hit.t),
                ),
              };
            }
          }
          if (hitTurret) {
            if (proj.isExplosive && onExplosion) {
              onExplosion(hitTurret.pos, proj.blastRadius, proj.damage);
            } else {
              this.spawnBurst(hitTurret.pos, 0x9ca3af, 7, 3.8);
              onTurretShot?.(hitTurret.id, hitTurret.pos, proj.damage);
            }
            proj.active = false;
            proj.mesh.visible = false;
            continue;
          }
        }

        // Building structure impact check (bullets pass through open windows & open doors, blocked by walls/closed doors/floors)
        const blockCheck = building.isSegmentBlocked(
          this._vecA.x,
          this._vecA.y,
          this._vecA.z,
          proj.pos.x,
          proj.pos.y,
          proj.pos.z,
          false,
        );
        if (blockCheck.blocked) {
          if (proj.isExplosive && onExplosion) {
            onExplosion(proj.pos.clone(), proj.blastRadius, proj.damage);
          } else {
            this.spawnBurst(proj.pos, 0xc28e54, 6, 3.6);
            if (blockCheck.pieceId) {
              const bDmg = proj.isEnemy
                ? Math.round(proj.damage * 0.55)
                : Math.max(4, Math.round(proj.damage * 0.45));
              building.damagePiece(blockCheck.pieceId, bDmg);
              onStructureHit(blockCheck.pieceId, proj.pos.clone());
            }
          }
          proj.active = false;
          proj.mesh.visible = false;
          continue;
        }

        // World obstacle collision (rocks, trees, barrels, cave walls + procedural structure OBBs)
        const worldBoxHit = isSegmentBlockedByWorldBoxes(
          worldBoxes,
          this._vecA.x,
          this._vecA.y,
          this._vecA.z,
          proj.pos.x,
          proj.pos.y,
          proj.pos.z,
        );
        if (worldBoxHit.blocked) {
          const hitPos = new THREE.Vector3(
            THREE.MathUtils.lerp(this._vecA.x, proj.pos.x, worldBoxHit.t),
            THREE.MathUtils.lerp(this._vecA.y, proj.pos.y, worldBoxHit.t),
            THREE.MathUtils.lerp(this._vecA.z, proj.pos.z, worldBoxHit.t),
          );
          if (proj.isExplosive && onExplosion) {
            onExplosion(hitPos, proj.blastRadius, proj.damage);
          } else {
            this.spawnBurst(hitPos, 0x9ca3af, 5, 3.2);
          }
          proj.active = false;
          proj.mesh.visible = false;
          continue;
        }

        let hitWorldCollider: { nodeId?: string; t: number; pos: THREE.Vector3 } | null = null;
        for (const c of worldColliders) {
          if (c.nodeId && isNodeAlive && !isNodeAlive(c.nodeId)) continue;
          const baseGy = groundYAt(c.x, c.z);
          const colHit = testSegmentCylinderHit(
            this._vecA.x,
            this._vecA.y,
            this._vecA.z,
            proj.pos.x,
            proj.pos.y,
            proj.pos.z,
            c.x,
            baseGy - 0.35,
            c.z,
            c.radius + 0.14,
            (c.height ?? 4.5) + 0.35,
          );
          if (colHit.hit && (!hitWorldCollider || colHit.t < hitWorldCollider.t)) {
            hitWorldCollider = {
              nodeId: c.nodeId,
              t: colHit.t,
              pos: new THREE.Vector3(
                THREE.MathUtils.lerp(this._vecA.x, proj.pos.x, colHit.t),
                THREE.MathUtils.lerp(this._vecA.y, proj.pos.y, colHit.t),
                THREE.MathUtils.lerp(this._vecA.z, proj.pos.z, colHit.t),
              ),
            };
          }
        }
        if (hitWorldCollider) {
          if (proj.isExplosive && onExplosion) {
            onExplosion(hitWorldCollider.pos, proj.blastRadius, proj.damage);
          } else {
            const handled =
              hitWorldCollider.nodeId && !proj.isEnemy
                ? Boolean(onWorldNodeShot?.(hitWorldCollider.nodeId, hitWorldCollider.pos, proj.damage))
                : false;
            if (!handled) {
              this.spawnBurst(hitWorldCollider.pos, 0x9ca3af, 5, 3.2);
            }
          }
          proj.active = false;
          proj.mesh.visible = false;
          continue;
        }

        if (proj.pos.y <= groundYAt(proj.pos.x, proj.pos.z)) {
          if (proj.isExplosive && onExplosion) {
            onExplosion(proj.pos.clone(), proj.blastRadius, proj.damage);
          } else {
            this.spawnBurst(proj.pos, 0xc2b280, 5, 3.2);
          }
          proj.active = false;
          proj.mesh.visible = false;
          continue;
        }

        if (proj.isEnemy) {
          const hitYDiff = Math.abs(proj.pos.y - (playerPos.y - 0.55));
          if (
            Math.hypot(proj.pos.x - playerPos.x, proj.pos.z - playerPos.z) < 0.55 &&
            hitYDiff < 0.95
          ) {
            onPlayerHit(Math.max(1, Math.round(proj.damage * dmgScale)), 'Raider Gunshot');
            proj.active = false;
            proj.mesh.visible = false;
          }
        }
      }
    }

    // 3. Wildlife, Cave Guardians & Night Raider Spawning
    const wildlifeAlive = this.actors.filter((a) => !a.isRaider && a.state !== 'ko').length;
    const raidersAlive = this.actors.filter((a) => a.isRaider && a.state !== 'ko').length;

    if (simDt > 0) {
      this.spawnTimer -= simDt;
      if (this.spawnTimer <= 0 && wildlifeAlive < 11) {
        this.spawnTimer = 7.5;
        const angle = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 42;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;
        if (Math.hypot(sx, sz) < 128 && groundYAt(sx, sz) > 1.5) {
          const r = Math.random();
          const kind: EnemyKind = r < 0.35 ? 'boar' : r < 0.75 ? 'wolf' : 'bear';
          this.spawnActor(kind, sx, sz, groundYAt);
        }
      }

      if (isNight) {
        this.raiderSpawnTimer -= simDt;
        const maxRaiders = Math.max(1, Math.min(9, 2 + dayCount + maxRaidersBonus + (bloodMoon ? 2 : 0)));
        if (this.raiderSpawnTimer <= 0 && raidersAlive < maxRaiders) {
          this.raiderSpawnTimer = Math.max(4.5, 11 - dayCount * 1.2 - (bloodMoon ? 1.5 : 0));
          const angle = Math.random() * Math.PI * 2;
          const dist = 34 + Math.random() * 18;
          const sx = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -128, 128);
          const sz = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -128, 128);
          if (groundYAt(sx, sz) > 1.3) {
            const roll = Math.random();
            const hasBase = building.pieces.length > 0;
            const kind: EnemyKind =
              dayCount >= 2 && roll < 0.2
                ? 'raider_juggernaut'
                : hasBase && roll < 0.42
                  ? 'raider_sapper'
                  : roll < 0.72
                    ? 'raider_rusher'
                    : 'raider_rifleman';
            this.spawnActor(kind, sx, sz, groundYAt);
          }
        }
      }
    }

    // 4. Update Actors
    let activeAttackTokens = this.actors.filter((a) => a.state === 'windup').length;

    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];

      if (a.flashTimer > 0) a.flashTimer = Math.max(0, a.flashTimer - realDt);
      if (a.barricadeCooldown > 0) a.barricadeCooldown = Math.max(0, a.barricadeCooldown - simDt);

      if (a.state === 'ko') {
        a.koTimer -= realDt;
        const t = 1 - Math.max(0, a.koTimer) / 0.42;
        a.group.rotation.x = t * (Math.PI * 0.48);
        a.group.scale.y = 1 - t * 0.25;
        if (a.koTimer <= 0) {
          this.worldRoot.remove(a.group);
          const idx = this.actorHitMeshes.indexOf(a.hitMesh);
          if (idx !== -1) this.actorHitMeshes.splice(idx, 1);
          this.actors.splice(i, 1);
        }
        continue;
      }

      if (simDt <= 0) continue;

      a.x += a.vx * simDt;
      a.z += a.vz * simDt;
      a.vx *= Math.exp(-8 * simDt);
      a.vz *= Math.exp(-8 * simDt);

      const distToPlayer = Math.hypot(playerPos.x - a.x, playerPos.z - a.z);
      const verticalGap = Math.abs(playerFootY - a.y);
      const withinVertAggro = canActorAggroVertical(a.y, playerFootY, a.kind === 'raider_rifleman');

      const losToPlayer = building.isSegmentBlocked(
        a.x,
        a.y + 1.05,
        a.z,
        playerPos.x,
        playerPos.y - 0.35,
        playerPos.z,
        a.kind !== 'raider_rifleman',
      );

      let targetX = playerPos.x;
      let targetZ = playerPos.z;
      let targetingStructure = false;
      let targetingTurretId: string | null = null;
      let nearestPiece: { id: string; x: number; y: number; z: number; dist: number } | null = null;

      // Check if an Auto-Turret is nearby and reachable for raiders
      if (a.isRaider && building.turrets.length > 0 && a.kind !== 'raider_rifleman') {
        let bestTurretDist = 14;
        for (const t of building.turrets) {
          if (Math.abs(t.y - a.y) > 2.2) continue;
          const td = Math.hypot(t.x - a.x, t.z - a.z);
          if (td < bestTurretDist) {
            bestTurretDist = td;
            targetX = t.x;
            targetZ = t.z;
            targetingTurretId = t.id;
          }
        }
      }

      if (
        !targetingTurretId &&
        (a.kind === 'raider_sapper' ||
          a.kind === 'raider_juggernaut' ||
          (a.isRaider && losToPlayer.blocked)) &&
        building.pieces.length > 0
      ) {
        if (losToPlayer.blocked && losToPlayer.pieceId) {
          const blocking = building.pieces.find((p) => p.id === losToPlayer.pieceId);
          if (blocking && canActorReachStructure(a.y, blocking.y, blocking.type, 2.6)) {
            nearestPiece = {
              id: blocking.id,
              x: blocking.x,
              y: blocking.y,
              z: blocking.z,
              dist: Math.hypot(blocking.x - a.x, blocking.z - a.z),
            };
          }
        }
        if (!nearestPiece && (a.kind === 'raider_sapper' || a.kind === 'raider_juggernaut')) {
          let bestD = Infinity;
          for (const p of building.pieces) {
            if (!canActorReachStructure(a.y, p.y, p.type, 2.6)) continue;
            const d = Math.hypot(p.x - a.x, p.z - a.z);
            if (d < bestD) {
              bestD = d;
              nearestPiece = { id: p.id, x: p.x, y: p.y, z: p.z, dist: d };
            }
          }
        }
        if (nearestPiece && (nearestPiece.dist < 35 || distToPlayer > 6 || losToPlayer.blocked)) {
          targetX = nearestPiece.x;
          targetZ = nearestPiece.z;
          targetingStructure = true;
          a.targetPieceId = nearestPiece.id;
        } else {
          a.targetPieceId = null;
        }
      } else {
        a.targetPieceId = null;
      }

      const distToTarget = Math.hypot(targetX - a.x, targetZ - a.z);
      const dirX = distToTarget > 0.01 ? (targetX - a.x) / distToTarget : 0;
      const dirZ = distToTarget > 0.01 ? (targetZ - a.z) / distToTarget : 1;

      if (a.state === 'wander') {
        a.stateTimer -= simDt;
        if (a.stateTimer <= 0) {
          a.wanderAngle += (Math.random() - 0.5) * 2.2;
          a.stateTimer = 2.0 + Math.random() * 2.5;
        }
        const moveSpd = a.speed * 0.42;
        a.x += Math.cos(a.wanderAngle) * moveSpd * simDt;
        a.z += Math.sin(a.wanderAngle) * moveSpd * simDt;
        a.rotY = Math.atan2(Math.cos(a.wanderAngle), Math.sin(a.wanderAngle));

        if ((distToPlayer < a.aggroRange && withinVertAggro) || targetingStructure || targetingTurretId) {
          a.state = a.kind === 'raider_rifleman' ? 'strafe' : 'chase';
          a.stateTimer = 1.5;
        }
      } else if (a.state === 'chase') {
        a.rotY = Math.atan2(dirX, dirZ);

        let moveX = dirX;
        let moveZ = dirZ;
        if ((a.kind === 'wolf' || a.kind === 'sludge_crawler') && distToTarget > 3.5 && distToTarget < 10) {
          moveX += -dirZ * 0.45 * a.strafeDir;
          moveZ += dirX * 0.45 * a.strafeDir;
          const len = Math.hypot(moveX, moveZ) || 1;
          moveX /= len;
          moveZ /= len;
        }

        const canStrikePlayer = !targetingStructure && !targetingTurretId && !losToPlayer.blocked && verticalGap <= 2.0;
        const canStrikeStructure = targetingStructure || Boolean(targetingTurretId);

        if (distToTarget > a.attackRange * 0.85 || (!canStrikePlayer && !canStrikeStructure)) {
          if (distToTarget > 0.9) {
            a.x += moveX * a.speed * simDt;
            a.z += moveZ * a.speed * simDt;
          }
        } else if (activeAttackTokens < MAX_SIMULTANEOUS_ATTACK_TOKENS) {
          a.state = 'windup';
          a.stateTimer = a.windupDuration;
          a.telegraphRing.visible = true;
          activeAttackTokens++;
        }

        if (
          (!a.isRaider && (distToPlayer > a.aggroRange * 1.45 || !withinVertAggro)) ||
          (a.isRaider && !targetingStructure && !targetingTurretId && !withinVertAggro && distToPlayer > 10)
        ) {
          a.state = 'wander';
          a.stateTimer = 2.0;
        }
      } else if (a.state === 'strafe') {
        a.rotY = Math.atan2(dirX, dirZ);
        a.stateTimer -= simDt;
        let radial = 0;
        if (distToPlayer > 17) radial = 1;
        else if (distToPlayer < 10) radial = -1;

        const strafeX = -dirZ * a.strafeDir * 0.8 + dirX * radial;
        const strafeZ = dirX * a.strafeDir * 0.8 + dirZ * radial;
        const len = Math.hypot(strafeX, strafeZ) || 1;
        a.x += (strafeX / len) * a.speed * simDt;
        a.z += (strafeZ / len) * a.speed * simDt;

        if (!withinVertAggro && distToPlayer > 12) {
          a.state = 'wander';
          a.stateTimer = 2.0;
        } else if (
          a.stateTimer <= 0 &&
          distToPlayer <= a.attackRange &&
          withinVertAggro &&
          !losToPlayer.blocked &&
          activeAttackTokens < MAX_SIMULTANEOUS_ATTACK_TOKENS
        ) {
          a.state = 'windup';
          a.stateTimer = a.windupDuration;
          a.telegraphRing.visible = true;
          activeAttackTokens++;
        }
      } else if (a.state === 'windup') {
        a.rotY = Math.atan2(dirX, dirZ);
        a.stateTimer -= simDt;
        const pulse = 1 + Math.sin(elapsed * 22) * 0.14;
        a.telegraphRing.scale.setScalar(pulse);
        a.group.scale.y = a.kind === 'bear' || a.kind === 'raider_juggernaut' ? 1.15 : 0.88;

        if (a.stateTimer <= 0) {
          a.telegraphRing.visible = false;
          a.group.scale.y = 1;

          const strikeLosBlocked = building.isSegmentBlocked(
            a.x,
            a.y + 1.05,
            a.z,
            playerPos.x,
            playerPos.y - 0.35,
            playerPos.z,
            a.kind !== 'raider_rifleman',
          );

          if (a.kind === 'raider_rifleman') {
            if (!strikeLosBlocked.blocked && withinVertAggro) {
              this._vecA.set(a.x, a.y + 1.35, a.z);
              this._vecB.set(
                playerPos.x - a.x + (Math.random() - 0.5) * 0.9,
                playerPos.y - 0.2 - (a.y + 1.35),
                playerPos.z - a.z + (Math.random() - 0.5) * 0.9,
              );
              this.spawnProjectile({
                origin: this._vecA,
                direction: this._vecB,
                speed: 36,
                gravity: 0.4,
                damage: a.attackDamage,
                isEnemy: true,
                color: 0xf97316,
                scaleZ: 1.5,
              });
              this.spawnBurst(this._vecA, 0xfb923c, 5, 3.0);
            }
          } else if (targetingTurretId) {
            const turret = building.getTurretById(targetingTurretId);
            if (
              turret &&
              Math.hypot(turret.x - a.x, turret.z - a.z) <= a.attackRange + 1.4 &&
              Math.abs(turret.y - a.y) <= 2.4
            ) {
              const res = building.damageTurret(turret.id, Math.round(a.attackDamage * dmgScale));
              this.spawnBurst(new THREE.Vector3(turret.x, turret.y + 0.8, turret.z), 0x9ca3af, 8, 4.0);
              if (res.destroyed) {
                this.spawnBurst(new THREE.Vector3(turret.x, turret.y + 0.9, turret.z), 0xf97316, 14, 5.5);
              }
            }
          } else if (targetingStructure && a.targetPieceId) {
            const piece = building.pieces.find((p) => p.id === a.targetPieceId);
            if (
              piece &&
              Math.hypot(piece.x - a.x, piece.z - a.z) <= a.attackRange + 1.8 &&
              canActorReachStructure(a.y, piece.y, piece.type, 2.6)
            ) {
              building.damagePiece(piece.id, Math.round(a.attackDamage * dmgScale));
              onStructureHit(piece.id, new THREE.Vector3(piece.x, piece.y + 1.0, piece.z));
            }
          } else if (
            distToPlayer <= a.attackRange + 0.9 &&
            Math.abs(playerFootY - a.y) <= 2.0 &&
            !strikeLosBlocked.blocked
          ) {
            const label =
              a.kind === 'wolf'
                ? 'Wolf Bite'
                : a.kind === 'bear'
                  ? 'Bear Maul'
                  : a.kind === 'boar'
                    ? 'Wild Boar Tusks'
                    : a.kind === 'sludge_crawler'
                      ? 'Sludge Crawler Claw'
                      : a.kind === 'raider_juggernaut'
                        ? 'Juggernaut Slam'
                        : 'Raider Attack';
            onPlayerHit(Math.max(1, Math.round(a.attackDamage * dmgScale)), label);
          }

          a.state = 'recover';
          a.stateTimer = a.kind === 'raider_rifleman' ? 1.35 : 0.75;
        }
      } else if (a.state === 'recover') {
        a.stateTimer -= simDt;
        if (a.stateTimer <= 0) {
          a.state = a.kind === 'raider_rifleman' ? 'strafe' : 'chase';
          a.stateTimer = 1.2 + Math.random() * 0.9;
        }
      }

      // Check Spike Barricades contact damage
      for (const b of building.barricades) {
        const bd = Math.hypot(a.x - b.x, a.z - b.z);
        if (bd < a.radius + 0.95 && Math.abs(a.y - b.y) < 1.35) {
          const pushX = bd > 0.01 ? (a.x - b.x) / bd : 0;
          const pushZ = bd > 0.01 ? (a.z - b.z) / bd : 1;
          a.x = b.x + pushX * (a.radius + 0.98);
          a.z = b.z + pushZ * (a.radius + 0.98);
          if (a.barricadeCooldown <= 0) {
            a.barricadeCooldown = 0.7;
            building.damageBarricade(b.id, 14);
            this.damageActor(a.id, 22, new THREE.Vector3(pushX, 0, pushZ));
          }
        }
      }

      const clampedDist = Math.hypot(a.x, a.z);
      if (clampedDist > 138) {
        a.x *= 138 / clampedDist;
        a.z *= 138 / clampedDist;
        a.wanderAngle += Math.PI * 0.75;
      }

      // Push ALL actors out of trees, ores, cave walls, and landmarks
      for (const c of worldColliders) {
        if (c.nodeId && isNodeAlive && !isNodeAlive(c.nodeId)) continue;
        const dx = a.x - c.x;
        const dz = a.z - c.z;
        const minD = c.radius + a.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = minD - d;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
        }
      }

      // Push ALL enemies (including sappers & juggernauts) cleanly out of world structures, walls, closed doors & raised foundations
      this._vecA.set(a.x, a.y + 1.65, a.z);
      resolveWorldBoxCollisions(this._vecA, worldBoxes, a.radius, 1.65);
      building.resolveHorizontalCollision(this._vecA, a.radius, 1.65, 0.34);
      a.x = this._vecA.x;
      a.z = this._vecA.z;

      a.y = groundYAt(a.x, a.z);
      a.group.position.set(a.x, a.y, a.z);
      a.group.rotation.y = a.rotY;

      const stride = Math.sin(elapsed * (a.state === 'chase' ? 12 : 6)) * 0.38;
      for (let l = 0; l < a.limbs.length; l++) {
        a.limbs[l].rotation.x = l % 2 === 0 ? stride : -stride;
      }
    }

    // 5. Update Placed Auto-Turrets / Defender Bots (target & shoot raiders)
    if (simDt > 0 && building.turrets.length > 0) {
      for (let ti = 0; ti < building.turrets.length; ti++) {
        const turret = building.turrets[ti];
        if (turret.cooldown > 0) turret.cooldown = Math.max(0, turret.cooldown - simDt);

        const muzzleY = turret.y + 0.98;
        let bestTarget: ActorEntity | null = null;
        let bestDist = 25;

        for (const a of this.actors) {
          if (a.state === 'ko' || !a.isRaider) continue;
          const d = Math.hypot(a.x - turret.x, a.z - turret.z);
          if (d > bestDist || Math.abs(a.y - turret.y) > 8.5) continue;
          const los = building.isSegmentBlocked(
            turret.x,
            muzzleY,
            turret.z,
            a.x,
            a.y + 1.15,
            a.z,
            false,
          );
          if (!los.blocked) {
            bestDist = d;
            bestTarget = a;
          }
        }

        const scanMat = turret.scannerMesh.material as THREE.MeshBasicMaterial;
        if (bestTarget) {
          scanMat.color.setHex(0xef4444);
          const aimYaw = Math.atan2(bestTarget.x - turret.x, bestTarget.z - turret.z);
          let diff = aimYaw - turret.yawHead;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          turret.yawHead += diff * Math.min(1, simDt * 11);
          turret.headPivot.rotation.y = turret.yawHead;

          if (Math.abs(diff) < 0.35 && turret.cooldown <= 0) {
            turret.cooldown = 0.48;
            const fx = Math.sin(turret.yawHead);
            const fz = Math.cos(turret.yawHead);
            this._vecA.set(turret.x + fx * 0.65, muzzleY, turret.z + fz * 0.65);
            this._vecB.set(
              bestTarget.x - this._vecA.x,
              bestTarget.y + 1.15 - this._vecA.y,
              bestTarget.z - this._vecA.z,
            );
            this.spawnProjectile({
              origin: this._vecA,
              direction: this._vecB,
              speed: 58,
              gravity: 0.12,
              damage: 24,
              isEnemy: false,
              color: 0x38bdf8,
              scaleZ: 1.5,
              headshotMult: 1.5,
            });
            this.spawnBurst(this._vecA, 0x38bdf8, 4, 2.8);
          }
        } else {
          scanMat.color.setHex(0x4ade80);
          turret.yawHead = turret.rotY + Math.sin(elapsed * 1.4 + ti * 1.7) * 0.85;
          turret.headPivot.rotation.y = turret.yawHead;
        }
      }
    }

    return { wildlifeCount: wildlifeAlive, raiderCount: raidersAlive };
  }

  public clearActors(): void {
    for (const a of this.actors) {
      this.worldRoot.remove(a.group);
    }
    this.actors.length = 0;
    this.actorHitMeshes.length = 0;
  }

  private createActorMesh(kind: EnemyKind): {
    group: THREE.Group;
    hitMesh: THREE.Mesh;
    telegraphRing: THREE.Mesh;
    limbs: THREE.Object3D[];
  } {
    const group = new THREE.Group();
    const limbs: THREE.Object3D[] = [];

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(kind === 'bear' || kind === 'raider_juggernaut' ? 1.15 : 0.72, 16),
      this.shadowMat,
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    group.add(shadow);

    const telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.85, 24),
      new THREE.MeshBasicMaterial({
        color: kind === 'sludge_crawler' ? 0x4ade80 : 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    telegraphRing.rotation.x = -Math.PI / 2;
    telegraphRing.position.y = 0.06;
    telegraphRing.visible = false;
    group.add(telegraphRing);

    if (kind === 'wolf' || kind === 'bear' || kind === 'boar') {
      const isBear = kind === 'bear';
      const isBoar = kind === 'boar';
      const furMat = new THREE.MeshStandardMaterial({
        color: isBear ? 0x4b3322 : isBoar ? 0x573b2c : 0x5c626b,
        roughness: 0.9,
      });
      const bellyMat = new THREE.MeshStandardMaterial({
        color: isBear ? 0x6b4b33 : isBoar ? 0x7c5b46 : 0x8d959e,
        roughness: 0.88,
      });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

      const scale = isBear ? 1.45 : isBoar ? 0.88 : 0.95;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 1.0), furMat);
      torso.position.set(0, 0.58, 0);
      torso.castShadow = true;

      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.5), bellyMat);
      chest.position.set(0, 0.55, 0.24);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.44), furMat);
      head.position.set(0, 0.72, 0.66);
      head.castShadow = true;

      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.26), bellyMat);
      snout.position.set(0, 0.66, 0.92);

      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), eyeMat);
      eyeL.position.set(-0.12, 0.78, 0.88);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.12;

      if (isBoar) {
        const tuskMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.4 });
        const tuskL = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), tuskMat);
        tuskL.position.set(-0.11, 0.62, 1.02);
        tuskL.rotation.x = 0.8;
        const tuskR = tuskL.clone();
        tuskR.position.x = 0.11;
        group.add(tuskL, tuskR);
      }

      const legGeo = new THREE.BoxGeometry(0.15, 0.46, 0.15);
      for (const [lx, ly, lz] of [
        [-0.2, 0.23, 0.35],
        [0.2, 0.23, 0.35],
        [-0.2, 0.23, -0.35],
        [0.2, 0.23, -0.35],
      ]) {
        const leg = new THREE.Mesh(legGeo, furMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        group.add(leg);
        limbs.push(leg);
      }

      group.add(torso, chest, head, snout, eyeL, eyeR);
      group.scale.setScalar(scale);

      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.95 * scale, 1.15 * scale, 1.45 * scale),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitMesh.position.y = 0.65 * scale;
      group.add(hitMesh);

      return { group, hitMesh, telegraphRing, limbs };
    }

    if (kind === 'sludge_crawler') {
      const skinMat = new THREE.MeshStandardMaterial({
        map: this.textures.sludgeColor,
        color: 0x3b8c52,
        emissive: 0x166534,
        emissiveIntensity: 0.5,
        roughness: 0.42,
      });
      const crystalMat = new THREE.MeshBasicMaterial({ color: 0x86efac });

      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), skinMat);
      torso.position.set(0, 0.95, 0);
      torso.scale.set(1.1, 1.35, 0.9);
      torso.castShadow = true;

      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), skinMat);
      head.position.set(0, 1.55, 0.15);

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), crystalMat);
      eyeL.position.set(-0.1, 1.6, 0.35);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.1;

      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), crystalMat);
      spine.position.set(0, 1.32, -0.25);
      spine.rotation.x = -0.6;

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.16), skinMat);
      armL.position.set(-0.46, 0.88, 0.2);
      armL.rotation.x = -0.45;
      const armR = armL.clone();
      armR.position.x = 0.46;

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), skinMat);
      legL.position.set(-0.2, 0.32, 0);
      const legR = legL.clone();
      legR.position.x = 0.2;

      group.add(torso, head, eyeL, eyeR, spine, armL, armR, legL, legR);
      limbs.push(legL, legR, armL, armR);

      const hitMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.85, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitMesh.position.y = 0.92;
      group.add(hitMesh);

      return { group, hitMesh, telegraphRing, limbs };
    }

    // Raider Humanoids
    const isJugg = kind === 'raider_juggernaut';
    const coatColor =
      kind === 'raider_rifleman'
        ? 0x3b4836
        : kind === 'raider_sapper'
          ? 0x5c3428
          : isJugg
            ? 0x1e2229
            : 0x3a3d42;
    const accentColor =
      kind === 'raider_rifleman'
        ? 0xf59e0b
        : kind === 'raider_sapper'
          ? 0xef4444
          : isJugg
            ? 0x4ade80
            : 0x9ca3af;

    const coatMat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.82 });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.38,
      metalness: 0.72,
    });
    const visorMat = new THREE.MeshBasicMaterial({ color: accentColor });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.34), coatMat);
    torso.position.y = 1.12;
    torso.castShadow = true;

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.4), armorMat);
    vest.position.y = 1.22;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), armorMat);
    head.position.y = 1.7;
    head.castShadow = true;

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), visorMat);
    visor.position.set(0, 1.72, 0.16);

    const legGeo = new THREE.BoxGeometry(0.2, 0.74, 0.22);
    const legL = new THREE.Mesh(legGeo, coatMat);
    legL.position.set(-0.15, 0.37, 0);
    const legR = new THREE.Mesh(legGeo, coatMat);
    legR.position.set(0.15, 0.37, 0);

    const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.18);
    const armL = new THREE.Mesh(armGeo, coatMat);
    armL.position.set(-0.38, 1.12, 0);
    const armR = new THREE.Mesh(armGeo, coatMat);
    armR.position.set(0.38, 1.16, 0.15);
    armR.rotation.x = -0.6;

    const weapon = new THREE.Mesh(
      kind === 'raider_rifleman'
        ? new THREE.BoxGeometry(0.08, 0.1, 0.78)
        : new THREE.BoxGeometry(0.12, 0.16, 0.56),
      armorMat,
    );
    weapon.position.set(0, -0.22, 0.26);
    armR.add(weapon);

    group.add(torso, vest, head, visor, legL, legR, armL, armR);
    limbs.push(legL, legR, armL);
    if (isJugg) group.scale.setScalar(1.26);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(isJugg ? 0.64 : 0.45, isJugg ? 0.64 : 0.45, isJugg ? 2.65 : 1.95, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = isJugg ? 1.32 : 0.97;
    group.add(hitMesh);

    return { group, hitMesh, telegraphRing, limbs };
  }

  private buildViewModels(): void {
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodColor,
      roughness: 0.78,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.rockColor,
      roughness: 0.9,
      flatShading: true,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x525862,
      roughness: 0.3,
      metalness: 0.85,
    });
    const rustMat = new THREE.MeshStandardMaterial({
      color: 0x8f4329,
      roughness: 0.65,
      metalness: 0.45,
    });
    const blueprintMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.6,
    });
    const sludgeGlowMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a47e,
      roughness: 0.8,
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x2f3b2e,
      roughness: 0.85,
    });

    // 1. Bare Hand (Empty hotbar slot)
    {
      const g = new THREE.Group();
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.28), sleeveMat);
      forearm.position.set(0.02, -0.04, 0.14);
      forearm.rotation.x = 0.18;
      const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.1), skinMat);
      wrist.position.set(0.01, -0.01, -0.02);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.088, 0.095), skinMat);
      fist.position.set(0, 0.01, -0.1);
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.045, 0.06), skinMat);
      thumb.position.set(-0.048, 0.025, -0.085);
      g.add(forearm, wrist, fist, thumb);
      this.registerViewModel('hand', g);
    }

    // 2. Torch & Multi-Tier Flashlights
    {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.46, 8), woodMat);
      stick.rotation.x = -0.35;
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.14, 8), rustMat);
      wrap.position.set(0, 0.17, -0.07);
      wrap.rotation.x = -0.35;
      const ember = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.12, 7),
        new THREE.MeshBasicMaterial({ color: 0xff8c24 }),
      );
      ember.position.set(0, 0.28, -0.11);
      ember.rotation.x = -0.2;
      g.add(stick, wrap, ember);
      this.registerViewModel('torch', g);
    }
    for (const fid of ['flashlight_basic', 'flashlight_tactical', 'flashlight_sludge'] as const) {
      const g = new THREE.Group();
      const bodyColor =
        fid === 'flashlight_basic' ? rustMat : steelMat;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.032, 0.28, 10), bodyColor);
      tube.rotation.x = Math.PI / 2 - 0.12;
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.07, 10), steelMat);
      bezel.rotation.x = Math.PI / 2 - 0.12;
      bezel.position.set(0, 0.02, -0.15);
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 10),
        new THREE.MeshBasicMaterial({
          color: fid === 'flashlight_sludge' ? 0x4ade80 : fid === 'flashlight_tactical' ? 0xe0f2fe : 0xfef3c7,
        }),
      );
      lens.position.set(0, 0.024, -0.186);
      lens.rotation.y = Math.PI;
      g.add(tube, bezel, lens);
      this.registerViewModel(fid, g);
    }

    // 3. Hatchet & Salvaged Axe
    for (const id of ['hatchet', 'salvaged_axe'] as const) {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.5, 8), woodMat);
      handle.rotation.x = -0.25;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.14, 0.2),
        id === 'salvaged_axe' ? steelMat : stoneMat,
      );
      head.position.set(0, 0.2, -0.1);
      const lashing = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 6, 12), rustMat);
      lashing.position.set(0, 0.19, -0.04);
      g.add(handle, head, lashing);
      this.registerViewModel(id, g);
    }

    // 4. Wooden Pickaxe, Stone Pickaxe & Salvaged Pick
    for (const id of ['wood_pickaxe', 'pickaxe', 'salvaged_pick'] as const) {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.54, 8), woodMat);
      handle.rotation.x = -0.25;
      const headMat =
        id === 'wood_pickaxe' ? woodMat : id === 'salvaged_pick' ? steelMat : stoneMat;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.36), headMat);
      bar.position.set(0, 0.23, -0.06);
      bar.rotation.x = -0.15;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.11, 6), headMat);
      tip.rotation.x = -Math.PI / 2;
      tip.position.set(0, 0.2, -0.25);
      g.add(handle, bar, tip);
      this.registerViewModel(id, g);
    }

    // 5. Building Plan
    {
      const g = new THREE.Group();
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.22), blueprintMat);
      sheet.rotation.set(0.35, -0.2, 0.1);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 10), blueprintMat);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, -0.03, 0.08);
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6), woodMat);
      pencil.rotation.z = 0.8;
      pencil.position.set(0.11, 0.04, -0.02);
      g.add(sheet, roll, pencil);
      this.registerViewModel('building_plan', g);
    }

    // 6. Upgrade Hammer
    {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.44, 8), woodMat);
      handle.rotation.x = -0.2;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.19, 10), steelMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 0.19, -0.04);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.08), rustMat);
      collar.position.set(0, 0.19, -0.04);
      g.add(handle, head, collar);
      this.registerViewModel('hammer', g);
    }

    // 7. Hunting Bow & Compound Crossbow
    {
      const g = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.34, 0.06),
        new THREE.Vector3(0, -0.14, -0.08),
        new THREE.Vector3(0, 0.14, -0.08),
        new THREE.Vector3(0, 0.34, 0.06),
      ]);
      const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.018, 6, false), woodMat);
      const str = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.66, 4),
        new THREE.MeshBasicMaterial({ color: 0xe5dfd3 }),
      );
      str.position.set(0, 0, 0.06);
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 6), woodMat);
      arrow.rotation.x = Math.PI / 2;
      arrow.position.set(0.02, 0.01, -0.12);
      g.add(limb, str, arrow);
      this.registerViewModel('bow', g);
    }
    {
      const g = new THREE.Group();
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.56), woodMat);
      rail.position.set(0, 0, -0.06);
      const prod = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.05), steelMat);
      prod.position.set(0, 0.04, -0.3);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6), steelMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(0, 0.06, -0.14);
      g.add(rail, prod, bolt);
      this.registerViewModel('crossbow', g);
    }

    // 8. Waterpipe Shotgun, Scrap Revolver, Scrap SMG
    {
      const g = new THREE.Group();
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.36), woodMat);
      stock.position.set(0, -0.04, 0.08);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.56, 10), rustMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.18);
      const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 10), steelMat);
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(0, 0.04, -0.25);
      g.add(stock, barrel, clamp);
      this.registerViewModel('pipe_shotgun', g);
    }
    {
      const g = new THREE.Group();
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), woodMat);
      grip.rotation.x = 0.28;
      grip.position.set(0, -0.07, 0.08);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.075, 0.18), steelMat);
      frame.position.set(0, 0.02, -0.02);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.07, 8), rustMat);
      cyl.rotation.x = Math.PI / 2;
      cyl.position.set(0, 0.02, -0.01);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.24, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.035, -0.2);
      g.add(grip, frame, cyl, barrel);
      this.registerViewModel('revolver', g);
    }
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.34), steelMat);
      body.position.set(0, 0.02, -0.06);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.18, 0.06), rustMat);
      mag.position.set(0, -0.11, -0.1);
      mag.rotation.x = 0.18;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.24, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.035, -0.32);
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), sludgeGlowMat);
      cell.rotation.x = Math.PI / 2;
      cell.position.set(0.04, 0.03, -0.08);
      g.add(body, mag, barrel, cell);
      this.registerViewModel('smg', g);
    }
    // 8b. Bolt Sniper Rifle with Optical Scope
    {
      const g = new THREE.Group();
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, 0.44), woodMat);
      stock.position.set(0, -0.02, 0.04);
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.075, 0.24), steelMat);
      receiver.position.set(0, 0.035, -0.08);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.56, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.045, -0.44);
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.28, 10), steelMat);
      scopeBody.rotation.x = Math.PI / 2;
      scopeBody.position.set(0, 0.105, -0.09);
      const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.08, 10), rustMat);
      scopeBell.rotation.x = Math.PI / 2;
      scopeBell.position.set(0, 0.105, -0.24);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), sludgeGlowMat);
      lens.position.set(0, 0.105, 0.052);
      g.add(stock, receiver, barrel, scopeBody, scopeBell, lens);
      this.registerViewModel('sniper_rifle', g);
    }

    // 9. Sludge Charge Grenade
    {
      const g = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.17, 10), steelMat);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), sludgeGlowMat);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), rustMat);
      cap.position.y = 0.1;
      g.add(can, core, cap);
      this.registerViewModel('grenade', g);
    }

    // 10. Syringe, Medkit, Berries, Door, Campfire, Lantern, Barricade
    {
      const g = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8), sludgeGlowMat);
      tube.rotation.x = -0.35;
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), steelMat);
      needle.position.set(0, 0.14, -0.05);
      needle.rotation.x = -0.35;
      g.add(tube, needle);
      this.registerViewModel('sludge_stim', g);
    }
    this.registerViewModel('door_item', this.makeHeldBox(0x9a6f44, 0.18, 0.24, 0.04));
    this.registerViewModel('campfire_item', this.makeHeldBox(0x78716c, 0.18, 0.12, 0.18));
    this.registerViewModel('lantern_item', this.makeHeldBox(0x4ade80, 0.14, 0.2, 0.14));
    this.registerViewModel('floodlight_item', this.makeHeldBox(0xbef264, 0.22, 0.24, 0.14));
    this.registerViewModel('barricade_item', this.makeHeldBox(0x8b5a2b, 0.22, 0.14, 0.12));
    this.registerViewModel('bed_item', this.makeHeldBox(0x166534, 0.22, 0.1, 0.28));
    {
      const g = new THREE.Group();
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.48, metalness: 0.5 }),
      );
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.115, 0.07, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }),
      );
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 12), steelMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.14;
      g.add(drum, band, rim);
      this.registerViewModel('barrel_item', g);
    }
    this.registerViewModel('cooked_meat', this.makeHeldBox(0xa14228, 0.16, 0.08, 0.12));
    this.registerViewModel('berries', this.makeHeldBox(0xdc2626, 0.12, 0.1, 0.12));
    this.registerViewModel('medkit', this.makeHeldBox(0xe5e7eb, 0.2, 0.12, 0.16));
    this.registerViewModel('chest_item', this.makeHeldBox(0x8a5b32, 0.22, 0.14, 0.16));
    this.registerViewModel('turret_item', this.makeHeldBox(0x3b4836, 0.2, 0.18, 0.22));
    this.registerViewModel('raw_fish', this.makeHeldBox(0x7aa4b8, 0.18, 0.06, 0.1));
    this.registerViewModel('cooked_fish', this.makeHeldBox(0xd97706, 0.18, 0.06, 0.1));
    {
      const g = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.85, 8), woodMat);
      rod.rotation.x = -0.68;
      rod.position.set(0, 0.12, -0.28);
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 10), steelMat);
      reel.rotation.z = Math.PI / 2;
      reel.position.set(0.02, -0.04, -0.06);
      const lineTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      );
      lineTip.position.set(0, 0.44, -0.58);
      g.add(rod, reel, lineTip);
      this.registerViewModel('fishing_rod', g);
    }
  }

  private makeHeldBox(color: number, w: number, h: number, d: number): THREE.Group {
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78 }),
    );
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.05, h * 0.25, d * 1.05),
      new THREE.MeshStandardMaterial({ color: 0x423326, roughness: 0.85 }),
    );
    rim.position.y = -h * 0.35;
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.3, h * 0.2, d * 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 }),
    );
    tag.position.y = h * 0.55;
    g.add(m, rim, tag);
    return g;
  }

  private registerViewModel(id: EquippedVisualId, grp: THREE.Group): void {
    grp.visible = id === this.currentEquipped;
    this.viewModels.set(id, grp);
    this.viewmodelRoot.add(grp);
  }
}
