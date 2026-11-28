import * as THREE from 'three';
import { hashSeedString, type WorldBoxCollider } from './rules';
import type { ProceduralTextureSet } from './Textures';

export type WorldNodeKind =
  | 'tree'
  | 'stone'
  | 'metal'
  | 'sulfur'
  | 'sludge'
  | 'berry_bush'
  | 'barrel'
  | 'crate';

export interface CaveSite {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  floorY: number;
  hillHeight: number;
  entranceAngle: number;
}

export interface WorldNode {
  id: string;
  kind: WorldNodeKind;
  x: number;
  y: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  flashTimer: number;
  shakeTimer: number;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  baseScale: number;
}

export interface LootContainer {
  id: string;
  structureIndex: number;
  name: string;
  x: number;
  y: number;
  z: number;
  opened: boolean;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  lidMesh: THREE.Mesh;
  beaconMesh: THREE.Mesh;
}

export const RIVER_WATER_Y = 0.25;

export interface WorldData {
  seedString: string;
  seedNum: number;
  root: THREE.Group;
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  riverMesh: THREE.Mesh;
  nodes: WorldNode[];
  hitMeshes: THREE.Object3D[];
  lootContainers: LootContainer[];
  lootHitMeshes: THREE.Object3D[];
  markLootOpened: (lootId: string) => void;
  colliders: Array<{ x: number; z: number; radius: number; height?: number; nodeId?: string }>;
  boxColliders: WorldBoxCollider[];
  caveSites: readonly CaveSite[];
  isInsideCave: (x: number, z: number) => CaveSite | null;
  getCaveDepthAt: (x: number, z: number) => number;
  groundHeightAt: (x: number, z: number) => number;
  roadCenterXAtZ: (z: number) => number;
  isWaterAt: (x: number, z: number) => boolean;
  update: (dt: number, elapsed: number) => void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeAngleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function computeCaveSites(seedNum: number): CaveSite[] {
  const rng = mulberry32(seedNum ^ 0x9e3779b9);
  const baseAngles = [
    rng() * Math.PI * 2,
    rng() * Math.PI * 2 + (Math.PI * 2) / 3,
    rng() * Math.PI * 2 + (Math.PI * 4) / 3,
  ];
  // Guarantee spread around the island
  const a0 = baseAngles[0];
  const a1 = a0 + 2.0 + rng() * 0.5;
  const a2 = a1 + 2.0 + rng() * 0.5;

  const specs = [
    { id: 'iron_cavern', name: 'Iron Cavern', angle: a0, dist: 54 + rng() * 22, radius: 11.2, floorY: 0.78, hillHeight: 7.4 },
    { id: 'sludge_grotto', name: 'Sludge Abyss', angle: a1, dist: 58 + rng() * 24, radius: 11.8, floorY: 0.72, hillHeight: 7.8 },
    { id: 'sulfur_shaft', name: 'Sulfur Mine', angle: a2, dist: 56 + rng() * 24, radius: 10.6, floorY: 0.85, hillHeight: 7.1 },
  ];

  return specs.map((s) => {
    const x = Math.round(Math.cos(s.angle) * s.dist);
    const z = Math.round(Math.sin(s.angle) * s.dist);
    // Face entrance roughly inward toward the island center so players find it easily
    const entranceAngle = Math.atan2(10 - z, 0 - x) + (rng() - 0.5) * 0.45;
    return {
      id: s.id,
      name: s.name,
      x,
      z,
      radius: s.radius,
      floorY: s.floorY,
      hillHeight: s.hillHeight,
      entranceAngle,
    };
  });
}

export function roadCenterXAtZ(z: number, seedNum = 42019): number {
  const p1 = ((seedNum & 0xff) / 255) * Math.PI * 2;
  const p2 = (((seedNum >> 8) & 0xff) / 255) * Math.PI * 2;
  const amp = 10 + (((seedNum >> 16) & 0x7) / 7) * 8;
  return Math.sin(z * 0.036 + p1) * amp + Math.cos(z * 0.018 + p2) * 6.5;
}

export function islandRadiusAt(x: number, z: number, seedNum = 42019): number {
  const ang = Math.atan2(z, x);
  const p1 = ((seedNum & 0xff) / 255) * Math.PI * 2;
  const p2 = (((seedNum >> 8) & 0xff) / 255) * Math.PI * 2;
  const p3 = (((seedNum >> 16) & 0xff) / 255) * Math.PI * 2;
  return (
    155 +
    Math.sin(ang * 2 + p1) * 10.5 +
    Math.cos(ang * 3 + p2) * 7.5 +
    Math.sin(ang * 5 + p3) * 4.2
  );
}

export function riverCenterAtZ(z: number, seedNum = 42019): number {
  const side = (seedNum & 1) === 0 ? 1 : -1;
  const p1 = (((seedNum >> 4) & 0xff) / 255) * Math.PI * 2;
  const p2 = (((seedNum >> 12) & 0xff) / 255) * Math.PI * 2;
  const baseOffset = 34 + (((seedNum >> 2) & 0x7) / 7) * 18;
  return (
    side * baseOffset +
    Math.sin(z * 0.032 + p1) * 16 +
    Math.cos(z * 0.016 + p2) * 8
  );
}

export function riverHalfWidthAtZ(z: number, seedNum = 42019): number {
  const p = (((seedNum >> 6) & 0x7f) / 127) * Math.PI * 2;
  return 4.8 + Math.sin(z * 0.048 + p) * 1.2;
}

export function isInsideCaveAt(
  x: number,
  z: number,
  caveSites: readonly CaveSite[],
): CaveSite | null {
  for (const cave of caveSites) {
    const cd = Math.hypot(x - cave.x, z - cave.z);
    if (cd < cave.radius - 0.5) {
      return cave;
    }
    const ang = Math.atan2(z - cave.z, x - cave.x);
    if (cd < cave.radius + 3.2 && normalizeAngleDiff(ang, cave.entranceAngle) < 0.36) {
      return cave;
    }
  }
  return null;
}

export function getCaveDepthAt(
  x: number,
  z: number,
  caveSites: readonly CaveSite[],
  seedNum: number,
): number {
  for (const cave of caveSites) {
    const cd = Math.hypot(x - cave.x, z - cave.z);
    if (cd < cave.radius - 0.5) {
      const gy = groundHeightAt(x, z, seedNum, caveSites);
      return Math.max(3.5, Math.round((cave.hillHeight - gy) * 10) / 10);
    }
    const ang = Math.atan2(z - cave.z, x - cave.x);
    if (cd < cave.radius + 4.5 && normalizeAngleDiff(ang, cave.entranceAngle) < 0.38) {
      const t = 1 - THREE.MathUtils.clamp((cd - (cave.radius - 0.5)) / 5.0, 0, 1);
      return Math.max(0.8, Math.round(t * 5.2 * 10) / 10);
    }
  }
  return 0;
}

export function groundHeightAt(
  x: number,
  z: number,
  seedNum = 42019,
  caveSites?: readonly CaveSite[],
): number {
  const dist = Math.hypot(x, z);
  const islandRadius = islandRadiusAt(x, z, seedNum);
  const edgeFalloff = THREE.MathUtils.smoothstep(dist, islandRadius - 24, islandRadius + 12);

  const ph1 = ((seedNum & 0x3ff) / 1023) * Math.PI * 2;
  const ph2 = (((seedNum >> 10) & 0x3ff) / 1023) * Math.PI * 2;
  const ph3 = (((seedNum >> 20) & 0x3ff) / 1023) * Math.PI * 2;
  const freqScale = 0.88 + (((seedNum >> 7) & 0x1f) / 31) * 0.28;

  const n1 = Math.sin(x * 0.036 * freqScale + ph1) * Math.cos(z * 0.034 * freqScale + ph2) * 2.75;
  const n2 = Math.sin((x + z) * 0.078 * freqScale + ph3) * 1.1;
  const n3 = Math.cos(x * 0.135 - z * 0.11 + ph1) * 0.48;

  // Seeded watchtower bluff
  const bluffX = -20 + Math.sin(ph1) * 12;
  const bluffZ = -26 + Math.cos(ph2) * 12;
  const ridgeDist = Math.hypot(x - bluffX, z - bluffZ);
  const ridge = Math.max(0, 1 - ridgeDist / 26) * 5.2;

  const roadDx = Math.abs(x - roadCenterXAtZ(z, seedNum));
  const roadBlend = 1 - THREE.MathUtils.smoothstep(roadDx, 2.2, 8.5);
  const spawnClear = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - 0, z - 12), 4, 16);

  let h = 3.45 + n1 + n2 + n3 + ridge;
  h = THREE.MathUtils.lerp(h, 2.9, roadBlend * 0.65);
  h = THREE.MathUtils.lerp(h, 2.7, spawnClear * 0.88);
  if (dist < 118) {
    h = Math.max(h, 1.65);
  }

  // Carve procedural winding river channel across the island (keeping caves/spawn clear)
  const riverDx = Math.abs(x - riverCenterAtZ(z, seedNum));
  const riverHalfW = riverHalfWidthAtZ(z, seedNum);
  const riverBankW = riverHalfW + 4.8;
  if (riverDx < riverBankW && dist < islandRadius - 4) {
    const channelT = 1 - THREE.MathUtils.smoothstep(riverDx, riverHalfW * 0.55, riverBankW);
    const spawnProtect = THREE.MathUtils.smoothstep(Math.hypot(x, z - 12), 6, 15);
    const carveFactor = channelT * spawnProtect;
    h = THREE.MathUtils.lerp(h, -0.45, carveFactor);
  }

  h -= edgeFalloff * 11.5;

  // Underground Cave Basins + Descending Sloped Tunnel Ramps
  if (caveSites) {
    for (const cave of caveSites) {
      const cd = Math.hypot(x - cave.x, z - cave.z);
      if (cd >= cave.radius + 9.5) continue;

      const ang = Math.atan2(z - cave.z, x - cave.x);
      const angDiff = normalizeAngleDiff(ang, cave.entranceAngle);
      const inMouthCorridor = angDiff < 0.42;

      if (cd < cave.radius) {
        const innerBlend = 1 - THREE.MathUtils.smoothstep(cd, cave.radius - 2.4, cave.radius);
        h = THREE.MathUtils.lerp(h, cave.floorY, innerBlend * 0.95 + 0.05);
      } else if (inMouthCorridor) {
        // Sloped tunnel ramp descending smoothly from outside surface down to cave.floorY
        const rampT = THREE.MathUtils.smoothstep(cd, cave.radius - 0.5, cave.radius + 8.5);
        const sideT = THREE.MathUtils.smoothstep(angDiff, 0.22, 0.42);
        const targetRampH = THREE.MathUtils.lerp(cave.floorY, h, rampT);
        h = THREE.MathUtils.lerp(targetRampH, h, sideT);
      } else if (cd < cave.radius + 5.5) {
        // Slightly elevate perimeter rock berm around cave hill
        const rimT = 1 - THREE.MathUtils.smoothstep(cd, cave.radius, cave.radius + 5.5);
        h += rimT * 1.4;
      }
    }
  }

  return h;
}

