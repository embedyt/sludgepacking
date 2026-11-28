import * as THREE from 'three';

export interface ProceduralTextureSet {
  groundColor: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  barkColor: THREE.CanvasTexture;
  rockColor: THREE.CanvasTexture;
  caveRockColor: THREE.CanvasTexture;
  sludgeColor: THREE.CanvasTexture;
  twigColor: THREE.CanvasTexture;
  twigBump: THREE.CanvasTexture;
  woodColor: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  stoneColor: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  barrelColor: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Deterministic pseudo-random helper for crisp procedural grain
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Ground grass/soil detail tile
  const [gCanvas, gCtx] = makeCanvas(512);
  const [gbCanvas, gbCtx] = makeCanvas(512);
  gCtx.fillStyle = '#586d41';
  gCtx.fillRect(0, 0, 512, 512);
  gbCtx.fillStyle = '#808080';
  gbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = hash2(i, 1) * 512;
    const y = hash2(i, 2) * 512;
    const r = 1.5 + hash2(i, 3) * 4.5;
    const shade = hash2(i, 4);
    gCtx.fillStyle =
      shade > 0.65
        ? 'rgba(110, 134, 78, 0.35)'
        : shade > 0.3
          ? 'rgba(74, 93, 52, 0.35)'
          : 'rgba(98, 86, 62, 0.3)';
    gCtx.fillRect(x, y, r, r * 1.3);

