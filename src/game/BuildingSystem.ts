import * as THREE from 'three';
import {
  FOUNDATION_HEIGHT,
  FLOOR_THICKNESS,
  GRID_SIZE,
  TIER_MAX_HP,
  WALL_HEIGHT,
  getBuildPieceDef,
} from './gameData';
import {
  PLACED_BARREL_MAX_HP,
  applyPieceUpgrade,
  canUpgradePiece,
  computeBuildPlacement,
  createInitialChestSlots,
  findFloorPlacementTarget,
  isSegmentBlockedByPieces,
  resolveCircleVsOBB2D,
} from './rules';
import type { ProceduralTextureSet } from './Textures';
import type {
  BuildPieceType,
  BuildTier,
  InventorySlot,
  PlacedBuildPiece,
  PlacedPropData,
  ResourceBag,
} from '../types/game';

export interface CampfireInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  group: THREE.Group;
  light: THREE.PointLight;
  flameA: THREE.Mesh;
  flameB: THREE.Mesh;
}

export interface LanternInstance {
  id: string;
  kind: 'lantern' | 'floodlight';
  x: number;
  y: number;
  z: number;
  rotY: number;
  baseIntensity: number;
  group: THREE.Group;
  light: THREE.PointLight;
  coreMesh: THREE.Mesh;
  hitMesh: THREE.Mesh;
}

export interface BarricadeInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  group: THREE.Group;
}

export interface BedInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
}

export interface ExplosiveBarrelInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  maxHp: number;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
}

export interface ChestInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  maxHp: number;
  slots: InventorySlot[];
  group: THREE.Group;
  hitMesh: THREE.Mesh;
}

export interface TurretInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  yawHead: number;
  group: THREE.Group;
  headPivot: THREE.Group;
  hitMesh: THREE.Mesh;
  scannerMesh: THREE.Mesh;
}

interface PieceVisual {
  data: PlacedBuildPiece;
  group: THREE.Group;
  hitMeshes: THREE.Mesh[];
  doorPivot?: THREE.Group;
  doorAngle: number;
}

export class BuildingSystem {
  public readonly root = new THREE.Group();
  public readonly pieces: PlacedBuildPiece[] = [];
  public readonly campfires: CampfireInstance[] = [];
  public readonly lanterns: LanternInstance[] = [];
  public readonly lanternHitMeshes: THREE.Mesh[] = [];
  public readonly barricades: BarricadeInstance[] = [];
  public readonly beds: BedInstance[] = [];
  public readonly bedHitMeshes: THREE.Mesh[] = [];
  public readonly barrels: ExplosiveBarrelInstance[] = [];
  public readonly barrelHitMeshes: THREE.Mesh[] = [];
  public readonly chests: ChestInstance[] = [];
  public readonly chestHitMeshes: THREE.Mesh[] = [];
  public readonly turrets: TurretInstance[] = [];
  public readonly turretHitMeshes: THREE.Mesh[] = [];
  public readonly hitMeshes: THREE.Object3D[] = [];

  private visuals = new Map<string, PieceVisual>();
  private tierMaterials: Record<BuildTier, THREE.MeshStandardMaterial>;
  private doorMaterial: THREE.MeshStandardMaterial;
  private doorHardwareMat: THREE.MeshStandardMaterial;
  private ghostValidMat: THREE.MeshBasicMaterial;
  private ghostInvalidMat: THREE.MeshBasicMaterial;
  private ghostGroup: THREE.Group | null = null;
  private ghostType: BuildPieceType | null = null;
  private idSeq = 1;
  private propSeq = 1;

  public currentPlacementValid = false;
  public currentPlacementReason = 'Ready';
  private lastPlacement = { x: 0, y: 0, z: 0, rotY: 0 };

  private readonly _worldNormal = new THREE.Vector3();

  constructor(private textures: ProceduralTextureSet) {
    this.root.name = 'BuildingRoot';

    this.tierMaterials = {
      twig: new THREE.MeshStandardMaterial({
        map: textures.twigColor,
        bumpMap: textures.twigBump,
        bumpScale: 0.08,
        roughness: 0.92,
        metalness: 0.02,
      }),
      wood: new THREE.MeshStandardMaterial({
        map: textures.woodColor,
        bumpMap: textures.woodBump,
        bumpScale: 0.07,
        roughness: 0.78,
        metalness: 0.04,
      }),
      stone: new THREE.MeshStandardMaterial({
        map: textures.stoneColor,
        bumpMap: textures.stoneBump,
        bumpScale: 0.1,
        roughness: 0.88,
        metalness: 0.05,
      }),
    };

    this.doorMaterial = new THREE.MeshStandardMaterial({
      map: textures.woodColor,
      bumpMap: textures.woodBump,
      bumpScale: 0.06,
      color: 0xd8c3a5,
      roughness: 0.72,
      metalness: 0.05,
    });

    this.doorHardwareMat = new THREE.MeshStandardMaterial({
      color: 0x3b3f46,
      roughness: 0.35,
      metalness: 0.82,
    });

    this.ghostValidMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    this.ghostInvalidMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  }

  public isSegmentBlocked(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    blockWindowOpenings = true,
  ): { blocked: boolean; pieceId?: string } {
    return isSegmentBlockedByPieces(
      this.pieces,
      x1,
      y1,
      z1,
      x2,
      y2,
      z2,
      blockWindowOpenings,
    );
  }