export function isWaterAt(
  x: number,
  z: number,
  seedNum = 42019,
  caveSites?: readonly CaveSite[],
): boolean {
  const gy = groundHeightAt(x, z, seedNum, caveSites);
  if (gy <= 0.14) return true;
  const riverDx = Math.abs(x - riverCenterAtZ(z, seedNum));
  const riverHalfW = riverHalfWidthAtZ(z, seedNum);
  return riverDx <= riverHalfW + 0.8 && gy <= RIVER_WATER_Y + 0.12;
}

export function generateWorld(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
  seedString = 'SLUDGE-42019',
): WorldData {
  const seedNum = hashSeedString(seedString);
  const rng = mulberry32(seedNum);
  const caveSites = computeCaveSites(seedNum);

  const localGroundY = (x: number, z: number) => groundHeightAt(x, z, seedNum, caveSites);
  const localRoadX = (z: number) => roadCenterXAtZ(z, seedNum);

  const root = new THREE.Group();
  root.name = 'WorldRoot';

  // 1. Procedural Island Terrain
  const terrainSize = 360;
  const segs = isSoftwareGl ? 96 : 148;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrassA = new THREE.Color('#4f6a37');
  const cGrassB = new THREE.Color('#637a41');
  const cRoad = new THREE.Color('#8a6b48');
  const cSand = new THREE.Color('#c6b184');
  const cRock = new THREE.Color('#64686d');
  const cCave = new THREE.Color('#21252a');
  const tempC = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = localGroundY(vx, vz);
    pos.setY(i, vy);

    const roadDx = Math.abs(vx - localRoadX(vz));
    const roadMask = (1 - THREE.MathUtils.smoothstep(roadDx, 1.8, 4.4)) * (vy > 1.2 ? 1 : 0);

    const grassNoise = 0.5 + 0.5 * Math.sin(vx * 0.13 + vz * 0.17 + seedNum * 0.01);
    tempC.copy(cGrassA).lerp(cGrassB, grassNoise);

    if (vy < 1.35) {
      const sandT = THREE.MathUtils.clamp((1.35 - vy) / 1.4, 0, 1);
      tempC.lerp(cSand, sandT);
    }
    if (vy > 6.2) {
      const rockT = THREE.MathUtils.clamp((vy - 6.2) / 3.0, 0, 1);
      tempC.lerp(cRock, rockT);
    }
    if (roadMask > 0.01) {
      tempC.lerp(cRoad, roadMask * 0.88);
    }

    for (const cave of caveSites) {
      const cd = Math.hypot(vx - cave.x, vz - cave.z);
      if (cd < cave.radius + 4.0) {
        const ang = Math.atan2(vz - cave.z, vx - cave.x);
        const inRamp = normalizeAngleDiff(ang, cave.entranceAngle) < 0.44;
        const limit = inRamp ? cave.radius + 4.0 : cave.radius + 1.5;
        if (cd < limit) {
          const caveT = 1 - THREE.MathUtils.smoothstep(cd, cave.radius - 2.0, limit);
          tempC.lerp(cCave, caveT * 0.96);
        }
      }
    }

    colors[i * 3] = tempC.r;
    colors[i * 3 + 1] = tempC.g;
    colors[i * 3 + 2] = tempC.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.groundColor,
    bumpMap: textures.groundBump,
    bumpScale: 0.16,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'Terrain';
  root.add(terrainMesh);

  // 2. Surrounding Ocean Plane
  const waterGeo = new THREE.PlaneGeometry(760, 760, 56, 56);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1e4c63,
    roughness: 0.24,
    metalness: 0.18,
    transparent: true,
    opacity: 0.92,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.0;
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x22687e,
    roughness: 0.18,
    metalness: 0.22,
    transparent: true,
    opacity: 0.86,
  });
  const riverPts: number[] = [];
  const riverSteps = 60;
  const riverHalfGrid = 148;
  const riverStepLen = (riverHalfGrid * 2) / riverSteps;
  const riverUvs: number[] = [];
  const riverIndices: number[] = [];
  for (let i = 0; i <= riverSteps; i++) {
    const rz = -riverHalfGrid + i * riverStepLen;
    const rcx = riverCenterAtZ(rz, seedNum);
    const rhw = riverHalfWidthAtZ(rz, seedNum) + 2.2;
    riverPts.push(rcx - rhw, RIVER_WATER_Y, rz);
    riverPts.push(rcx + rhw, RIVER_WATER_Y, rz);
    riverUvs.push(0, i / riverSteps, 1, i / riverSteps);
    if (i < riverSteps) {
      const base = i * 2;
      riverIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPts, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(riverUvs, 2));
  riverGeo.setIndex(riverIndices);
  riverGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.receiveShadow = true;
  riverMesh.name = 'IslandRiver';
  root.add(riverMesh);

  const nodes: WorldNode[] = [];
  const hitMeshes: THREE.Object3D[] = [];
  const lootContainers: LootContainer[] = [];
  const lootHitMeshes: THREE.Object3D[] = [];
  const colliders: Array<{ x: number; z: number; radius: number; height?: number; nodeId?: string }> = [];
  const boxColliders: WorldBoxCollider[] = [];
  const animatedPools: THREE.Mesh[] = [];

  const pushLocalStructureBox = (
    originX: number,
    originY: number,
    originZ: number,
    rotY: number,
    lx: number,
    lz: number,
    halfW: number,
    halfD: number,
    minRelY: number,
    maxRelY: number,
    walkable = false,
    blocksProjectiles = true,
  ) => {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    boxColliders.push({
      cx: originX + lx * c + lz * s,
      cz: originZ - lx * s + lz * c,
      rotY,
      halfW,
      halfD,
      minY: originY + minRelY,
      maxY: originY + maxRelY,
      walkable,
      blocksProjectiles,
    });
  };

  // 3. Landmark A: Weathered Timber Watchtower on Seeded Bluff (avoiding river/caves)
  const ph1 = ((seedNum & 0x3ff) / 1023) * Math.PI * 2;
  const ph2 = (((seedNum >> 10) & 0x3ff) / 1023) * Math.PI * 2;
  let lx = Math.round(-18 + Math.sin(ph1) * 10);
  let lz = Math.round(-25 + Math.cos(ph2) * 10);
  if (Math.abs(lx - riverCenterAtZ(lz, seedNum)) < riverHalfWidthAtZ(lz, seedNum) + 5) {
    lx += lx >= 0 ? 10 : -10;
  }
  const watchtowerRot = 0.25 + rng() * 0.9;
  const watchtowerY = localGroundY(lx, lz);
  const landmark = createWatchtowerLandmark(textures);
  landmark.position.set(lx, watchtowerY, lz);
  landmark.rotation.y = watchtowerRot;
  root.add(landmark);

  // Watchtower posts + elevated deck + rails + roof
  for (const [px, pz] of [
    [-1.4, -1.4],
    [1.4, -1.4],
    [-1.4, 1.4],
    [1.4, 1.4],
  ]) {
    pushLocalStructureBox(lx, watchtowerY, lz, watchtowerRot, px, pz, 0.25, 0.25, 0, 6.1);
  }
  pushLocalStructureBox(lx, watchtowerY, lz, watchtowerRot, 0, 0, 1.75, 1.75, 3.67, 3.93, true);
  for (const rz of [-1.5, 1.5]) {
    pushLocalStructureBox(lx, watchtowerY, lz, watchtowerRot, 0, rz, 1.65, 0.1, 4.65, 4.85);
  }

  // 3b. Landmark B: Roadside Scrap Outpost along dirt road
  const outpostZ = -34 - Math.round(rng() * 14);
  const outpostSide = rng() > 0.5 ? 1 : -1;
  let outpostX = localRoadX(outpostZ) + outpostSide * (6.2 + rng() * 1.8);
  if (Math.abs(outpostX - riverCenterAtZ(outpostZ, seedNum)) < riverHalfWidthAtZ(outpostZ, seedNum) + 4.5) {
    outpostX = localRoadX(outpostZ) - outpostSide * 6.5;
  }
  const outpostRot = -0.5 + rng() * 1.0;
  const outpostY = localGroundY(outpostX, outpostZ);
  const outpost = createRoadsideOutpost(textures);
  outpost.position.set(outpostX, outpostY, outpostZ);
  outpost.rotation.y = outpostRot;
  root.add(outpost);

  // Outpost walkable slab + 4 corner posts + solid back wall + roof
  pushLocalStructureBox(outpostX, outpostY, outpostZ, outpostRot, 0, 0, 2.2, 1.9, -0.2, 0.28, true);
  for (const [px, pz] of [
    [-1.9, -1.6],
    [1.9, -1.6],
    [-1.9, 1.6],
    [1.9, 1.6],
  ]) {
    pushLocalStructureBox(outpostX, outpostY, outpostZ, outpostRot, px, pz, 0.16, 0.16, 0.15, 2.8);
  }
  pushLocalStructureBox(outpostX, outpostY, outpostZ, outpostRot, 0, -1.65, 2.02, 0.14, 0.15, 2.6);
  pushLocalStructureBox(outpostX, outpostY, outpostZ, outpostRot, 0, 0, 2.3, 2.05, 2.75, 3.05, true);

  // Shared materials
  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.barkColor,
    roughness: 0.9,
    metalness: 0.02,
  });
  const needleMatA = new THREE.MeshStandardMaterial({
    color: 0x2d4a28,
    roughness: 0.78,
    metalness: 0.04,
  });
  const needleMatB = new THREE.MeshStandardMaterial({
    color: 0x37592f,
    roughness: 0.75,
    metalness: 0.04,
  });
  const rockBaseMat = new THREE.MeshStandardMaterial({
    color: 0x767b82,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
  });
  const caveRockMat = new THREE.MeshStandardMaterial({
    map: textures.caveRockColor,
    roughness: 0.94,
    metalness: 0.06,
    flatShading: true,
  });
  const mossCapMat = new THREE.MeshStandardMaterial({
    color: 0x3e5530,
    roughness: 0.94,
    flatShading: true,
  });
  const metalOreMat = new THREE.MeshStandardMaterial({
    color: 0x454d59,
    roughness: 0.36,
    metalness: 0.72,
    flatShading: true,
  });
  const sulfurOreMat = new THREE.MeshStandardMaterial({
    color: 0xd1b336,
    roughness: 0.42,
    metalness: 0.15,
    flatShading: true,
  });
  const sludgeOreMat = new THREE.MeshStandardMaterial({
    map: textures.sludgeColor,
    color: 0x4ade80,
    emissive: 0x16a34a,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.1,
  });
  const bushLeafMat = new THREE.MeshStandardMaterial({
    color: 0x3d662e,
    roughness: 0.84,
  });
  const berryMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.38,
    metalness: 0.05,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    map: textures.barrelColor,
    roughness: 0.56,
    metalness: 0.48,
  });
  const crateWoodMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    roughness: 0.78,
    metalness: 0.05,
  });
  const crateIronMat = new THREE.MeshStandardMaterial({
    color: 0x3d4147,
    roughness: 0.35,
    metalness: 0.78,
  });
  const shadowDiscMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  // 4. Construct the 3 Underground Caves + Recessed Descending Tunnels
  for (const cave of caveSites) {
    const caveBuild = buildUndergroundCaveStructure(
      cave,
      caveRockMat,
      mossCapMat,
      sludgeOreMat,
      textures,
      rng,
    );
    root.add(caveBuild.group);
    if (caveBuild.poolMesh) {
      animatedPools.push(caveBuild.poolMesh);
    }
    for (const c of caveBuild.wallColliders) {
      colliders.push(c);
    }
  }

  const isPositionClear = (x: number, z: number, minDist: number, allowInsideCave = false): boolean => {
    if (localGroundY(x, z) < 1.35) return false;
    if (Math.hypot(x, z - 14) < 7.0) return false;
    if (Math.hypot(x - lx, z - lz) < 6.5) return false;
    if (Math.hypot(x - outpostX, z - outpostZ) < 6.0) return false;
    if (!allowInsideCave) {
      for (const cave of caveSites) {
        if (Math.hypot(x - cave.x, z - cave.z) < cave.radius + 7.5) return false;
      }
    }
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.z - z) < minDist) return false;
    }
    return true;
  };

  const registerNode = (
    id: string,
    kind: WorldNodeKind,
    x: number,
    z: number,
    radius: number,
    hp: number,
    group: THREE.Group,
    hitMesh: THREE.Mesh,
  ) => {
    const y = localGroundY(x, z);
    group.position.set(x, y, z);
    root.add(group);
    hitMesh.userData.nodeId = id;
    hitMeshes.push(hitMesh);

    const node: WorldNode = {
      id,
      kind,
      x,
      y,
      z,
      radius,
      hp,
      maxHp: hp,
      alive: true,
      respawnTimer: 0,
      flashTimer: 0,
      shakeTimer: 0,
      group,
      hitMesh,
      baseScale: group.scale.x,
    };
    nodes.push(node);
    if (kind !== 'berry_bush') {
      const colHeight =
        kind === 'barrel' || kind === 'crate' ? 1.38 : kind === 'tree' ? 4.8 : 2.2;
      colliders.push({ x, z, radius, height: colHeight, nodeId: id });
    }
  };

  let idCounter = 1;

  // Guaranteed starter vignette near spawn + roadside trail
  const starterSpecs: Array<{ kind: WorldNodeKind; x: number; z: number }> = [
    { kind: 'tree', x: -7.5, z: 4.5 },
    { kind: 'tree', x: 8.5, z: 6.0 },
    { kind: 'tree', x: -10.0, z: -4.0 },
    { kind: 'stone', x: 6.5, z: 1.5 },
    { kind: 'metal', x: -6.0, z: -0.5 },
    { kind: 'sulfur', x: 11.0, z: -7.5 },
    { kind: 'berry_bush', x: -4.2, z: 9.0 },
    { kind: 'berry_bush', x: 7.2, z: 10.5 },
    { kind: 'barrel', x: localRoadX(3.0) + 2.1, z: 3.0 },
    { kind: 'crate', x: localRoadX(-6.0) - 2.3, z: -6.0 },
    { kind: 'crate', x: outpostX - 1.2, z: outpostZ + 1.8 },
  ];

  for (const spec of starterSpecs) {
    const id = `node_${idCounter++}`;
    if (spec.kind === 'tree') {
      const { group, hitMesh } = buildPineTree(barkMat, needleMatA, shadowDiscMat, 1.0 + rng() * 0.25);
      registerNode(id, 'tree', spec.x, spec.z, 0.72, 100, group, hitMesh);
    } else if (spec.kind === 'berry_bush') {
      const { group, hitMesh } = buildBerryBush(bushLeafMat, berryMat, shadowDiscMat);
      registerNode(id, 'berry_bush', spec.x, spec.z, 0.55, 25, group, hitMesh);
    } else if (spec.kind === 'stone' || spec.kind === 'metal' || spec.kind === 'sulfur' || spec.kind === 'sludge') {
      const { group, hitMesh } = buildOreNode(
        spec.kind,
        rockBaseMat,
        metalOreMat,
        sulfurOreMat,
        sludgeOreMat,
        shadowDiscMat,
        1.0,
      );
      registerNode(id, spec.kind, spec.x, spec.z, 1.15, 110, group, hitMesh);
    } else if (spec.kind === 'barrel') {
      const { group, hitMesh } = buildLootBarrel(barrelMat, crateIronMat, shadowDiscMat);
      registerNode(id, 'barrel', spec.x, spec.z, 0.65, 50, group, hitMesh);
    } else {
      const { group, hitMesh } = buildSupplyCrate(crateWoodMat, crateIronMat, shadowDiscMat);
      registerNode(id, 'crate', spec.x, spec.z, 0.75, 45, group, hitMesh);
    }
  }

  // Deep Underground Cave Interior Nodes
  for (const cave of caveSites) {
    const isSludgeGrotto = cave.id === 'sludge_grotto';
    const isSulfur = cave.id === 'sulfur_shaft';
    const interiorSpecs: Array<{ kind: 'metal' | 'sulfur' | 'sludge' | 'crate'; offsetAngle: number; dist: number }> = [
      { kind: isSludgeGrotto ? 'sludge' : isSulfur ? 'sulfur' : 'metal', offsetAngle: cave.entranceAngle + Math.PI * 0.62, dist: 5.8 },
      { kind: isSludgeGrotto ? 'sludge' : isSulfur ? 'sulfur' : 'metal', offsetAngle: cave.entranceAngle - Math.PI * 0.62, dist: 6.0 },
      { kind: isSulfur ? 'metal' : 'sulfur', offsetAngle: cave.entranceAngle + Math.PI * 0.92, dist: 6.4 },
      { kind: 'sludge', offsetAngle: cave.entranceAngle + Math.PI * 1.18, dist: 5.2 },
      { kind: 'crate', offsetAngle: cave.entranceAngle - Math.PI * 0.95, dist: 5.4 },
    ];
    for (const sp of interiorSpecs) {
      const nx = cave.x + Math.cos(sp.offsetAngle) * sp.dist;
      const nz = cave.z + Math.sin(sp.offsetAngle) * sp.dist;
      const id = `node_${idCounter++}`;
      if (sp.kind === 'crate') {
        const { group, hitMesh } = buildSupplyCrate(crateWoodMat, crateIronMat, shadowDiscMat);
        registerNode(id, 'crate', nx, nz, 0.72, 45, group, hitMesh);
      } else {
        const { group, hitMesh } = buildOreNode(
          sp.kind,
          rockBaseMat,
          metalOreMat,
          sulfurOreMat,
          sludgeOreMat,
          shadowDiscMat,
          0.95,
        );
        registerNode(id, sp.kind, nx, nz, 1.0, 120, group, hitMesh);
      }
    }
  }

  // Procedural Pine Forest (92 trees across expanded island)
  for (let attempt = 0; attempt < 460 && nodes.filter((n) => n.kind === 'tree').length < 92; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = 12 + rng() * 124;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x - localRoadX(z)) < 5.5) continue;
    if (!isPositionClear(x, z, 5.0)) continue;
    const id = `node_${idCounter++}`;
    const scale = 0.85 + rng() * 0.45;
    const { group, hitMesh } = buildPineTree(
      barkMat,
      rng() > 0.5 ? needleMatA : needleMatB,
      shadowDiscMat,
      scale,
    );
    group.rotation.y = rng() * Math.PI * 2;
    registerNode(id, 'tree', x, z, 0.7 * scale, 100, group, hitMesh);
  }

  // Procedural Stone / Metal / Sulfur / Surface Sludge Nodes (64 nodes)
  const oreKinds: Array<'stone' | 'metal' | 'sulfur' | 'sludge'> = [
    'stone',
    'stone',
    'metal',
    'metal',
    'sulfur',
    'sludge',
  ];
  for (
    let attempt = 0;
    attempt < 340 &&
    nodes.filter((n) => n.kind === 'stone' || n.kind === 'metal' || n.kind === 'sulfur' || n.kind === 'sludge').length < 64;
    attempt++
  ) {
    const angle = rng() * Math.PI * 2;
    const dist = 14 + rng() * 118;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x - localRoadX(z)) < 4.5) continue;
    if (!isPositionClear(x, z, 5.2)) continue;
    const kind = oreKinds[Math.floor(rng() * oreKinds.length)];
    const id = `node_${idCounter++}`;
    const scale = 0.88 + rng() * 0.3;
    const { group, hitMesh } = buildOreNode(
      kind,
      rockBaseMat,
      metalOreMat,
      sulfurOreMat,
      sludgeOreMat,
      shadowDiscMat,
      scale,
    );
    group.rotation.y = rng() * Math.PI * 2;
    registerNode(id, kind, x, z, 1.15 * scale, 110, group, hitMesh);
  }

  // Wild Berry Bushes (24 bushes)
  for (let attempt = 0; attempt < 140 && nodes.filter((n) => n.kind === 'berry_bush').length < 24; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = 10 + rng() * 108;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (!isPositionClear(x, z, 3.8)) continue;
    const id = `node_${idCounter++}`;
    const { group, hitMesh } = buildBerryBush(bushLeafMat, berryMat, shadowDiscMat);
    group.rotation.y = rng() * Math.PI * 2;
    registerNode(id, 'berry_bush', x, z, 0.52, 25, group, hitMesh);
  }

  // Loot Barrels & Supply Crates along the dirt road
  for (let z = -115; z <= 115; z += 11) {
    if (Math.abs(z - 12) < 6) continue;
    const side = z % 22 === 0 ? 1 : -1;
    const x = localRoadX(z) + side * (2.2 + rng() * 1.4);
    if (!isPositionClear(x, z, 3.0)) continue;
    const id = `node_${idCounter++}`;
    if (rng() > 0.35) {
      const { group, hitMesh } = buildLootBarrel(barrelMat, crateIronMat, shadowDiscMat);
      group.rotation.y = rng() * Math.PI * 2;
      registerNode(id, 'barrel', x, z, 0.62, 50, group, hitMesh);
    } else {
      const { group, hitMesh } = buildSupplyCrate(crateWoodMat, crateIronMat, shadowDiscMat);
      group.rotation.y = rng() * Math.PI * 2;
      registerNode(id, 'crate', x, z, 0.72, 45, group, hitMesh);
    }
  }

  // 5. Procedural Lootable Structures (4 unique ruins/stations with interactive Supply Lockers)
  const lootDefs: Array<{
    kind: 'fuel_depot' | 'bunker' | 'relay_shack' | 'boathouse';
    title: string;
    angle: number;
    dist: number;
  }> = [
    { kind: 'fuel_depot', title: 'Fuel Station Locker', angle: 0.55 + rng() * 0.4, dist: 48 + rng() * 16 },
    { kind: 'bunker', title: 'Ranger Bunker Cache', angle: 2.15 + rng() * 0.4, dist: 62 + rng() * 20 },
    { kind: 'relay_shack', title: 'Relay Outpost Locker', angle: 3.75 + rng() * 0.4, dist: 70 + rng() * 18 },
    { kind: 'boathouse', title: 'Boathouse Dock Crate', angle: 5.2 + rng() * 0.4, dist: 96 + rng() * 14 },
  ];

  lootDefs.forEach((def, idx) => {
    let sx = Math.cos(def.angle) * def.dist;
    let sz = Math.sin(def.angle) * def.dist;
    // Nudge out of river or caves
    if (Math.abs(sx - riverCenterAtZ(sz, seedNum)) < riverHalfWidthAtZ(sz, seedNum) + 7) {
      sx += sx >= 0 ? 11 : -11;
    }
    for (const cave of caveSites) {
      if (Math.hypot(sx - cave.x, sz - cave.z) < cave.radius + 9) {
        sx += 16;
      }
    }
    const sy = Math.max(1.25, localGroundY(sx, sz));
    const rotY = rng() * Math.PI * 2;
    const built = buildLootableStructure(def.kind, textures, crateIronMat, crateWoodMat);
    built.group.position.set(sx, sy, sz);
    built.group.rotation.y = rotY;
    root.add(built.group);

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    for (const box of built.localBoxes) {
      pushLocalStructureBox(
        sx,
        sy,
        sz,
        rotY,
        box.lx,
        box.lz,
        box.halfW,
        box.halfD,
        box.minY,
        box.maxY,
        box.walkable,
        box.blocksProjectiles,
      );
    }

    const lootId = `loot_struct_${idx}`;
    const lockerWorldX = sx + built.lockerLocal.x * cos + built.lockerLocal.z * sin;
    const lockerWorldZ = sz - built.lockerLocal.x * sin + built.lockerLocal.z * cos;
    built.hitMesh.userData.lootId = lootId;
    lootHitMeshes.push(built.hitMesh);
    lootContainers.push({
      id: lootId,
      structureIndex: idx,
      name: def.title,
      x: lockerWorldX,
      y: sy + built.lockerLocal.y,
      z: lockerWorldZ,
      opened: false,
      group: built.lockerGroup,
      hitMesh: built.hitMesh,
      lidMesh: built.lidMesh,
      beaconMesh: built.beaconMesh,
    });
  });

  // Coastal rock outcrops with solid physics colliders
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rng() * 0.18;
    const coastR = islandRadiusAt(Math.cos(a) * 145, Math.sin(a) * 145, seedNum);
    const r = coastR - 14 + rng() * 14;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const ry = localGroundY(rx, rz);
    const rockScale = 3.0 + rng() * 2.1;
    const outcrop = new THREE.Group();
    const m1 = new THREE.Mesh(new THREE.DodecahedronGeometry(rockScale, 0), rockBaseMat);
    m1.scale.set(1.25, 0.85, 1.1);
    m1.position.y = 1.1;
    const m2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.0 + rng() * 1.3, 0), rockBaseMat);
    m2.position.set(1.7, 0.8, 1.0);
    const m3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), rockBaseMat);
    m3.position.set(-1.4, 0.6, -1.1);
    outcrop.add(m1, m2, m3);
    outcrop.position.set(rx, ry - 0.3, rz);
    outcrop.rotation.y = rng() * Math.PI;
    root.add(outcrop);

    colliders.push({
      x: rx,
      z: rz,
      radius: rockScale * 0.92,
      height: 3.4,
    });
  }

  const markLootOpened = (lootId: string) => {
    const container = lootContainers.find((c) => c.id === lootId);
    if (!container || container.opened) return;
    container.opened = true;
    container.lidMesh.rotation.x = -0.85;
    container.lidMesh.position.y += 0.14;
    container.lidMesh.position.z -= 0.12;
    (container.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(0x4b5563);
  };

  return {
    seedString,
    seedNum,
    root,
    terrainMesh,
    waterMesh,
    riverMesh,
    nodes,
    hitMeshes,
    lootContainers,
    lootHitMeshes,
    markLootOpened,
    colliders,
    boxColliders,
    caveSites,
    isInsideCave: (x, z) => isInsideCaveAt(x, z, caveSites),
    getCaveDepthAt: (x, z) => getCaveDepthAt(x, z, caveSites, seedNum),
    groundHeightAt: localGroundY,
    roadCenterXAtZ: localRoadX,
    isWaterAt: (x, z) => isWaterAt(x, z, seedNum, caveSites),
    update: (dt: number, elapsed: number) => {
      waterMesh.position.y = Math.sin(elapsed * 0.9) * 0.06;
      riverMesh.position.y = Math.sin(elapsed * 1.6) * 0.02;

      for (let i = 0; i < animatedPools.length; i++) {
        const pool = animatedPools[i];
        pool.position.y = 0.07 + Math.sin(elapsed * 1.8 + i) * 0.025;
      }

      for (let i = 0; i < lootContainers.length; i++) {
        const lc = lootContainers[i];
        if (!lc.opened) {
          lc.beaconMesh.position.y = 0.98 + Math.sin(elapsed * 3.5 + i) * 0.05;
          lc.beaconMesh.rotation.y = elapsed * 1.8;
        }
      }

      for (const node of nodes) {
        if (!node.alive) {
          node.respawnTimer -= dt;
          if (node.respawnTimer <= 0) {
            node.alive = true;
            node.hp = node.maxHp;
            node.group.visible = true;
            node.group.scale.setScalar(node.baseScale);
          }
          continue;
        }
        if (node.shakeTimer > 0) {
          node.shakeTimer = Math.max(0, node.shakeTimer - dt);
          const s = node.shakeTimer * 18;
          node.group.rotation.z = Math.sin(elapsed * 55) * 0.05 * Math.min(1, s);
        } else {
          node.group.rotation.z = 0;
        }
        if (node.flashTimer > 0) {
          node.flashTimer = Math.max(0, node.flashTimer - dt);
        }
      }
    },
  };
}

