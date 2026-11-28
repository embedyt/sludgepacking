import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SkyDomeShader = {
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
    uDayFactor: { value: 1.0 },
    uDuskFactor: { value: 0.0 },
    uCaveBlend: { value: 0.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorldDir;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldDir = normalize(position);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uSunDir;
    uniform float uDayFactor;
    uniform float uDuskFactor;
    uniform float uCaveBlend;
    uniform float uTime;
    varying vec3 vWorldDir;

    float starHash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    void main() {
      vec3 dir = normalize(vWorldDir);
      float elev = clamp(dir.y, -0.2, 1.0);
      float hMix = smoothstep(-0.04, 0.68, elev);

      vec3 dayZenith = vec3(0.24, 0.47, 0.76);
      vec3 dayHorizon = vec3(0.66, 0.79, 0.89);
      vec3 duskHorizon = vec3(0.86, 0.43, 0.22);
      vec3 nightZenith = vec3(0.008, 0.012, 0.025);
      vec3 nightHorizon = vec3(0.015, 0.022, 0.038);

      vec3 dayCol = mix(dayHorizon, dayZenith, hMix);
      vec3 nightCol = mix(nightHorizon, nightZenith, hMix);
      vec3 col = mix(nightCol, dayCol, uDayFactor);

      // Sunset / sunrise warm horizon band
      float horizonMask = exp(-abs(dir.y) * 5.2);
      col = mix(col, duskHorizon, clamp(uDuskFactor * horizonMask * 0.75, 0.0, 0.85));

      // Solar disc + atmospheric scattering corona
      float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
      col += vec3(1.0, 0.85, 0.62) * pow(sunDot, 220.0) * 1.45 * uDayFactor;
      col += vec3(1.0, 0.62, 0.36) * pow(sunDot, 16.0) * (0.18 + uDuskFactor * 0.35) * max(uDayFactor, 0.15);

      // Subtle starfield on clear dark nights
      float nightWeight = (1.0 - uDayFactor) * smoothstep(0.04, 0.3, dir.y) * (1.0 - uCaveBlend);
      if (nightWeight > 0.01) {
        vec3 starCell = floor(dir * 165.0);
        float s = starHash(starCell);
        if (s > 0.9935) {
          float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + s * 120.0);
          col += vec3(0.75, 0.82, 0.95) * nightWeight * twinkle * 0.85;
        }
      }

      // Underground darkness clamp
      col = mix(col, vec3(0.006, 0.009, 0.008), uCaveBlend);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const OceanWaterShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
    uDayFactor: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0x88b4d8) },
    uFogDensity: { value: 0.0085 },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vWorldPos;
    varying float vWave;
    void main() {
      vec3 p = position;
      float w1 = sin(p.x * 0.22 + uTime * 1.45) * cos(p.z * 0.19 + uTime * 1.15);
      float w2 = sin((p.x + p.z) * 0.38 - uTime * 1.9);
      float wave = w1 * 0.08 + w2 * 0.04;
      p.y += wave;
      vWave = wave;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform float uDayFactor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying vec3 vWorldPos;
    varying float vWave;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);

      // Cheap analytical normal perturbation for crisp ocean shimmer
      float nx = cos(vWorldPos.x * 0.45 + uTime * 1.7) * 0.08 + cos((vWorldPos.x - vWorldPos.z) * 0.9 - uTime * 2.1) * 0.045;
      float nz = sin(vWorldPos.z * 0.42 + uTime * 1.5) * 0.08 + sin((vWorldPos.x + vWorldPos.z) * 0.85 + uTime * 1.8) * 0.045;
      vec3 normal = normalize(vec3(nx, 1.0, nz));

      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.4);

      vec3 deepDay = vec3(0.05, 0.20, 0.29);
      vec3 shallowDay = vec3(0.11, 0.37, 0.46);
      vec3 deepNight = vec3(0.006, 0.012, 0.022);

      vec3 waterBase = mix(deepDay, shallowDay, clamp(vWave * 4.0 + 0.45, 0.0, 1.0));
      waterBase = mix(deepNight, waterBase, uDayFactor);

      vec3 skyReflect = mix(vec3(0.02, 0.03, 0.05), vec3(0.55, 0.72, 0.86), uDayFactor);
      vec3 col = mix(waterBase, skyReflect, clamp(fresnel * 0.65, 0.0, 0.72));

      vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
      float spec = pow(max(dot(normal, halfVec), 0.0), 92.0);
      col += vec3(1.0, 0.9, 0.72) * spec * (0.12 + uDayFactor * 0.9);

      // Exponential squared fog matching scene.fog
      float dist = length(cameraPosition - vWorldPos);
      float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
      col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

      gl_FragColor = vec4(col, 0.92);
    }
  `,
};

const AtmosphericGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uNightFactor: { value: 0.0 },
    uCaveBlend: { value: 0.0 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uNightFactor;
    uniform float uCaveBlend;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb;

      // Filmic subtle S-curve contrast without crushing midtones
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.16);

      // Cool shadow depth at night / subtle emerald tint inside Bio-Sludge caves
      vec3 nightTint = vec3(0.84, 0.90, 1.04);
      vec3 caveTint = vec3(0.92, 1.04, 0.95);
      col *= mix(vec3(1.0), nightTint, uNightFactor * 0.5);
      col *= mix(vec3(1.0), caveTint, uCaveBlend * 0.45);

      // Lightweight radial vignette
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);
      float vigStrength = uVignette + uNightFactor * 0.22 + uCaveBlend * 0.2;
      float vig = clamp(1.0 - r2 * vigStrength * 1.45, 0.25, 1.0);
      col *= vig;

      gl_FragColor = vec4(col, texel.a);
    }
  `,
};