  public updateGhost(params: {
    active: boolean;
    pieceType: BuildPieceType;
    camera: THREE.Camera;
    groundYAt: (x: number, z: number) => number;
    terrainMesh: THREE.Mesh;
    playerYaw: number;
    rotSteps: number;
    woodCount: number;
    freeBuild?: boolean;
    raycaster: THREE.Raycaster;
  }): void {
    const {
      active,
      pieceType,
      camera,
      groundYAt,
      terrainMesh,
      playerYaw,
      rotSteps,
      woodCount,
      freeBuild = false,
      raycaster,
    } = params;

    if (!active) {
      if (this.ghostGroup) this.ghostGroup.visible = false;
      return;
    }

    if (this.ghostType !== pieceType || !this.ghostGroup) {
      if (this.ghostGroup) {
        this.root.remove(this.ghostGroup);
      }
      this.ghostGroup = this.buildPieceMesh(pieceType, this.ghostValidMat, false);
      this.ghostType = pieceType;
      this.root.add(this.ghostGroup);
    }

    this.ghostGroup.visible = true;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = 12.0;
    const targets: THREE.Object3D[] = [terrainMesh, ...this.hitMeshes];
    const hits = raycaster.intersectObjects(targets, false);

    let aimX: number;
    let aimY: number | undefined;
    let aimZ: number;
    let hitNormalX = 0;
    let hitNormalY = 1;
    let hitNormalZ = 0;
    let hitPiece: PlacedBuildPiece | null = null;
    let hitDistance = Infinity;

    if (hits.length > 0) {
      const hit = hits[0];
      hitDistance = hit.distance;
      aimX = hit.point.x;
      aimY = hit.point.y;
      aimZ = hit.point.z;
      if (hit.face) {
        this._worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        hitNormalX = this._worldNormal.x;
        hitNormalY = this._worldNormal.y;
        hitNormalZ = this._worldNormal.z;
      }
      const pid = hit.object.userData.pieceId as string | undefined;
      if (pid) {
        hitPiece = this.pieces.find((p) => p.id === pid) ?? null;
      }
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      aimX = camera.position.x + forward.x * 5.0;
      aimY = camera.position.y + forward.y * 5.0;
      aimZ = camera.position.z + forward.z * 5.0;
    }

    // Air-building horizontal deck plane fallback for floor/roof pieces:
    // Evaluates all nearby floor, foundation, and wall-top elevations so upper stories
    // aim cleanly at upper roof planes instead of snapping back down to ground foundations.
    if (pieceType === 'floor' && !hitPiece && this.pieces.length > 0) {
      const candidateElevs: number[] = [];
      for (const p of this.pieces) {
        const d = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
        if (d > 11.5) continue;
        let elev: number | null = null;
        if (p.type === 'foundation') elev = p.y + FOUNDATION_HEIGHT;
        else if (p.type === 'floor') elev = p.y;
        else if (p.type === 'wall' || p.type === 'doorway' || p.type === 'window_wall' || p.type === 'stairs') {
          elev = p.y + WALL_HEIGHT;
        }
        if (elev !== null && !candidateElevs.some((e) => Math.abs(e - elev!) < 0.15)) {
          candidateElevs.push(Math.round(elev * 100) / 100);
        }
      }

      if (candidateElevs.length > 0) {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const footY = camera.position.y - 1.68;
        let chosen: { x: number; y: number; z: number; score: number } | null = null;

        if (Math.abs(dir.y) > 0.04) {
          for (const elev of candidateElevs) {
            const t = (elev - camera.position.y) / dir.y;
            if (t <= 0.6 || t >= Math.min(12.0, hitDistance + 0.5)) continue;
            const ix = camera.position.x + dir.x * t;
            const iz = camera.position.z + dir.z * t;
            const dCam = Math.hypot(ix - camera.position.x, iz - camera.position.z);
            if (dCam > 11.5) continue;
            const validTarget = findFloorPlacementTarget(ix, elev, iz, this.pieces);
            if (!validTarget || Math.abs(validTarget.roofY - elev) > 0.25) continue;
            const score = t + Math.abs(elev - footY) * 0.45;
            if (!chosen || score < chosen.score) {
              chosen = { x: ix, y: elev, z: iz, score };
            }
          }
        }

        if (!chosen) {
          const dirFlat = new THREE.Vector3(dir.x, 0, dir.z);
          if (dirFlat.lengthSq() > 0.001) dirFlat.normalize();
          else dirFlat.set(0, 0, -1);

          // Check forward cells along camera look direction at each elevation so looking horizontally/upward snaps to a valid connected slot
          let bestFallbackScore = Infinity;
          for (const elev of candidateElevs) {
            for (const distStep of [2.5, 4.0, 5.5, 7.0]) {
              const fx = camera.position.x + dirFlat.x * distStep;
              const fz = camera.position.z + dirFlat.z * distStep;
              const validTarget = findFloorPlacementTarget(fx, elev, fz, this.pieces);
              if (!validTarget || Math.abs(validTarget.roofY - elev) > 0.25) continue;
              const elevBias = dir.y > 0.05 && elev > camera.position.y ? -1.5 : 0;
              const score = Math.abs(elev - (camera.position.y - 0.35)) + distStep * 0.25 + elevBias;
              if (score < bestFallbackScore) {
                bestFallbackScore = score;
                chosen = { x: fx, y: elev, z: fz, score };
              }
            }
          }
        }

        if (chosen) {
          aimX = chosen.x;
          aimY = chosen.y;
          aimZ = chosen.z;
        }
      }
    }

    const res = computeBuildPlacement({
      pieceType,
      aimX,
      aimY,
      aimZ,
      playerY: camera.position.y - 1.68,
      hitNormalX,
      hitNormalY,
      hitNormalZ,
      groundYAt,
      existingPieces: this.pieces,
      playerYaw,
      rotSteps,
      woodCount,
      freeBuild,
      hitPiece,
    });

    this.currentPlacementValid = res.valid;
    this.currentPlacementReason = res.reason;
    this.lastPlacement = { x: res.x, y: res.y, z: res.z, rotY: res.rotY };

    this.ghostGroup.position.set(res.x, res.y, res.z);
    this.ghostGroup.rotation.y = res.rotY;

    const targetMat = res.valid ? this.ghostValidMat : this.ghostInvalidMat;
    this.ghostGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).material = targetMat;
      }
    });
  }

  public tryPlaceCurrentPiece(
    pieceType: BuildPieceType,
    resources: ResourceBag,
    freeBuild = false,
  ): { ok: boolean; reason: string; piece?: PlacedBuildPiece } {
    if (!this.currentPlacementValid) {
      return { ok: false, reason: this.currentPlacementReason };
    }
    const def = getBuildPieceDef(pieceType);
    if (!freeBuild) {
      if (resources.wood < def.twigCost) {
        return { ok: false, reason: `Need ${def.twigCost} Wood` };
      }
      resources.wood -= def.twigCost;
    }

    const piece: PlacedBuildPiece = {
      id: `piece_${this.idSeq++}`,
      type: pieceType,
      tier: 'twig',
      x: this.lastPlacement.x,
      y: this.lastPlacement.y,
      z: this.lastPlacement.z,
      rotY: this.lastPlacement.rotY,
      hp: TIER_MAX_HP.twig,
      maxHp: TIER_MAX_HP.twig,
      hasDoor: false,
      doorOpen: false,
    };
    this.spawnPieceVisual(piece);
    return { ok: true, reason: 'Placed', piece };
  }

  private spawnPieceVisual(piece: PlacedBuildPiece): void {
    const mat = this.tierMaterials[piece.tier];
    const group = this.buildPieceMesh(piece.type, mat, true);
    group.position.set(piece.x, piece.y, piece.z);
    group.rotation.y = piece.rotY;

    const hitMeshes: THREE.Mesh[] = [];
    group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.userData.pieceId = piece.id;
        m.castShadow = true;
        m.receiveShadow = true;
        hitMeshes.push(m);
        this.hitMeshes.push(m);
      }
    });

    this.root.add(group);
    this.pieces.push(piece);
    this.visuals.set(piece.id, {
      data: piece,
      group,
      hitMeshes,
      doorAngle: 0,
    });

    if (piece.type === 'doorway' && piece.hasDoor) {
      const openState = Boolean(piece.doorOpen);
      piece.hasDoor = false;
      this.installDoorOnPiece(piece.id);
      piece.doorOpen = openState;
      const vis = this.visuals.get(piece.id);
      if (vis) {
        vis.doorAngle = openState ? -Math.PI * 0.48 : 0;
        if (vis.doorPivot) vis.doorPivot.rotation.y = vis.doorAngle;
      }
    }
  }

  public installDoorOnPiece(pieceId: string): boolean {
    const vis = this.visuals.get(pieceId);
    if (!vis || vis.data.type !== 'doorway' || vis.data.hasDoor) return false;

    vis.data.hasDoor = true;
    vis.data.doorOpen = false;

    const pivot = new THREE.Group();
    pivot.position.set(-0.56, 0.05, 0);

    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 2.28, 0.1),
      this.doorMaterial,
    );
    doorPanel.position.set(0.56, 1.14, 0);
    doorPanel.castShadow = true;
    doorPanel.receiveShadow = true;
    doorPanel.userData.pieceId = pieceId;

    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.14, 0.14),
      this.doorHardwareMat,
    );
    brace.position.set(0.56, 0.72, 0);
    brace.userData.pieceId = pieceId;

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.18),
      this.doorHardwareMat,
    );
    handle.position.set(0.98, 1.08, 0);
    handle.userData.pieceId = pieceId;

    pivot.add(doorPanel, brace, handle);
    vis.group.add(pivot);
    vis.doorPivot = pivot;
    vis.hitMeshes.push(doorPanel, brace, handle);
    this.hitMeshes.push(doorPanel, brace, handle);
    return true;
  }

  public toggleDoor(pieceId: string): boolean {
    const vis = this.visuals.get(pieceId);
    if (!vis || !vis.data.hasDoor) return false;
    vis.data.doorOpen = !vis.data.doorOpen;
    return true;
  }

  public repairOrUpgradePiece(
    pieceId: string,
    resources: ResourceBag,
  ): { ok: boolean; reason: string; newTier?: BuildTier; repaired?: boolean } {
    const vis = this.visuals.get(pieceId);
    if (!vis) return { ok: false, reason: 'Invalid piece' };

    if (vis.data.hp < vis.data.maxHp * 0.95) {
      const repairItem = vis.data.tier === 'stone' ? 'stone' : 'wood';
      const cost = 8;
      if (resources[repairItem] >= cost) {
        resources[repairItem] -= cost;
        vis.data.hp = vis.data.maxHp;
        return {
          ok: true,
          repaired: true,
          reason: `Repaired (${vis.data.maxHp} HP)`,
        };
      }
      return { ok: false, reason: `Need ${cost} ${repairItem === 'stone' ? 'Stone' : 'Wood'} to repair` };
    }

    const check = canUpgradePiece(vis.data, resources);
    if (!check.ok) {
      return { ok: false, reason: check.reason };
    }
    if (!applyPieceUpgrade(vis.data, resources)) {
      return { ok: false, reason: 'Upgrade failed' };
    }
    const newMat = this.tierMaterials[vis.data.tier];
    for (const m of vis.hitMeshes) {
      if (vis.doorPivot && vis.doorPivot.children.includes(m)) continue;
      m.material = newMat;
    }
    return {
      ok: true,
      reason: `Upgraded to ${vis.data.tier.toUpperCase()}`,
      newTier: vis.data.tier,
    };
  }

  public demolishTwigPiece(pieceId: string): boolean {
    const vis = this.visuals.get(pieceId);
    if (!vis || vis.data.tier !== 'twig') return false;
    this.removePiece(pieceId);
    return true;
  }

  public damagePiece(pieceId: string, amount: number): boolean {
    const vis = this.visuals.get(pieceId);
    if (!vis) return false;
    vis.data.hp -= amount;
    if (vis.data.hp <= 0) {
      this.removePiece(pieceId);
      return true;
    }
    return false;
  }

  public removePiece(pieceId: string): void {
    const vis = this.visuals.get(pieceId);
    if (!vis) return;
    this.root.remove(vis.group);
    for (const m of vis.hitMeshes) {
      const idx = this.hitMeshes.indexOf(m);
      if (idx !== -1) this.hitMeshes.splice(idx, 1);
    }
    const pIdx = this.pieces.findIndex((p) => p.id === pieceId);
    if (pIdx !== -1) this.pieces.splice(pIdx, 1);
    this.visuals.delete(pieceId);
  }

  public placeCampfire(x: number, y: number, z: number, idOverride?: string): CampfireInstance {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x676b70,
      roughness: 0.9,
      flatShading: true,
    });
    const logMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkColor,
      roughness: 0.92,
    });

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45);
      stone.scale.set(1.2, 0.75, 1.0);
      group.add(stone);
    }

    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 7), logMat);
      log.rotation.z = Math.PI / 2 - 0.18;
      log.rotation.y = (i * Math.PI) / 3;
      log.position.y = 0.12;
      group.add(log);
    }

    const flameMatA = new THREE.MeshBasicMaterial({ color: 0xff7b1a });
    const flameMatB = new THREE.MeshBasicMaterial({ color: 0xffd15c });
    const flameA = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.56, 7), flameMatA);
    flameA.position.y = 0.34;
    const flameB = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 6), flameMatB);
    flameB.position.y = 0.28;
    group.add(flameA, flameB);

    const light = new THREE.PointLight(0xff8c38, 3.6, 18, 1.5);
    light.position.set(0, 0.7, 0);
    group.add(light);

    this.root.add(group);
    const cf: CampfireInstance = {
      id: idOverride ?? `cf_${this.propSeq++}`,
      x,
      y,
      z,
      group,
      light,
      flameA,
      flameB,
    };
    this.campfires.push(cf);
    return cf;
  }

  public placeLantern(x: number, y: number, z: number, idOverride?: string): LanternInstance {
    const id = idOverride ?? `lan_${this.propSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x3b4048,
      roughness: 0.36,
      metalness: 0.82,
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10), ironMat);
    base.position.y = 0.04;
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8), coreMat);
    coreMesh.position.y = 0.21;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.12, 8), ironMat);
    cap.position.y = 0.4;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 12), ironMat);
    handle.position.y = 0.49;

    const baseIntensity = 6.2;
    const light = new THREE.PointLight(0x86efac, baseIntensity, 32, 1.35);
    light.position.set(0, 0.48, 0);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.65, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.32;
    hitMesh.userData.lanternId = id;

    group.add(base, coreMesh, cap, handle, light, hitMesh);

    this.root.add(group);
    this.lanternHitMeshes.push(hitMesh);
    const ln: LanternInstance = {
      id,
      kind: 'lantern',
      x,
      y,
      z,
      rotY: 0,
      baseIntensity,
      group,
      light,
      coreMesh,
      hitMesh,
    };
    this.lanterns.push(ln);
    return ln;
  }

  public placeFloodlight(
    x: number,
    y: number,
    z: number,
    rotY = 0,
    idOverride?: string,
  ): LanternInstance {
    const id = idOverride ?? `fld_${this.propSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.78,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.5,
      metalness: 0.4,
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xbef264 });

    // Heavy tripod & base tank
    const baseHub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.18, 8), frameMat);
    baseHub.position.y = 0.09;
    const sludgeTank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.38, 10), coreMat);
    sludgeTank.position.y = 0.36;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.25, 8), frameMat);
    mast.position.y = 1.25;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8), accentMat);
    collar.position.y = 1.35;

    for (let leg = 0; leg < 3; leg++) {
      const a = (leg / 3) * Math.PI * 2;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), frameMat);
      strut.position.set(Math.cos(a) * 0.24, 0.26, Math.sin(a) * 0.24);
      strut.rotation.z = Math.cos(a) * 0.48;
      strut.rotation.x = -Math.sin(a) * 0.48;
      group.add(strut);
    }

    // Twin floodlight lamp crossbar at top
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.09, 0.09), accentMat);
    bar.position.y = 2.34;
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.12), coreMat);
    coreMesh.position.set(-0.28, 2.38, -0.08);
    const coreRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.12), coreMat);
    coreRight.position.set(0.28, 2.38, -0.08);
    const hoodLeft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.18), frameMat);
    hoodLeft.position.set(-0.28, 2.38, 0.02);
    const hoodRight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.18), frameMat);
    hoodRight.position.set(0.28, 2.38, 0.02);

    const baseIntensity = 13.5;
    const light = new THREE.PointLight(0xd9f99d, baseIntensity, 58, 1.15);
    light.position.set(0, 2.45, -0.2);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 2.6, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 1.3;
    hitMesh.userData.lanternId = id;

    group.add(
      baseHub,
      sludgeTank,
      mast,
      collar,
      bar,
      hoodLeft,
      hoodRight,
      coreMesh,
      coreRight,
      light,
      hitMesh,
    );

    this.root.add(group);
    this.lanternHitMeshes.push(hitMesh);
    const ln: LanternInstance = {
      id,
      kind: 'floodlight',
      x,
      y,
      z,
      rotY,
      baseIntensity,
      group,
      light,
      coreMesh,
      hitMesh,
    };
    this.lanterns.push(ln);
    return ln;
  }

  public removeLantern(lanternId: string): LanternInstance | null {
    const idx = this.lanterns.findIndex((l) => l.id === lanternId);
    if (idx === -1) return null;
    const ln = this.lanterns[idx];
    this.root.remove(ln.group);
    const hIdx = this.lanternHitMeshes.indexOf(ln.hitMesh);
    if (hIdx !== -1) this.lanternHitMeshes.splice(hIdx, 1);
    this.lanterns.splice(idx, 1);
    return ln;
  }

  public placeBarricade(
    x: number,
    y: number,
    z: number,
    rotY: number,
    hp = 160,
    idOverride?: string,
  ): BarricadeInstance {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const woodMat = this.tierMaterials.wood;
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xd6cbb8,
      roughness: 0.72,
    });

    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.22), woodMat);
    rail.position.y = 0.35;
    rail.castShadow = true;
    group.add(rail);

    for (let i = -2; i <= 2; i++) {
      const sx = i * 0.42;
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.35, 6), woodMat);
      stake.position.set(sx, 0.56, 0.12);
      stake.rotation.x = 0.42;
      stake.castShadow = true;

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 6), tipMat);
      tip.position.set(sx, 1.15, 0.38);
      tip.rotation.x = 0.42;

      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.05, 6), woodMat);
      brace.position.set(sx, 0.42, -0.2);
      brace.rotation.x = -0.45;
      group.add(stake, tip, brace);
    }

    this.root.add(group);
    const b: BarricadeInstance = {
      id: idOverride ?? `bar_${this.propSeq++}`,
      x,
      y,
      z,
      rotY,
      hp,
      group,
    };
    this.barricades.push(b);
    return b;
  }

  public placeBed(
    x: number,
    y: number,
    z: number,
    rotY: number,
    idOverride?: string,
  ): BedInstance {
    const bedId = idOverride ?? `bed_${this.propSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const frameMat = this.tierMaterials.wood;
    const blanketMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.85,
    });
    const pillowMat = new THREE.MeshStandardMaterial({
      color: 0xe5dfd3,
      roughness: 0.88,
    });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 2.04), frameMat);
    base.position.y = 0.22;
    base.castShadow = true;
    base.receiveShadow = true;

    for (const [lx, lz] of [
      [-0.5, -0.92],
      [0.5, -0.92],
      [-0.5, 0.92],
      [0.5, 0.92],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), frameMat);
      leg.position.set(lx, 0.11, lz);
      group.add(leg);
    }

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.42, 0.1), frameMat);
    headboard.position.set(0, 0.46, -0.97);
    headboard.castShadow = true;

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.16, 1.88), pillowMat);
    mattress.position.set(0, 0.35, 0);
    mattress.receiveShadow = true;

    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 1.32), blanketMat);
    blanket.position.set(0, 0.36, 0.28);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.36), pillowMat);
    pillow.position.set(0, 0.46, -0.68);

    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), markerMat);
    beacon.position.set(0, 0.68, -0.97);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.85, 2.25),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.42;
    hitMesh.userData.bedId = bedId;

    group.add(base, headboard, mattress, blanket, pillow, beacon, hitMesh);
    this.root.add(group);

    const bed: BedInstance = {
      id: bedId,
      x,
      y,
      z,
      rotY,
      group,
      hitMesh,
    };
    this.beds.push(bed);
    this.bedHitMeshes.push(hitMesh);
    return bed;
  }

  public placeBarrel(
    x: number,
    y: number,
    z: number,
    rotY: number,
    hp = PLACED_BARREL_MAX_HP,
    idOverride?: string,
  ): ExplosiveBarrelInstance {
    const barrelId = idOverride ?? `barrel_${this.propSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const drumMat = new THREE.MeshStandardMaterial({
      map: this.textures.barrelColor,
      color: 0xdc2626,
      roughness: 0.45,
      metalness: 0.6,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.42,
      metalness: 0.4,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.35,
      metalness: 0.85,
    });

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 14), drumMat);
    drum.position.y = 0.575;
    drum.castShadow = true;
    drum.receiveShadow = true;

    const hazardBand = new THREE.Mesh(new THREE.CylinderGeometry(0.432, 0.432, 0.24, 14), bandMat);
    hazardBand.position.y = 0.58;

    const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.032, 6, 16), rimMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 1.14;

    const botRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.032, 6, 16), rimMat);
    botRim.rotation.x = Math.PI / 2;
    botRim.position.y = 0.04;

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), rimMat);
    cap.position.set(0.18, 1.16, 0);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 1.35, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.65;
    hitMesh.userData.barrelId = barrelId;

    group.add(drum, hazardBand, topRim, botRim, cap, hitMesh);
    this.root.add(group);

    const inst: ExplosiveBarrelInstance = {
      id: barrelId,
      x,
      y,
      z,
      rotY,
      hp,
      maxHp: PLACED_BARREL_MAX_HP,
      group,
      hitMesh,
    };
    this.barrels.push(inst);
    this.barrelHitMeshes.push(hitMesh);
    return inst;
  }

  public placeChest(
    x: number,
    y: number,
    z: number,
    rotY: number,
    hp = 180,
    slots?: InventorySlot[],
    idOverride?: string,
  ): ChestInstance {
    const chestId = idOverride ?? `chest_${this.propSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const woodMat = this.tierMaterials.wood;
    const ironMat = this.doorHardwareMat;

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.56, 0.72), woodMat);
    body.position.y = 0.28;
    body.castShadow = true;
    body.receiveShadow = true;

    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, 0.76), woodMat);
    lid.position.y = 0.62;
    lid.castShadow = true;

    const bandL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.66, 0.78), ironMat);
    bandL.position.set(-0.36, 0.36, 0);
    const bandR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.66, 0.78), ironMat);
    bandR.position.set(0.36, 0.36, 0);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), ironMat);
    lock.position.set(0, 0.5, 0.38);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.82, 0.88),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.38;
    hitMesh.userData.chestId = chestId;

    group.add(body, lid, bandL, bandR, lock, hitMesh);
    this.root.add(group);

    const normalizedSlots = createInitialChestSlots();
    if (slots) {
      for (let i = 0; i < Math.min(normalizedSlots.length, slots.length); i++) {
        normalizedSlots[i] = { itemId: slots[i].itemId, count: slots[i].count };
      }
    }

    const inst: ChestInstance = {
      id: chestId,
      x,
      y,
      z,
      rotY,
      hp,
      maxHp: 180,
      slots: normalizedSlots,
      group,
      hitMesh,
    };
    this.chests.push(inst);
    this.chestHitMeshes.push(hitMesh);
    return inst;
  }

  public getChestById(chestId: string): ChestInstance | null {
    return this.chests.find((c) => c.id === chestId) ?? null;
  }

  public removeChest(chestId: string): ChestInstance | null {
    const idx = this.chests.findIndex((c) => c.id === chestId);
    if (idx === -1) return null;
    const chest = this.chests[idx];
    this.root.remove(chest.group);
    const hIdx = this.chestHitMeshes.indexOf(chest.hitMesh);
    if (hIdx !== -1) this.chestHitMeshes.splice(hIdx, 1);
    this.chests.splice(idx, 1);
    return chest;
  }

  public damageChest(
    chestId: string,
    amount: number,
  ): { destroyed: boolean; chest: ChestInstance | null } {
    const chest = this.getChestById(chestId);
    if (!chest) return { destroyed: false, chest: null };
    chest.hp -= amount;
    if (chest.hp <= 0) {
      this.removeChest(chestId);
      return { destroyed: true, chest };
    }
    return { destroyed: false, chest };
  }

  public exportChests(): Record<string, InventorySlot[]> {
    const out: Record<string, InventorySlot[]> = {};
    for (const c of this.chests) {
      out[c.id] = c.slots.map((s) => ({ itemId: s.itemId, count: s.count }));
    }
    return out;
  }

  public placeTurret(
    x: number,
    y: number,
    z: number,
    rotY: number,
    hp = 180,
    idOverride?: string,
  ): TurretInstance {
    const turretId = idOverride ?? `turret_${this.propSeq++}`;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const frameMat = this.doorHardwareMat;
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3b4836,
      roughness: 0.42,
      metalness: 0.65,
    });
    const scannerMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

    // Tripod legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rotY;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.92, 6), frameMat);
      leg.position.set(Math.cos(a) * 0.28, 0.4, Math.sin(a) * 0.28);
      leg.rotation.z = Math.cos(a) * 0.48;
      leg.rotation.x = -Math.sin(a) * 0.48;
      leg.castShadow = true;
      group.add(leg);
    }

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.65, 10), frameMat);
    pedestal.position.y = 0.52;
    pedestal.castShadow = true;
    group.add(pedestal);

    const headPivot = new THREE.Group();
    headPivot.position.y = 0.95;
    headPivot.rotation.y = rotY;

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.48), armorMat);
    housing.castShadow = true;
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.56, 8), frameMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.08, 0.02, 0.42);
    const barrelR = barrelL.clone();
    barrelR.position.x = 0.08;
    const scannerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), scannerMat);
    scannerMesh.position.set(0, 0.08, 0.24);
    const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 8), armorMat);
    ammoDrum.position.set(0, -0.1, -0.14);
    headPivot.add(housing, barrelL, barrelR, scannerMesh, ammoDrum);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.35, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.68;
    hitMesh.userData.turretId = turretId;

    group.add(headPivot, hitMesh);
    this.root.add(group);

    const inst: TurretInstance = {
      id: turretId,
      x,
      y,
      z,
      rotY,
      hp,
      maxHp: 180,
      cooldown: 0,
      yawHead: rotY,
      group,
      headPivot,
      hitMesh,
      scannerMesh,
    };
    this.turrets.push(inst);
    this.turretHitMeshes.push(hitMesh);
    return inst;
  }

  public getTurretById(turretId: string): TurretInstance | null {
    return this.turrets.find((t) => t.id === turretId) ?? null;
  }

  public removeTurret(turretId: string): TurretInstance | null {
    const idx = this.turrets.findIndex((t) => t.id === turretId);
    if (idx === -1) return null;
    const turret = this.turrets[idx];
    this.root.remove(turret.group);
    const hIdx = this.turretHitMeshes.indexOf(turret.hitMesh);
    if (hIdx !== -1) this.turretHitMeshes.splice(hIdx, 1);
    this.turrets.splice(idx, 1);
    return turret;
  }

  public damageTurret(
    turretId: string,
    amount: number,
  ): { destroyed: boolean; turret: TurretInstance | null } {
    const turret = this.getTurretById(turretId);
    if (!turret) return { destroyed: false, turret: null };
    turret.hp -= amount;
    if (turret.hp <= 0) {
      this.removeTurret(turretId);
      return { destroyed: true, turret };
    }
    return { destroyed: false, turret };
  }

  public removeBarrel(barrelId: string): boolean {
    const idx = this.barrels.findIndex((b) => b.id === barrelId);
    if (idx === -1) return false;
    const b = this.barrels[idx];
    this.root.remove(b.group);
    const hIdx = this.barrelHitMeshes.indexOf(b.hitMesh);
    if (hIdx !== -1) this.barrelHitMeshes.splice(hIdx, 1);
    this.barrels.splice(idx, 1);
    return true;
  }

  public damageBarricade(id: string, amount: number): void {
    const idx = this.barricades.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const b = this.barricades[idx];
    b.hp -= amount;
    if (b.hp <= 0) {
      this.root.remove(b.group);
      this.barricades.splice(idx, 1);
    }
  }

  public exportProps(): PlacedPropData[] {
    const out: PlacedPropData[] = [];
    for (const cf of this.campfires) {
      out.push({ id: cf.id, kind: 'campfire', x: cf.x, y: cf.y, z: cf.z, rotY: 0, hp: 100 });
    }
    for (const ln of this.lanterns) {
      out.push({
        id: ln.id,
        kind: ln.kind,
        x: ln.x,
        y: ln.y,
        z: ln.z,
        rotY: ln.rotY,
        hp: ln.kind === 'floodlight' ? 160 : 100,
      });
    }
    for (const b of this.barricades) {
      out.push({ id: b.id, kind: 'barricade', x: b.x, y: b.y, z: b.z, rotY: b.rotY, hp: b.hp });
    }
    for (const bed of this.beds) {
      out.push({ id: bed.id, kind: 'bed', x: bed.x, y: bed.y, z: bed.z, rotY: bed.rotY, hp: 100 });
    }
    for (const barrel of this.barrels) {
      out.push({
        id: barrel.id,
        kind: 'explosive_barrel',
        x: barrel.x,
        y: barrel.y,
        z: barrel.z,
        rotY: barrel.rotY,
        hp: barrel.hp,
      });
    }
    for (const chest of this.chests) {
      out.push({
        id: chest.id,
        kind: 'chest',
        x: chest.x,
        y: chest.y,
        z: chest.z,
        rotY: chest.rotY,
        hp: chest.hp,
      });
    }
    for (const turret of this.turrets) {
      out.push({
        id: turret.id,
        kind: 'turret',
        x: turret.x,
        y: turret.y,
        z: turret.z,
        rotY: turret.rotY,
        hp: turret.hp,
      });
    }
    return out;
  }

  public restoreFromSave(
    pieces: PlacedBuildPiece[],
    props: PlacedPropData[],
    chestMap?: Record<string, InventorySlot[]>,
  ): void {
    this.clearAll();
    let maxPieceId = 0;
    for (const p of pieces) {
      const cloned = { ...p };
      this.spawnPieceVisual(cloned);
      const n = Number(cloned.id.replace(/\D+/g, ''));
      if (Number.isFinite(n) && n > maxPieceId) maxPieceId = n;
    }
    this.idSeq = Math.max(1, maxPieceId + 1);

    let maxPropId = 0;
    for (const pr of props) {
      if (pr.kind === 'campfire') {
        this.placeCampfire(pr.x, pr.y, pr.z, pr.id);
      } else if (pr.kind === 'lantern') {
        this.placeLantern(pr.x, pr.y, pr.z, pr.id);
      } else if (pr.kind === 'floodlight') {
        this.placeFloodlight(pr.x, pr.y, pr.z, pr.rotY, pr.id);
      } else if (pr.kind === 'barricade') {
        this.placeBarricade(pr.x, pr.y, pr.z, pr.rotY, pr.hp, pr.id);
      } else if (pr.kind === 'bed') {
        this.placeBed(pr.x, pr.y, pr.z, pr.rotY, pr.id);
      } else if (pr.kind === 'explosive_barrel') {
        this.placeBarrel(pr.x, pr.y, pr.z, pr.rotY, pr.hp, pr.id);
      } else if (pr.kind === 'chest') {
        this.placeChest(pr.x, pr.y, pr.z, pr.rotY, pr.hp, chestMap?.[pr.id], pr.id);
      } else if (pr.kind === 'turret') {
        this.placeTurret(pr.x, pr.y, pr.z, pr.rotY, pr.hp, pr.id);
      }
      const n = Number(pr.id.replace(/\D+/g, ''));
      if (Number.isFinite(n) && n > maxPropId) maxPropId = n;
    }
    this.propSeq = Math.max(1, maxPropId + 1);
  }

  public update(dt: number, elapsed: number): void {
    for (const vis of this.visuals.values()) {
      if (vis.doorPivot) {
        const targetAngle = vis.data.doorOpen ? -Math.PI * 0.48 : 0;
        vis.doorAngle = THREE.MathUtils.damp(vis.doorAngle, targetAngle, 10, dt);
        vis.doorPivot.rotation.y = vis.doorAngle;
      }
    }

    for (let i = 0; i < this.campfires.length; i++) {
      const cf = this.campfires[i];
      const f = Math.sin(elapsed * 14 + i * 2.1) * 0.15 + Math.cos(elapsed * 23 + i) * 0.08;
      cf.light.intensity = 3.4 + f * 2.4;
      cf.flameA.scale.set(1 + f * 0.2, 1 + f * 0.35, 1 + f * 0.2);
      cf.flameB.scale.set(1 - f * 0.15, 1 + f * 0.4, 1 - f * 0.15);
    }

    for (let i = 0; i < this.lanterns.length; i++) {
      const ln = this.lanterns[i];
      const pulse = ln.kind === 'floodlight' ? 0.45 : 0.3;
      ln.light.intensity = ln.baseIntensity + Math.sin(elapsed * 4 + i) * pulse;
    }
  }

  public getFloorHeightAt(x: number, z: number, currentFootY: number): number | null {
    let highest: number | null = null;
    const half = GRID_SIZE * 0.5;

    for (const p of this.pieces) {
      const dx = x - p.x;
      const dz = z - p.z;
      const cos = Math.cos(p.rotY);
      const sin = Math.sin(p.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) > half + 0.16 || Math.abs(lz) > half + 0.16) continue;

      if (p.type === 'foundation') {
        const top = p.y + FOUNDATION_HEIGHT;
        if (currentFootY >= top - 0.65 && (highest === null || top > highest)) {
          highest = top;
        }
      } else if (p.type === 'floor') {
        const top = p.y + FLOOR_THICKNESS;
        if (currentFootY >= top - 0.55 && (highest === null || top > highest)) {
          highest = top;
        }
      } else if (p.type === 'stairs') {
        const t = THREE.MathUtils.clamp((lz + half) / GRID_SIZE, 0, 1);
        const rampY = p.y + t * WALL_HEIGHT;
        if (currentFootY >= rampY - 0.9 && (highest === null || rampY > highest)) {
          highest = rampY;
        }
      }
    }

    // Walkable placed props (Chests, Beds, Barrels)
    for (const ch of this.chests) {
      const dx = x - ch.x;
      const dz = z - ch.z;
      const cos = Math.cos(ch.rotY);
      const sin = Math.sin(ch.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const top = ch.y + 0.72;
      if (Math.abs(lx) <= 0.62 && Math.abs(lz) <= 0.42 && currentFootY >= top - 0.35) {
        if (highest === null || top > highest) highest = top;
      }
    }
    for (const bed of this.beds) {
      const dx = x - bed.x;
      const dz = z - bed.z;
      const cos = Math.cos(bed.rotY);
      const sin = Math.sin(bed.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const top = bed.y + 0.46;
      if (Math.abs(lx) <= 0.58 && Math.abs(lz) <= 0.98 && currentFootY >= top - 0.35) {
        if (highest === null || top > highest) highest = top;
      }
    }

    return highest;
  }

  public resolveHorizontalCollision(
    pos: THREE.Vector3,
    radius: number,
    eyeHeight = 1.65,
    stepUpHeight = 0.38,
  ): void {
    const half = GRID_SIZE * 0.5;
    const footY = pos.y - eyeHeight;

    // Two solver passes prevent diagonal corner tunneling between intersecting walls/props
    for (let pass = 0; pass < 2; pass++) {
      for (const p of this.pieces) {
        if (p.type === 'foundation') {
          const top = p.y + FOUNDATION_HEIGHT;
          if (footY < top - stepUpHeight && footY + 1.65 > p.y - 0.5) {
            resolveCircleVsOBB2D(pos, p.x, p.z, p.rotY, half, half, radius);
          }
          continue;
        }

        if (p.type === 'floor') {
          const top = p.y + FLOOR_THICKNESS;
          if (footY < top - 0.2 && footY + 1.6 > p.y + 0.05) {
            resolveCircleVsOBB2D(pos, p.x, p.z, p.rotY, half, half, radius);
          }
          continue;
        }

        if (p.type === 'stairs') {
          const dx = pos.x - p.x;
          const dz = pos.z - p.z;
          const cos = Math.cos(p.rotY);
          const sin = Math.sin(p.rotY);
          const lz = dx * sin + dz * cos;
          const t = THREE.MathUtils.clamp((lz + half) / GRID_SIZE, 0, 1);
          const rampY = p.y + t * WALL_HEIGHT;
          // Solid stair body/sides block clipping when not stepping cleanly on top of the ramp or walking under tall upper end
          if (footY < rampY - 0.78 && footY + 1.65 > Math.max(p.y + 0.08, rampY - 0.32)) {
            resolveCircleVsOBB2D(pos, p.x, p.z, p.rotY, half * 0.94, half, radius);
          }
          continue;
        }

        if (p.type !== 'wall' && p.type !== 'doorway' && p.type !== 'window_wall') continue;
        if (footY > p.y + WALL_HEIGHT - 0.15 || footY + 1.65 < p.y + 0.12) continue;

        if (p.type === 'wall' || p.type === 'window_wall') {
          resolveCircleVsOBB2D(pos, p.x, p.z, p.rotY, half, 0.18, radius);
        } else {
          // Doorway: left jamb, right jamb, and optional closed door panel
          const cos = Math.cos(p.rotY);
          const sin = Math.sin(p.rotY);
          const jambHalfW = (half - 0.58) * 0.5;
          const jambOffset = 0.58 + jambHalfW;

          resolveCircleVsOBB2D(
            pos,
            p.x - jambOffset * cos,
            p.z + jambOffset * sin,
            p.rotY,
            jambHalfW,
            0.18,
            radius,
          );
          resolveCircleVsOBB2D(
            pos,
            p.x + jambOffset * cos,
            p.z - jambOffset * sin,
            p.rotY,
            jambHalfW,
            0.18,
            radius,
          );

          if (p.hasDoor && !p.doorOpen) {
            resolveCircleVsOBB2D(pos, p.x, p.z, p.rotY, 0.58, 0.14, radius);
          }
        }
      }

      // Spike Barricades solid pushout
      for (const b of this.barricades) {
        if (footY < b.y + 1.0 && footY + 1.65 > b.y - 0.1) {
          resolveCircleVsOBB2D(pos, b.x, b.z, b.rotY, 1.05, 0.42, radius);
        }
      }

      // Placed Storage Chests solid pushout
      for (const ch of this.chests) {
        if (footY < ch.y + 0.62 && footY + 1.65 > ch.y - 0.15) {
          resolveCircleVsOBB2D(pos, ch.x, ch.z, ch.rotY, 0.58, 0.38, radius);
        }
      }

      // Placed Camp Beds solid pushout
      for (const bed of this.beds) {
        if (footY < bed.y + 0.38 && footY + 1.65 > bed.y - 0.15) {
          resolveCircleVsOBB2D(pos, bed.x, bed.z, bed.rotY, 0.56, 0.96, radius);
        }
      }

      // Lantern & Floodlight tower solid pushout
      for (const ln of this.lanterns) {
        const topOffset = ln.kind === 'floodlight' ? 2.45 : 1.45;
        const bodyRad = ln.kind === 'floodlight' ? 0.38 : 0.26;
        if (footY < ln.y + topOffset && footY + 1.65 > ln.y - 0.1) {
          const dx = pos.x - ln.x;
          const dz = pos.z - ln.z;
          const minD = bodyRad + radius;
          const dSq = dx * dx + dz * dz;
          if (dSq < minD * minD && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            const push = minD - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          }
        }
      }

      // Campfire ring solid pushout
      for (const cf of this.campfires) {
        if (footY < cf.y + 0.45 && footY + 1.65 > cf.y - 0.15) {
          const dx = pos.x - cf.x;
          const dz = pos.z - cf.z;
          const minD = 0.52 + radius;
          const dSq = dx * dx + dz * dz;
          if (dSq < minD * minD && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            const push = minD - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          }
        }
      }

      // Placed Explosive Barrels solid pushout
      for (const barrel of this.barrels) {
        if (footY < barrel.y + 1.18 && footY + 1.65 > barrel.y - 0.1) {
          const dx = pos.x - barrel.x;
          const dz = pos.z - barrel.z;
          const minD = 0.45 + radius;
          const dSq = dx * dx + dz * dz;
          if (dSq < minD * minD && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            const push = minD - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          }
        }
      }

      // Placed Auto-Turrets solid pushout
      for (const turret of this.turrets) {
        if (footY < turret.y + 1.2 && footY + 1.65 > turret.y - 0.1) {
          const dx = pos.x - turret.x;
          const dz = pos.z - turret.z;
          const minD = 0.44 + radius;
          const dSq = dx * dx + dz * dz;
          if (dSq < minD * minD && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            const push = minD - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          }
        }
      }
    }
  }

  private buildPieceMesh(
    type: BuildPieceType,
    mat: THREE.Material,
    _solid: boolean,
  ): THREE.Group {
    const group = new THREE.Group();
    const s = GRID_SIZE;

    if (type === 'foundation') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(s, FOUNDATION_HEIGHT, s), mat);
      slab.position.y = FOUNDATION_HEIGHT * 0.5;
      group.add(slab);

      const postGeo = new THREE.BoxGeometry(0.28, 1.8, 0.28);
      const corner = s * 0.5 - 0.18;
      for (const [cx, cz] of [
        [-corner, -corner],
        [corner, -corner],
        [-corner, corner],
        [corner, corner],
      ]) {
        const post = new THREE.Mesh(postGeo, mat);
        post.position.set(cx, -0.75, cz);
        group.add(post);
      }
      return group;
    }

    if (type === 'wall') {
      const main = new THREE.Mesh(new THREE.BoxGeometry(s, WALL_HEIGHT, 0.22), mat);
      main.position.y = WALL_HEIGHT * 0.5;
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(s + 0.04, 0.16, 0.28), mat);
      topBeam.position.y = WALL_HEIGHT - 0.08;
      const botBeam = new THREE.Mesh(new THREE.BoxGeometry(s + 0.04, 0.14, 0.28), mat);
      botBeam.position.y = 0.07;
      group.add(main, topBeam, botBeam);
      return group;
    }

    if (type === 'doorway') {
      const jambW = (s - 1.2) * 0.5;
      const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, WALL_HEIGHT, 0.22), mat);
      leftJamb.position.set(-(s * 0.5 - jambW * 0.5), WALL_HEIGHT * 0.5, 0);

      const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, WALL_HEIGHT, 0.22), mat);
      rightJamb.position.set(s * 0.5 - jambW * 0.5, WALL_HEIGHT * 0.5, 0);

      const lintelH = WALL_HEIGHT - 2.34;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.22, lintelH, 0.24), mat);
      lintel.position.set(0, 2.34 + lintelH * 0.5, 0);

      const sill = new THREE.Mesh(new THREE.BoxGeometry(s, 0.08, 0.26), mat);
      sill.position.y = 0.04;

      group.add(leftJamb, rightJamb, lintel, sill);
      return group;
    }

    if (type === 'window_wall') {
      const sillH = 1.05;
      const winH = 1.05;
      const winW = 1.35;
      const sideW = (s - winW) * 0.5;
      const lintelH = WALL_HEIGHT - sillH - winH;

      const lower = new THREE.Mesh(new THREE.BoxGeometry(s, sillH, 0.22), mat);
      lower.position.y = sillH * 0.5;

      const leftSide = new THREE.Mesh(new THREE.BoxGeometry(sideW, winH, 0.22), mat);
      leftSide.position.set(-(s * 0.5 - sideW * 0.5), sillH + winH * 0.5, 0);

      const rightSide = new THREE.Mesh(new THREE.BoxGeometry(sideW, winH, 0.22), mat);
      rightSide.position.set(s * 0.5 - sideW * 0.5, sillH + winH * 0.5, 0);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(s, lintelH, 0.22), mat);
      upper.position.y = sillH + winH + lintelH * 0.5;

      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, winH, 0.08), mat);
      bar.position.set(0, sillH + winH * 0.5, 0);

      group.add(lower, leftSide, rightSide, upper, bar);
      return group;
    }

    if (type === 'floor') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(s, FLOOR_THICKNESS, s), mat);
      deck.position.y = FLOOR_THICKNESS * 0.5;
      const joistA = new THREE.Mesh(new THREE.BoxGeometry(s, 0.12, 0.14), mat);
      joistA.position.set(0, -0.04, -s * 0.3);
      const joistB = new THREE.Mesh(new THREE.BoxGeometry(s, 0.12, 0.14), mat);
      joistB.position.set(0, -0.04, s * 0.3);
      group.add(deck, joistA, joistB);
      return group;
    }

    const steps = 7;
    const stepD = s / steps;
    const stepH = WALL_HEIGHT / steps;
    for (let i = 0; i < steps; i++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(s * 0.88, 0.14, stepD + 0.08), mat);
      tread.position.set(0, (i + 0.5) * stepH, -s * 0.5 + (i + 0.5) * stepD);
      group.add(tread);
    }
    const stringerGeo = new THREE.BoxGeometry(0.14, 0.24, Math.hypot(s, WALL_HEIGHT));
    const slopeAngle = Math.atan2(WALL_HEIGHT, s);
    for (const sx of [-s * 0.44, s * 0.44]) {
      const stringer = new THREE.Mesh(stringerGeo, mat);
      stringer.position.set(sx, WALL_HEIGHT * 0.5 - 0.1, 0);
      stringer.rotation.x = -slopeAngle;
      group.add(stringer);
    }
    return group;
  }

  public clearAll(): void {
    for (const id of [...this.visuals.keys()]) {
      this.removePiece(id);
    }
    for (const cf of this.campfires) {
      this.root.remove(cf.group);
    }
    this.campfires.length = 0;
    for (const ln of this.lanterns) {
      this.root.remove(ln.group);
    }
    this.lanterns.length = 0;
    this.lanternHitMeshes.length = 0;
    for (const b of this.barricades) {
      this.root.remove(b.group);
    }
    this.barricades.length = 0;
    for (const bed of this.beds) {
      this.root.remove(bed.group);
    }
    this.beds.length = 0;
    this.bedHitMeshes.length = 0;
    for (const barrel of this.barrels) {
      this.root.remove(barrel.group);
    }
    this.barrels.length = 0;
    this.barrelHitMeshes.length = 0;
    for (const chest of this.chests) {
      this.root.remove(chest.group);
    }
    this.chests.length = 0;
    this.chestHitMeshes.length = 0;
    for (const turret of this.turrets) {
      this.root.remove(turret.group);
    }
    this.turrets.length = 0;
    this.turretHitMeshes.length = 0;
  }
}