function buildUndergroundCaveStructure(
  cave: CaveSite,
  rockMat: THREE.Material,
  mossCapMat: THREE.Material,
  sludgeMat: THREE.Material,
  textures: ProceduralTextureSet,
  rng: () => number,
): {
  group: THREE.Group;
  wallColliders: Array<{ x: number; z: number; radius: number }>;
  poolMesh: THREE.Mesh | null;
} {
  const group = new THREE.Group();
  group.position.set(cave.x, cave.floorY, cave.z);
  const wallColliders: Array<{ x: number; z: number; radius: number }> = [];

  // Cavern basalt perimeter walls leaving a recessed tunnel entrance
  const segments = 20;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const diff = normalizeAngleDiff(a, cave.entranceAngle);
    if (diff < 0.36) continue;

    const dist = cave.radius - 0.5 + (rng() - 0.5) * 0.6;
    const wx = Math.cos(a) * dist;
    const wz = Math.sin(a) * dist;

    const pillar = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3.4 + rng() * 0.85, 0),
      rockMat,
    );
    pillar.position.set(wx, 2.8, wz);
    pillar.scale.set(1.25, 1.75, 1.25);
    pillar.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);

    // Outer rocky hillside slope mound sealing the underground chamber
    const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(4.8, 0), rockMat);
    mound.position.set(
      Math.cos(a) * (cave.radius + 2.6),
      2.3,
      Math.sin(a) * (cave.radius + 2.6),
    );
    mound.scale.set(1.45, 1.15, 1.45);
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);

    wallColliders.push({
      x: cave.x + wx,
      z: cave.z + wz,
      radius: 2.55,
    });
  }

  // Tunnel entrance rock walls flanking the descending ramp
  for (const side of [-1, 1]) {
    const sideA = cave.entranceAngle + side * 0.42;
    for (let step = 0; step < 3; step++) {
      const rDist = cave.radius + 1.4 + step * 2.1;
      const tx = Math.cos(sideA) * rDist;
      const tz = Math.sin(sideA) * rDist;
      const wall = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), rockMat);
      wall.position.set(tx, 2.2 + step * 0.5, tz);
      wall.scale.set(1.15, 1.35, 1.15);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      wallColliders.push({ x: cave.x + tx, z: cave.z + tz, radius: 1.75 });
    }
  }

  // Deep tunnel entrance arch + overhead rock hillside cap
  const archSpan = cave.radius + 1.0;
  const lintelX = Math.cos(cave.entranceAngle) * archSpan;
  const lintelZ = Math.sin(cave.entranceAngle) * archSpan;

  const archBeam = new THREE.Mesh(new THREE.DodecahedronGeometry(4.2, 0), rockMat);
  archBeam.position.set(lintelX, 5.1, lintelZ);
  archBeam.scale.set(1.75, 0.72, 1.75);
  archBeam.castShadow = true;
  group.add(archBeam);

  // Subterranean rock ceiling & outer moss-topped hill dome above the chamber
  const ceilingSlab = new THREE.Mesh(new THREE.DodecahedronGeometry(cave.radius * 0.92, 1), rockMat);
  ceilingSlab.position.set(0, 6.9, 0);
  ceilingSlab.scale.set(1.26, 0.46, 1.26);
  ceilingSlab.castShadow = true;
  ceilingSlab.receiveShadow = true;
  group.add(ceilingSlab);

  const hillCap = new THREE.Mesh(new THREE.DodecahedronGeometry(cave.radius * 0.88, 1), mossCapMat);
  hillCap.position.set(0, 7.65, 0);
  hillCap.scale.set(1.18, 0.36, 1.18);
  hillCap.receiveShadow = true;
  group.add(hillCap);

  // Hanging stalactites inside underground cavern
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = 2.8 + (i % 2) * 3.0;
    const stalactite = new THREE.Mesh(new THREE.ConeGeometry(0.45 + rng() * 0.35, 2.3, 6), rockMat);
    stalactite.rotation.x = Math.PI;
    stalactite.position.set(Math.cos(a) * rad, 5.25, Math.sin(a) * rad);
    group.add(stalactite);
  }

  // Torch / Beacon marker outside tunnel mouth
  const markerAngle = cave.entranceAngle - 0.36;
  const mx = Math.cos(markerAngle) * (cave.radius + 4.8);
  const mz = Math.sin(markerAngle) * (cave.radius + 4.8);
  const postMat = new THREE.MeshStandardMaterial({ map: textures.barkColor, roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 7), postMat);
  post.position.set(mx, 2.6, mz);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: cave.id === 'sludge_grotto' ? 0x4ade80 : cave.id === 'sulfur_shaft' ? 0xfacc15 : 0xfbbf24,
  });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), beaconMat);
  beacon.position.set(mx, 3.95, mz);
  group.add(post, beacon);

  // Glowing underground Bio-Sludge pool
  const poolRadius = cave.id === 'sludge_grotto' ? 3.2 : 1.9;
  const poolRim = new THREE.Mesh(new THREE.TorusGeometry(poolRadius, 0.34, 7, 16), rockMat);
  poolRim.rotation.x = Math.PI / 2;
  poolRim.position.set(0, 0.05, 0);
  group.add(poolRim);

  const poolMesh = new THREE.Mesh(new THREE.CircleGeometry(poolRadius, 18), sludgeMat);
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.set(0, 0.08, 0);
  group.add(poolMesh);

  // Subtle cavern ambient point light near pool
  const caveLight = new THREE.PointLight(
    cave.id === 'sludge_grotto' ? 0x4ade80 : cave.id === 'sulfur_shaft' ? 0xfacc15 : 0xf59e0b,
    3.4,
    18,
    1.5,
  );
  caveLight.position.set(0, 3.2, 0);
  group.add(caveLight);

  return { group, wallColliders, poolMesh };
}