    const bVal = Math.floor(105 + shade * 60);
    gbCtx.fillStyle = `rgba(${bVal},${bVal},${bVal},0.35)`;
    gbCtx.fillRect(x, y, r, r);
  }

  // 1b. Natural mottled granite rock
  const [rkCanvas, rkCtx] = makeCanvas(256);
  rkCtx.fillStyle = '#787d84';
  rkCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = hash2(i, 51) * 256;
    const y = hash2(i, 52) * 256;
    const w = 2 + hash2(i, 53) * 8;
    const s = hash2(i, 54);
    rkCtx.fillStyle =
      s > 0.6
        ? 'rgba(162,168,176,0.38)'
        : s > 0.25
          ? 'rgba(90,95,102,0.4)'
          : 'rgba(65,68,74,0.35)';
    rkCtx.fillRect(x, y, w, w * 0.8);
  }

  // 1c. Dark damp cave basalt rock
  const [cvCanvas, cvCtx] = makeCanvas(256);
  cvCtx.fillStyle = '#31363d';
  cvCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    const x = hash2(i, 61) * 256;
    const y = hash2(i, 62) * 256;
    const w = 2 + hash2(i, 63) * 9;
    const s = hash2(i, 64);
    cvCtx.fillStyle =
      s > 0.72
        ? 'rgba(74, 94, 82, 0.3)'
        : s > 0.35
          ? 'rgba(35, 39, 46, 0.5)'
          : 'rgba(65, 70, 78, 0.35)';
    cvCtx.fillRect(x, y, w, w * 0.9);
  }

  // 1d. Luminescent Bio-Sludge swirl
  const [slCanvas, slCtx] = makeCanvas(256);
  slCtx.fillStyle = '#153d1f';
  slCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 950; i++) {
    const x = hash2(i, 71) * 256;
    const y = hash2(i, 72) * 256;
    const rad = 3 + hash2(i, 73) * 10;
    const s = hash2(i, 74);
    slCtx.fillStyle =
      s > 0.7
        ? 'rgba(134, 239, 172, 0.45)'
        : s > 0.35
          ? 'rgba(34, 197, 94, 0.45)'
          : 'rgba(20, 83, 45, 0.45)';
    slCtx.beginPath();
    slCtx.arc(x, y, rad, 0, Math.PI * 2);
    slCtx.fill();
  }

  // 2. Pine Bark
  const [bCanvas, bCtx] = makeCanvas(256);
  bCtx.fillStyle = '#4a3525';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 180; i++) {
    const x = hash2(i, 11) * 256;
    const w = 3 + hash2(i, 12) * 7;
    bCtx.fillStyle = hash2(i, 13) > 0.5 ? '#362519' : '#5f4430';
    bCtx.fillRect(x, 0, w, 256);
  }
  for (let i = 0; i < 240; i++) {
    const x = hash2(i, 14) * 256;
    const y = hash2(i, 15) * 256;
    bCtx.fillStyle = '#291c12';
    bCtx.fillRect(x, y, 4, 14);
  }

  // 3. Twig Tier (woven branches & sticks)
  const [twCanvas, twCtx] = makeCanvas(256);
  const [twbCanvas, twbCtx] = makeCanvas(256);
  twCtx.fillStyle = '#755638';
  twCtx.fillRect(0, 0, 256, 256);
  twbCtx.fillStyle = '#606060';
  twbCtx.fillRect(0, 0, 256, 256);

  for (let row = 0; row < 16; row++) {
    const y = row * 16;
    twCtx.fillStyle = row % 2 === 0 ? '#8c6946' : '#65492f';
    twCtx.fillRect(0, y + 2, 256, 11);
    twbCtx.fillStyle = '#b8b8b8';
    twbCtx.fillRect(0, y + 2, 256, 11);
    twCtx.fillStyle = '#3c2a1b';
    twCtx.fillRect(0, y + 13, 256, 3);
    twbCtx.fillStyle = '#202020';
    twbCtx.fillRect(0, y + 13, 256, 3);
  }
  for (let col = 0; col < 6; col++) {
    const x = col * 42 + 8;
    twCtx.fillStyle = '#533b25';
    twCtx.fillRect(x, 0, 10, 256);
    twbCtx.fillStyle = '#e0e0e0';
    twbCtx.fillRect(x, 0, 10, 256);
  }

  // 4. Wood Tier (horizontal lumber planks with grain + nails)
  const [wdCanvas, wdCtx] = makeCanvas(256);
  const [wdbCanvas, wdbCtx] = makeCanvas(256);
  wdCtx.fillStyle = '#997046';
  wdCtx.fillRect(0, 0, 256, 256);
  wdbCtx.fillStyle = '#909090';
  wdbCtx.fillRect(0, 0, 256, 256);

  for (let p = 0; p < 8; p++) {
    const y = p * 32;
    const tone = p % 3 === 0 ? '#a67b4f' : p % 3 === 1 ? '#946b42' : '#855f39';
    wdCtx.fillStyle = tone;
    wdCtx.fillRect(0, y + 1, 256, 30);
    wdbCtx.fillStyle = '#b4b4b4';
    wdbCtx.fillRect(0, y + 1, 256, 30);

    wdCtx.fillStyle = 'rgba(54, 34, 18, 0.25)';
    for (let g = 0; g < 6; g++) {
      wdCtx.fillRect(0, y + 4 + g * 4, 256, 1);
    }

    wdCtx.fillStyle = '#3d2815';
    wdCtx.fillRect(0, y + 30, 256, 2);
    wdbCtx.fillStyle = '#242424';
    wdbCtx.fillRect(0, y + 30, 256, 2);

    wdCtx.fillStyle = '#474c52';
    wdCtx.fillRect(14, y + 14, 4, 4);
    wdCtx.fillRect(238, y + 14, 4, 4);
  }

  // 5. Stone Tier (chiseled ashlar stone blocks + mortar)
  const [stCanvas, stCtx] = makeCanvas(256);
  const [stbCanvas, stbCtx] = makeCanvas(256);
  stCtx.fillStyle = '#5c6066';
  stCtx.fillRect(0, 0, 256, 256);
  stbCtx.fillStyle = '#383838';
  stbCtx.fillRect(0, 0, 256, 256);

  const rows = 6;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3;
    const colW = 256 / cols;
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + offset;
      const by = r * rowH;
      const v = Math.floor(118 + hash2(r * 7 + c, 21) * 32);
      stCtx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
      stCtx.fillRect(bx + 3, by + 3, colW - 6, rowH - 6);

      const bv = Math.floor(170 + hash2(r, c) * 50);
      stbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      stbCtx.fillRect(bx + 3, by + 3, colW - 6, rowH - 6);
    }
  }
  for (let i = 0; i < 900; i++) {
    const x = hash2(i, 31) * 256;
    const y = hash2(i, 32) * 256;
    stCtx.fillStyle = hash2(i, 33) > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    stCtx.fillRect(x, y, 2, 2);
  }

  // 6. Rusted Loot Barrel
  const [brCanvas, brCtx] = makeCanvas(256);
  brCtx.fillStyle = '#993b24';
  brCtx.fillRect(0, 0, 256, 256);
  brCtx.fillStyle = '#c45b28';
  brCtx.fillRect(0, 72, 256, 112);
  brCtx.fillStyle = '#474b52';
  brCtx.fillRect(0, 62, 256, 10);
  brCtx.fillRect(0, 184, 256, 10);
  for (let i = 0; i < 400; i++) {
    const x = hash2(i, 41) * 256;
    const y = hash2(i, 42) * 256;
    brCtx.fillStyle = 'rgba(48, 22, 14, 0.25)';
    brCtx.fillRect(x, y, 4, 3);
  }

  // 7. Radial Contact Shadow
  const [csCanvas, csCtx] = makeCanvas(128);
  const grad = csCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  csCtx.fillStyle = grad;
  csCtx.fillRect(0, 0, 128, 128);

  const groundColor = finalizeTexture(gCanvas, true, 96, 96, maxAnisotropy);
  const groundBump = finalizeTexture(gbCanvas, false, 96, 96, maxAnisotropy);
  const barkColor = finalizeTexture(bCanvas, true, 2, 3, maxAnisotropy);
  const rockColor = finalizeTexture(rkCanvas, true, 1, 1, maxAnisotropy);
  const caveRockColor = finalizeTexture(cvCanvas, true, 2, 2, maxAnisotropy);
  const sludgeColor = finalizeTexture(slCanvas, true, 2, 2, maxAnisotropy);
  const twigColor = finalizeTexture(twCanvas, true, 2, 2, maxAnisotropy);
  const twigBump = finalizeTexture(twbCanvas, false, 2, 2, maxAnisotropy);
  const woodColor = finalizeTexture(wdCanvas, true, 2, 2, maxAnisotropy);
  const woodBump = finalizeTexture(wdbCanvas, false, 2, 2, maxAnisotropy);
  const stoneColor = finalizeTexture(stCanvas, true, 2, 2, maxAnisotropy);
  const stoneBump = finalizeTexture(stbCanvas, false, 2, 2, maxAnisotropy);
  const barrelColor = finalizeTexture(brCanvas, true, 1, 1, maxAnisotropy);
  const contactShadow = new THREE.CanvasTexture(csCanvas);
  contactShadow.needsUpdate = true;

  return {
    groundColor,
    groundBump,
    barkColor,
    rockColor,
    caveRockColor,
    sludgeColor,
    twigColor,
    twigBump,
    woodColor,
    woodBump,
    stoneColor,
    stoneBump,
    barrelColor,
    contactShadow,
    dispose: () => {
      groundColor.dispose();
      groundBump.dispose();
      barkColor.dispose();
      rockColor.dispose();
      caveRockColor.dispose();
      sludgeColor.dispose();
      twigColor.dispose();
      twigBump.dispose();
      woodColor.dispose();
      woodBump.dispose();
      stoneColor.dispose();
      stoneBump.dispose();
      barrelColor.dispose();
      contactShadow.dispose();
    },
  };
}