export class ShaderPipeline {
  private composer: EffectComposer | null = null;
  private gradePass: ShaderPass | null = null;
  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private waterShaderMat: THREE.ShaderMaterial;
  private waterFallbackMat: THREE.MeshStandardMaterial;
  private waterMesh: THREE.Mesh | null = null;
  private enabled = true;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private isSoftwareGl: boolean,
    initialEnabled: boolean,
  ) {
    this.enabled = initialEnabled;

    // Sky Dome attached to scene (moves with camera)
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SkyDomeShader.uniforms),
      vertexShader: SkyDomeShader.vertexShader,
      fragmentShader: SkyDomeShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(260, 24, 16), this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -10;
    this.scene.add(this.skyMesh);

    this.waterShaderMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(OceanWaterShader.uniforms),
      vertexShader: OceanWaterShader.vertexShader,
      fragmentShader: OceanWaterShader.fragmentShader,
      transparent: true,
    });

    this.waterFallbackMat = new THREE.MeshStandardMaterial({
      color: 0x1e4c63,
      roughness: 0.24,
      metalness: 0.18,
      transparent: true,
      opacity: 0.92,
    });

    if (!this.isSoftwareGl) {
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      const rt = new THREE.WebGLRenderTarget(
        Math.max(1, size.x),
        Math.max(1, size.y),
        { samples: 0, type: THREE.HalfFloatType },
      );
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gradePass = new ShaderPass(AtmosphericGradeShader);
      this.composer.addPass(this.gradePass);
      this.composer.addPass(new OutputPass());
    }

    this.applyToggleState();
  }

  public attachWaterMesh(mesh: THREE.Mesh): void {
    this.waterMesh = mesh;
    this.applyToggleState();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyToggleState();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private applyToggleState(): void {
    this.skyMesh.visible = this.enabled;
    if (this.waterMesh) {
      this.waterMesh.material = this.enabled ? this.waterShaderMat : this.waterFallbackMat;
    }
  }

  public resize(width: number, height: number): void {
    if (!this.composer || width <= 0 || height <= 0) return;
    this.composer.setSize(width, height);
  }

  public update(params: {
    elapsed: number;
    sunDir: THREE.Vector3;
    dayFactor: number;
    duskFactor: number;
    caveBlend: number;
    fogColor: THREE.Color;
    fogDensity: number;
  }): void {
    this.skyMesh.position.copy(this.camera.position);

    if (this.enabled) {
      this.skyMat.uniforms.uSunDir.value.copy(params.sunDir);
      this.skyMat.uniforms.uDayFactor.value = params.dayFactor;
      this.skyMat.uniforms.uDuskFactor.value = params.duskFactor;
      this.skyMat.uniforms.uCaveBlend.value = params.caveBlend;
      this.skyMat.uniforms.uTime.value = params.elapsed;

      this.waterShaderMat.uniforms.uTime.value = params.elapsed;
      this.waterShaderMat.uniforms.uSunDir.value.copy(params.sunDir);
      this.waterShaderMat.uniforms.uDayFactor.value = params.dayFactor;
      this.waterShaderMat.uniforms.uFogColor.value.copy(params.fogColor);
      this.waterShaderMat.uniforms.uFogDensity.value = params.fogDensity;

      if (this.gradePass) {
        this.gradePass.uniforms.uNightFactor.value = 1 - params.dayFactor;
        this.gradePass.uniforms.uCaveBlend.value = params.caveBlend;
      }
    }
  }

  public render(): void {
    if (this.enabled && this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public dispose(): void {
    this.scene.remove(this.skyMesh);
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
    this.waterShaderMat.dispose();
    this.waterFallbackMat.dispose();
    this.composer?.dispose();
  }
}