function buildPineTree(
  barkMat: THREE.Material,
  needleMat: THREE.Material,
  shadowMat: THREE.Material,
  scale: number,
): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.65, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const roots = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 0.7, 7), barkMat);
  roots.position.y = 0.35;
  roots.castShadow = true;
  roots.receiveShadow = true;
  group.add(roots);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 4.4, 8), barkMat);
  trunk.position.y = 2.2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.85, 2.7, 9), needleMat);
  c1.position.y = 3.4;
  c1.castShadow = true;
  c1.receiveShadow = true;

  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.4, 9), needleMat);
  c2.position.y = 4.9;
  c2.rotation.y = 0.35;
  c2.castShadow = true;

  const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.0, 8), needleMat);
  c3.position.y = 6.2;
  c3.rotation.y = 0.7;
  c3.castShadow = true;

  group.add(c1, c2, c3);
  group.scale.setScalar(scale);

  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.75, 4.5, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 2.25;
  group.add(hitProxy);

  return { group, hitMesh: hitProxy };
}

function buildOreNode(
  kind: 'stone' | 'metal' | 'sulfur' | 'sludge',
  rockMat: THREE.Material,
  metalMat: THREE.Material,
  sulfurMat: THREE.Material,
  sludgeMat: THREE.Material,
  shadowMat: THREE.Material,
  scale: number,
): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.45, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const primary = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), rockMat);
  primary.position.set(0, 0.65, 0);
  primary.scale.set(1.2, 0.9, 1.1);
  primary.castShadow = true;
  primary.receiveShadow = true;
  group.add(primary);

  const sideA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rockMat);
  sideA.position.set(0.65, 0.45, 0.35);
  sideA.rotation.set(0.3, 0.8, 0.2);
  sideA.castShadow = true;
  group.add(sideA);

  const sideB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), rockMat);
  sideB.position.set(-0.62, 0.38, -0.28);
  sideB.rotation.set(-0.2, 0.4, 0.5);
  sideB.castShadow = true;
  group.add(sideB);

  const veinMat =
    kind === 'metal'
      ? metalMat
      : kind === 'sulfur'
        ? sulfurMat
        : kind === 'sludge'
          ? sludgeMat
          : rockMat;
  const vein1 = new THREE.Mesh(new THREE.OctahedronGeometry(kind === 'sludge' ? 0.46 : 0.38, 0), veinMat);
  vein1.position.set(0.25, 0.98, 0.42);
  vein1.rotation.set(0.4, 0.3, 0.6);
  const vein2 = new THREE.Mesh(new THREE.OctahedronGeometry(kind === 'sludge' ? 0.4 : 0.32, 0), veinMat);
  vein2.position.set(-0.35, 0.84, 0.25);
  vein2.rotation.set(0.1, 0.9, -0.3);
  group.add(vein1, vein2);

  if (kind === 'sludge') {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 6), sludgeMat);
    spire.position.set(0, 1.28, -0.1);
    spire.rotation.x = 0.2;
    group.add(spire);
  }

  group.scale.setScalar(scale);

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 0.7;
  group.add(hitProxy);

  return { group, hitMesh: hitProxy };
}

function buildBerryBush(
  leafMat: THREE.Material,
  berryMat: THREE.Material,
  shadowMat: THREE.Material,
): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), leafMat);
  c1.position.set(0, 0.42, 0);
  c1.scale.set(1.2, 0.9, 1.15);
  c1.castShadow = true;
  const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), leafMat);
  c2.position.set(0.36, 0.34, 0.22);
  const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), leafMat);
  c3.position.set(-0.34, 0.32, -0.18);
  group.add(c1, c2, c3);

  const berryOffsets = [
    [0.2, 0.65, 0.42],
    [-0.22, 0.58, 0.35],
    [0.44, 0.46, 0.1],
    [-0.4, 0.42, -0.25],
    [0.05, 0.72, -0.28],
  ];
  for (const [bx, by, bz] of berryOffsets) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), berryMat);
    b.position.set(bx, by, bz);
    group.add(b);
  }

  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 0.45;
  group.add(hitProxy);

  return { group, hitMesh: hitProxy };
}

function buildLootBarrel(
  barrelMat: THREE.Material,
  rimMat: THREE.Material,
  shadowMat: THREE.Material,
): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.12, 14), barrelMat);
  body.position.y = 0.56;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 16), rimMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 1.1;

  const rimMid = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 8, 16), rimMat);
  rimMid.rotation.x = Math.PI / 2;
  rimMid.position.y = 0.56;

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), rimMat);
  cap.position.set(0.2, 1.13, 0.12);
  group.add(rimTop, rimMid, cap);

  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.25, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 0.62;
  group.add(hitProxy);

  return { group, hitMesh: hitProxy };
}

function buildSupplyCrate(
  woodMat: THREE.Material,
  ironMat: THREE.Material,
  shadowMat: THREE.Material,
): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.76, 0.95), woodMat);
  base.position.y = 0.38;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.14, 1.02), woodMat);
  lid.position.y = 0.82;
  lid.castShadow = true;
  group.add(lid);

  const strap1 = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.1), ironMat);
  strap1.position.set(0, 0.45, 0.44);
  const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.08), ironMat);
  strap2.position.set(0, 0.72, 0.51);
  group.add(strap1, strap2);

  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.0, 1.15),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 0.5;
  group.add(hitProxy);

  return { group, hitMesh: hitProxy };
}

function createWatchtowerLandmark(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    map: textures.barkColor,
    roughness: 0.9,
    metalness: 0.02,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.05,
    roughness: 0.82,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x45494e,
    roughness: 0.4,
    metalness: 0.7,
  });

  const postGeo = new THREE.CylinderGeometry(0.18, 0.24, 6.2, 8);
  const offsets = [
    [-1.4, -1.4],
    [1.4, -1.4],
    [-1.4, 1.4],
    [1.4, 1.4],
  ];
  for (const [px, pz] of offsets) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, 3.0, pz);
    post.castShadow = true;
    post.receiveShadow = true;
    g.add(post);
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 3.5), deckMat);
  deck.position.y = 3.8;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  const railGeo = new THREE.BoxGeometry(3.3, 0.14, 0.14);
  for (const rz of [-1.5, 1.5]) {
    const rail = new THREE.Mesh(railGeo, deckMat);
    rail.position.set(0, 4.75, rz);
    g.add(rail);
  }

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.4, 4), ironMat);
  roof.position.y = 6.5;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), ironMat);
  mast.position.y = 7.6;
  g.add(mast);

  return g;
}

function createRoadsideOutpost(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    roughness: 0.85,
  });
  const scrapMat = new THREE.MeshStandardMaterial({
    color: 0x5d4436,
    roughness: 0.58,
    metalness: 0.55,
  });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 3.8), scrapMat);
  slab.position.y = 0.14;
  slab.receiveShadow = true;
  g.add(slab);

  for (const [px, pz] of [
    [-1.9, -1.6],
    [1.9, -1.6],
    [-1.9, 1.6],
    [1.9, 1.6],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 7), timberMat);
    post.position.set(px, 1.4, pz);
    post.castShadow = true;
    g.add(post);
  }

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.4, 0.14), scrapMat);
  backWall.position.set(0, 1.35, -1.65);
  backWall.castShadow = true;
  g.add(backWall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 4.1), scrapMat);
  roof.position.set(0, 2.85, 0);
  roof.rotation.x = 0.12;
  roof.castShadow = true;
  g.add(roof);

  return g;
}

interface LocalStructureBox {
  lx: number;
  lz: number;
  halfW: number;
  halfD: number;
  minY: number;
  maxY: number;
  walkable?: boolean;
  blocksProjectiles?: boolean;
}

function buildLootableStructure(
  kind: 'fuel_depot' | 'bunker' | 'relay_shack' | 'boathouse',
  textures: ProceduralTextureSet,
  ironMat: THREE.Material,
  woodMat: THREE.Material,
): {
  group: THREE.Group;
  lockerGroup: THREE.Group;
  hitMesh: THREE.Mesh;
  lidMesh: THREE.Mesh;
  beaconMesh: THREE.Mesh;
  lockerLocal: THREE.Vector3;
  localBoxes: LocalStructureBox[];
} {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    color: 0x72777d,
    roughness: 0.9,
  });
  const rustSheetMat = new THREE.MeshStandardMaterial({
    color: kind === 'fuel_depot' ? 0x991b1b : kind === 'relay_shack' ? 0x334155 : 0x5d4436,
    roughness: 0.62,
    metalness: 0.48,
  });
  const localBoxes: LocalStructureBox[] = [];

  const slab = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.34, 5.2), concreteMat);
  slab.position.y = 0.17;
  slab.receiveShadow = true;
  group.add(slab);
  localBoxes.push({ lx: 0, lz: 0, halfW: 2.9, halfD: 2.6, minY: -0.35, maxY: 0.34, walkable: true });

  if (kind === 'fuel_depot') {
    for (const [px, pz] of [
      [-2.3, -2.0],
      [2.3, -2.0],
      [-2.3, 2.0],
      [2.3, 2.0],
    ]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 8), ironMat);
      col.position.set(px, 1.6, pz);
      col.castShadow = true;
      group.add(col);
      localBoxes.push({ lx: px, lz: pz, halfW: 0.22, halfD: 0.22, minY: 0.2, maxY: 3.2 });
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 4.8), rustSheetMat);
    canopy.position.y = 3.3;
    canopy.castShadow = true;
    localBoxes.push({ lx: 0, lz: 0, halfW: 2.8, halfD: 2.4, minY: 3.16, maxY: 3.44, walkable: true });
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.45, 0.55), rustSheetMat);
    pump.position.set(-1.3, 0.9, 0.3);
    localBoxes.push({ lx: -1.3, lz: 0.3, halfW: 0.4, halfD: 0.3, minY: 0.25, maxY: 1.65 });
    group.add(canopy, pump);
  } else if (kind === 'bunker') {
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 0.45), concreteMat);
    backWall.position.set(0, 1.45, -2.2);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 4.6), concreteMat);
    leftWall.position.set(-2.4, 1.45, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 4.6), concreteMat);
    rightWall.position.set(2.4, 1.45, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.38, 5.0), concreteMat);
    roof.position.set(0, 2.85, 0);
    roof.castShadow = true;
    group.add(backWall, leftWall, rightWall, roof);
    localBoxes.push({ lx: 0, lz: -2.2, halfW: 2.62, halfD: 0.25, minY: 0.15, maxY: 2.75 });
    localBoxes.push({ lx: -2.4, lz: 0, halfW: 0.25, halfD: 2.32, minY: 0.15, maxY: 2.75 });
    localBoxes.push({ lx: 2.4, lz: 0, halfW: 0.25, halfD: 2.32, minY: 0.15, maxY: 2.75 });
    localBoxes.push({ lx: 0, lz: 0, halfW: 2.8, halfD: 2.5, minY: 2.66, maxY: 3.04, walkable: true });
  } else if (kind === 'relay_shack') {
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.7, 0.2), rustSheetMat);
    backWall.position.set(0, 1.5, -2.1);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.7, 4.2), rustSheetMat);
    sideL.position.set(-2.3, 1.5, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 4.6), rustSheetMat);
    roof.position.set(0, 2.9, 0);
    roof.rotation.z = -0.08;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 4.2, 6), ironMat);
    mast.position.set(-1.6, 5.0, -1.6);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 10), ironMat);
    dish.position.set(-1.5, 6.7, -1.5);
    dish.rotation.x = 0.8;
    group.add(backWall, sideL, roof, mast, dish);
    localBoxes.push({ lx: 0, lz: -2.1, halfW: 2.42, halfD: 0.16, minY: 0.15, maxY: 2.85 });
    localBoxes.push({ lx: -2.3, lz: 0, halfW: 0.16, halfD: 2.12, minY: 0.15, maxY: 2.85 });
    localBoxes.push({ lx: 0, lz: 0, halfW: 2.6, halfD: 2.3, minY: 2.75, maxY: 3.05, walkable: true });
  } else {
    // Boathouse Dock
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.25, 6.2), woodMat);
    deck.position.set(0, 0.45, 0.4);
    localBoxes.push({ lx: 0, lz: 0.4, halfW: 2.8, halfD: 3.1, minY: 0.2, maxY: 0.575, walkable: true });
    for (const [px, pz] of [
      [-2.2, -1.8],
      [2.2, -1.8],
      [-2.2, 1.8],
      [2.2, 1.8],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.0, 7), woodMat);
      post.position.set(px, 1.55, pz);
      group.add(post);
      localBoxes.push({ lx: px, lz: pz, halfW: 0.2, halfD: 0.2, minY: 0.4, maxY: 3.05 });
    }
    const gable = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.6, 4), rustSheetMat);
    gable.position.set(0, 3.6, 0);
    gable.rotation.y = Math.PI / 4;
    localBoxes.push({ lx: 0, lz: 0, halfW: 2.6, halfD: 2.6, minY: 2.85, maxY: 4.3, walkable: false });
    group.add(deck, gable);
  }

  // Interactive Supply Locker inside the structure (rests cleanly on deck/slab + solid box collider)
  const lockerY = kind === 'boathouse' ? 0.575 : 0.34;
  const lockerLocal = new THREE.Vector3(0.75, lockerY, -0.95);
  const lockerGroup = new THREE.Group();
  lockerGroup.position.copy(lockerLocal);

  const lockerBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.74), ironMat);
  lockerBody.position.y = 0.36;
  lockerBody.castShadow = true;

  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.76), rustSheetMat);
  lidMesh.position.y = 0.78;

  const beaconMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
  );
  beaconMesh.position.y = 1.02;

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.25, 1.15),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitMesh.position.y = 0.55;

  lockerGroup.add(lockerBody, lidMesh, beaconMesh, hitMesh);
  group.add(lockerGroup);

  localBoxes.push({
    lx: 0.75,
    lz: -0.95,
    halfW: 0.6,
    halfD: 0.39,
    minY: lockerY,
    maxY: lockerY + 0.85,
    walkable: true,
  });

  return { group, lockerGroup, hitMesh, lidMesh, beaconMesh, lockerLocal, localBoxes };
}
