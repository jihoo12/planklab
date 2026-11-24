import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraPreset,
  PhysicsMetrics,
  QuantumAudioFeedback,
  QuantumMode,
  SimulationParams,
  computeHolographyMetrics,
  computeLqgMetrics,
  computeSpacetimeMetrics,
} from '../physics/quantumGravityMath';
import { buildObservatoryFrame, ObservatoryFrameHandle } from './observatoryFrame';

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();
const _pointer = new THREE.Vector2();

const SPIN_VALUES = [0.5, 1.0, 1.5, 2.0, 2.5] as const;
const SPIN_COLORS = [
  new THREE.Color(0x3b82f6), // j = 1/2 (cobalt)
  new THREE.Color(0x06b6d4), // j = 1   (laser cyan)
  new THREE.Color(0x10b981), // j = 3/2 (emerald)
  new THREE.Color(0xf59e0b), // j = 2   (telemetry amber)
  new THREE.Color(0xfb7185), // j = 5/2 (high-energy coral)
];

interface GeodesicPhoton {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  trailPositions: Float32Array;
  trailIndex: number;
  trailLine: THREE.Line;
  headMesh: THREE.Mesh;
  age: number;
  maxAge: number;
  active: boolean;
}

interface HawkingPair {
  angle: number;
  elevation: number;
  radiusOut: number;
  radiusIn: number;
  life: number;
  maxLife: number;
}

interface LqgEdgeData {
  a: number;
  b: number;
  spinIndex: number; // index into SPIN_VALUES
  pulse: number; // visual excitation decay 0..1
  mesh: THREE.Mesh;
}

interface EntanglementArcData {
  pointA: THREE.Vector3;
  pointB: THREE.Vector3;
  mesh: THREE.Mesh;
  phase: number;
  length: number;
  isUserSpawned: boolean;
}

export interface EngineCallbacks {
  onMetricsUpdate: (metrics: PhysicsMetrics) => void;
  onInteractionNote: (note: string) => void;
  onContextLost: (lost: boolean) => void;
}

export class QuantumGravityEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsedTime = 0;
  private lastMetricsEmit = 0;

  private mode: QuantumMode = 'spacetime';
  private params: SimulationParams;
  private isPaused = false;
  private callbacks: EngineCallbacks;
  private audio: QuantumAudioFeedback;

  // Camera transition state
  private cameraTargetPos: THREE.Vector3 | null = null;
  private cameraTargetLook: THREE.Vector3 | null = null;

  // Persistent observatory frame & starfield
  private observatory: ObservatoryFrameHandle;
  private starField: THREE.Points;

  // Mode 1: Spacetime Foam & Horizon
  private spacetimeGroup = new THREE.Group();
  private fabricMesh!: THREE.Mesh;
  private fabricWire!: THREE.LineSegments;
  private fabricBasePos!: Float32Array;
  private fabricColorAttr!: THREE.BufferAttribute;
  private horizonGroup = new THREE.Group();
  private horizonCore!: THREE.Mesh;
  private photonRingMat!: THREE.ShaderMaterial;
  private hawkingOutInst!: THREE.InstancedMesh;
  private hawkingInInst!: THREE.InstancedMesh;
  private hawkingPairs: HawkingPair[] = [];
  private photons: GeodesicPhoton[] = [];
  private photonHitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.25);

  // Mode 2: Loop Quantum Gravity (Spin Network)
  private lqgGroup = new THREE.Group();
  private lqgBaseNodes: THREE.Vector3[] = [];
  private lqgCurrentNodes: THREE.Vector3[] = [];
  private lqgNodeExcitation: Float32Array = new Float32Array(0);
  private lqgNodeInst!: THREE.InstancedMesh;
  private lqgEdges: LqgEdgeData[] = [];
  private lqgDualFacetsMesh!: THREE.Mesh;
  private lqgEdgeGeo!: THREE.CylinderGeometry;
  private bounceActive = false;
  private bounceTimer = 0;
  private bouncePhase: 'equilibrium' | 'contracting' | 'bouncing' = 'equilibrium';

  // Mode 3: Holographic AdS/CFT & ER=EPR
  private holographyGroup = new THREE.Group();
  private boundarySphere!: THREE.Mesh;
  private boundaryShellMat!: THREE.ShaderMaterial;
  private boundaryOperatorsInst!: THREE.InstancedMesh;
  private bulkHorizonMesh!: THREE.Mesh;
  private bulkHorizonGlow!: THREE.Mesh;
  private entanglementArcs: EntanglementArcData[] = [];
  private lastBuiltHorizon = -1;
  private lastBuiltDensity = -1;
  private boundaryRadius = 3.65;

  // Interaction tracking
  private pointerDownPos = { x: 0, y: 0 };
  private hoveredLink: LqgEdgeData | null = null;

  constructor(
    container: HTMLElement,
    initialParams: SimulationParams,
    callbacks: EngineCallbacks,
    audio: QuantumAudioFeedback,
  ) {
    this.container = container;
    this.params = { ...initialParams };
    this.callbacks = callbacks;
    this.audio = audio;

    // 1. Software WebGL probe via GPU renderer string
    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Renderer configuration (r160+ modern color pipeline)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.appendChild(this.renderer.domElement);

    // 3. Scene, Atmosphere & Studio PMREM Environment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060911);
    this.scene.fog = new THREE.FogExp2(0x060911, 0.024);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Camera & OrbitControls
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 160);
    this.camera.position.set(0.2, 6.2, 12.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 24;
    this.controls.maxPolarAngle = Math.PI * 0.82;
    this.controls.target.set(0, -0.35, 0);
    this.controls.addEventListener('start', () => {
      // Cancel scripted camera transition immediately so user always wins
      this.cameraTargetPos = null;
      this.cameraTargetLook = null;
    });

    // 5. Balanced 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x88b4e6, 0x101829, 0.72);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.9);
    keyLight.position.set(8, 12, 7);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -9;
      keyLight.shadow.camera.right = 9;
      keyLight.shadow.camera.top = 9;
      keyLight.shadow.camera.bottom = -9;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-9, 5, -8);
    this.scene.add(rimLight);

    const underFill = new THREE.PointLight(0x06b6d4, 0.8, 22, 1.8);
    underFill.position.set(0, -3.5, 0);
    this.scene.add(underFill);

    // 6. Build Observatory Containment Frame & Deep Starfield
    this.observatory = buildObservatoryFrame(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.observatory.group);

    this.starField = this.buildDeepFieldParticles();
    this.scene.add(this.starField);

    // 7. Build All Three Quantum Gravity Modules
    this.initSpacetimeMode();
    this.initLqgMode();
    this.initHolographyMode();

    this.scene.add(this.spacetimeGroup);
    this.scene.add(this.lqgGroup);
    this.scene.add(this.holographyGroup);

    this.applyModeVisibility();

    // 8. Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 9. Attach events
    this.bindEvents();
    this.emitMetricsNow();

    // 10. Launch animation loop
    this.lastTime = performance.now();
    this.tick();
  }

  private buildDeepFieldParticles(): THREE.Points {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 24 + Math.random() * 48;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tint = Math.random();
      if (tint < 0.25) {
        _color.setHex(0x93c5fd);
      } else if (tint < 0.45) {
        _color.setHex(0xfde68a);
      } else {
        _color.setHex(0xcbd5e1);
      }
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  // =========================================================================
  // MODE 1: SPACETIME FOAM, SCHWARZSCHILD METRIC WELL & HAWKING RADIATION
  // =========================================================================
  private initSpacetimeMode(): void {
    const size = 10.6;
    const segments = 76;
    const planeGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    planeGeo.rotateX(-Math.PI / 2);

    const posAttr = planeGeo.attributes.position as THREE.BufferAttribute;
    this.fabricBasePos = new Float32Array(posAttr.array.length);
    this.fabricBasePos.set(posAttr.array);

    const colors = new Float32Array(posAttr.count * 3);
    this.fabricColorAttr = new THREE.BufferAttribute(colors, 3);
    planeGeo.setAttribute('color', this.fabricColorAttr);

    const fabricMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.58,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });

    this.fabricMesh = new THREE.Mesh(planeGeo, fabricMat);
    this.fabricMesh.position.y = -0.35;
    this.spacetimeGroup.add(this.fabricMesh);

    // Crisp coordinate metric wireframe overlay (updates alongside fabric)
    const wireGeo = new THREE.WireframeGeometry(planeGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
    });
    this.fabricWire = new THREE.LineSegments(wireGeo, wireMat);
    this.fabricWire.position.y = -0.33;
    this.spacetimeGroup.add(this.fabricWire);

    // Composite Central Event Horizon & Fresnel Photon Sphere
    this.horizonGroup.position.set(0, 0.35, 0);

    const coreGeo = new THREE.SphereGeometry(0.62, 40, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x02040a,
      roughness: 0.12,
      metalness: 0.95,
    });
    this.horizonCore = new THREE.Mesh(coreGeo, coreMat);
    this.horizonGroup.add(this.horizonCore);

    // Fresnel Gravitational Lensing / Photon Sphere Halo Shader
    this.photonRingMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorInner: { value: new THREE.Color(0xf59e0b) },
        uColorOuter: { value: new THREE.Color(0x06b6d4) },
        uFoamIntensity: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vPos;
        void main() {
          vPos = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        uniform float uFoamIntensity;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vPos;

        void main() {
          vec3 viewDir = normalize(vViewPos);
          float ndotv = max(0.0, dot(viewDir, normalize(vNormal)));
          float fresnel = pow(1.0 - ndotv, 2.8);
          float shimmer = 0.85 + 0.15 * sin(vPos.y * 12.0 + uTime * 3.5 + vPos.x * 8.0);
          float quantumSpark = smoothstep(0.65, 1.0, sin(vPos.x * 18.0 - uTime * 5.0) * cos(vPos.z * 18.0 + uTime * 4.0)) * uFoamIntensity;
          vec3 col = mix(uColorOuter, uColorInner, fresnel * 0.85 + quantumSpark * 0.45) * shimmer;
          float alpha = clamp(fresnel * 1.15 + quantumSpark * 0.25, 0.0, 0.92);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const photonShell = new THREE.Mesh(new THREE.SphereGeometry(0.84, 36, 28), this.photonRingMat);
    this.horizonGroup.add(photonShell);

    // Subtle Equator Relativistic Accretion Ring (Composite Part 3)
    const accretionRingGeo = new THREE.RingGeometry(0.86, 1.52, 64);
    accretionRingGeo.rotateX(-Math.PI / 2);
    const accretionMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const accretionRing = new THREE.Mesh(accretionRingGeo, accretionMat);
    accretionRing.rotation.z = 0.14;
    this.horizonGroup.add(accretionRing);

    this.spacetimeGroup.add(this.horizonGroup);

    // Virtual Hawking Radiation Particle-Antiparticle Pairs (InstancedMesh)
    const pairCount = 36;
    const particleGeo = new THREE.OctahedronGeometry(0.055, 1);
    const outMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.9,
    });
    const inMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
    });
    this.hawkingOutInst = new THREE.InstancedMesh(particleGeo, outMat, pairCount);
    this.hawkingInInst = new THREE.InstancedMesh(particleGeo, inMat, pairCount);
    this.hawkingOutInst.frustumCulled = false;
    this.hawkingInInst.frustumCulled = false;

    for (let i = 0; i < pairCount; i++) {
      this.hawkingPairs.push({
        angle: Math.random() * Math.PI * 2,
        elevation: (Math.random() - 0.5) * 1.25,
        radiusOut: 0.9,
        radiusIn: 0.85,
        life: Math.random() * 2.4,
        maxLife: 1.6 + Math.random() * 1.4,
      });
    }
    this.spacetimeGroup.add(this.hawkingOutInst);
    this.spacetimeGroup.add(this.hawkingInInst);

    // Seed 3 initial grazing geodesic test photons so the scene immediately demonstrates lensing
    this.spawnGeodesicPhoton(new THREE.Vector3(-4.4, 0, -1.8), new THREE.Vector3(3.1, 0, 0.25));
    this.spawnGeodesicPhoton(new THREE.Vector3(-4.2, 0, 2.1), new THREE.Vector3(3.0, 0, -0.35));
  }

  private sampleSpacetimeHeight(x: number, z: number, t: number): number {
    const r = Math.sqrt(x * x + z * z);
    const mass = this.params.massEnergy;

    // Flamm's paraboloid / gravitational potential well smoothly regularized at horizon
    const wellDepth = -2.15 * mass / Math.sqrt(r * r + 0.72);

    // Planck scale proximity factor: 1.0 at scaleLogPlanck=0 (1 l_P), fades to 0.03 at 6 (smooth GR)
    const planckFactor = Math.exp(-this.params.scaleLogPlanck * 0.62) * this.params.quantumFluctuation;

    // Multi-frequency Wheeler Spacetime Foam turbulence
    let foam = 0;
    if (planckFactor > 0.008) {
      const f1 = Math.sin(x * 2.4 + t * 2.1) * Math.cos(z * 2.3 - t * 1.8);
      const f2 = Math.sin((x + z) * 3.8 - t * 3.1) * Math.cos((x - z) * 3.4 + t * 2.5);
      const f3 = Math.sin(r * 5.2 - t * 4.2) * 0.5;
      // Micro wormhole spikes near Planck regime
      const spike = Math.pow(Math.abs(Math.sin(x * 1.9 - t * 1.4) * Math.sin(z * 2.1 + t * 1.6)), 3.0);
      foam = (f1 * 0.42 + f2 * 0.3 + f3 * 0.2 + spike * 0.95) * planckFactor * 0.78;
    }

    // Smooth circular aperture taper at perimeter so fabric sits cleanly inside containment ring
    const edgeFade = 1.0 - THREE.MathUtils.smoothstep(r, 4.2, 5.5);
    return (wellDepth + foam) * edgeFade;
  }

  private updateSpacetimeMode(dt: number, t: number): void {
    const posAttr = this.fabricMesh.geometry.attributes.position as THREE.BufferAttribute;
    const count = posAttr.count;
    const planckFactor = Math.exp(-this.params.scaleLogPlanck * 0.62) * this.params.quantumFluctuation;

    for (let i = 0; i < count; i++) {
      const x = this.fabricBasePos[i * 3];
      const z = this.fabricBasePos[i * 3 + 2];
      const y = this.sampleSpacetimeHeight(x, z, t);
      posAttr.setY(i, y);

      // Physical color mapping: deep metric well -> warm amber; high foam crests -> bright cyan; flat space -> deep slate
      const depthNorm = THREE.MathUtils.clamp(-y / 2.2, 0, 1);
      const crestNorm = THREE.MathUtils.clamp((y + 0.15) * 1.4, 0, 1) * planckFactor;

      const r = THREE.MathUtils.lerp(0.08, 0.92, depthNorm * depthNorm) + crestNorm * 0.1;
      const g = THREE.MathUtils.lerp(0.14, 0.48, depthNorm) + crestNorm * 0.68;
      const b = THREE.MathUtils.lerp(0.28, 0.22, depthNorm) + crestNorm * 0.85;

      this.fabricColorAttr.setXYZ(i, Math.min(1, r), Math.min(1, g), Math.min(1, b));
    }
    posAttr.needsUpdate = true;
    this.fabricColorAttr.needsUpdate = true;

    // Update wireframe vertex heights efficiently without reallocating geometry
    const wirePos = this.fabricWire.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < wirePos.count; i++) {
      const wx = wirePos.getX(i);
      const wz = wirePos.getZ(i);
      wirePos.setY(i, this.sampleSpacetimeHeight(wx, wz, t) + 0.015);
    }
    wirePos.needsUpdate = true;

    // Scale central black hole horizon smoothly with massEnergy
    const horizonScale = 0.55 + this.params.massEnergy * 0.36;
    this.horizonGroup.scale.setScalar(horizonScale);
    this.horizonGroup.position.y = -0.35 + Math.max(-1.2, -0.52 * this.params.massEnergy);
    this.photonRingMat.uniforms.uTime.value = t;
    this.photonRingMat.uniforms.uFoamIntensity.value = planckFactor;

    // Update Hawking Radiation Virtual Pairs around horizon
    const pairOriginY = this.horizonGroup.position.y;
    const baseR = 0.72 * horizonScale;
    for (let i = 0; i < this.hawkingPairs.length; i++) {
      const p = this.hawkingPairs[i];
      p.life += dt * (0.7 + planckFactor * 0.8);
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.angle = Math.random() * Math.PI * 2;
        p.elevation = (Math.random() - 0.5) * 1.3;
        p.radiusOut = baseR * 1.05;
        p.radiusIn = baseR * 0.98;
      }
      const prog = p.life / p.maxLife;
      const outR = baseR * 1.05 + prog * (2.6 + planckFactor * 1.4);
      const inR = Math.max(0.12, baseR * (1.0 - prog * 0.88));
      const spinAngle = p.angle + prog * 1.3;

      const cosE = Math.cos(p.elevation);
      const sinE = Math.sin(p.elevation);

      // Escaping positive-energy Hawking quantum (amber)
      const outScale = Math.sin(prog * Math.PI) * (0.7 + planckFactor * 0.6);
      _v1.set(Math.cos(spinAngle) * cosE * outR, pairOriginY + sinE * outR * 0.65, Math.sin(spinAngle) * cosE * outR);
      _mat4.makeTranslation(_v1.x, _v1.y, _v1.z);
      _mat4.scale(_v2.setScalar(Math.max(0.001, outScale)));
      this.hawkingOutInst.setMatrixAt(i, _mat4);

      // Infalling negative-energy partner (cyan)
      const inScale = Math.sin(prog * Math.PI) * 0.75;
      _v1.set(Math.cos(spinAngle - 0.15) * cosE * inR, pairOriginY + sinE * inR * 0.5, Math.sin(spinAngle - 0.15) * cosE * inR);
      _mat4.makeTranslation(_v1.x, _v1.y, _v1.z);
      _mat4.scale(_v2.setScalar(Math.max(0.001, inScale)));
      this.hawkingInInst.setMatrixAt(i, _mat4);
    }
    this.hawkingOutInst.instanceMatrix.needsUpdate = true;
    this.hawkingInInst.instanceMatrix.needsUpdate = true;

    // Update Geodesic Test Photons (real 2D Schwarzschild-like central deflection + quantum foam dispersion)
    const gravStrength = 3.8 * this.params.massEnergy;
    const captureR = 0.62 * horizonScale;

    for (let i = this.photons.length - 1; i >= 0; i--) {
      const ph = this.photons[i];
      ph.age += dt;
      if (ph.age > ph.maxAge || !ph.active) {
        this.spacetimeGroup.remove(ph.trailLine);
        this.spacetimeGroup.remove(ph.headMesh);
        ph.trailLine.geometry.dispose();
        (ph.trailLine.material as THREE.Material).dispose();
        ph.headMesh.geometry.dispose();
        (ph.headMesh.material as THREE.Material).dispose();
        this.photons.splice(i, 1);
        continue;
      }

      const rSq = ph.pos.x * ph.pos.x + ph.pos.z * ph.pos.z;
      const r = Math.sqrt(rSq);
      if (r < captureR) {
        // Photon captured by event horizon
        ph.age = ph.maxAge - 0.15;
        ph.vel.multiplyScalar(0.3);
      } else if (r > 5.8) {
        ph.age = Math.max(ph.age, ph.maxAge - 0.25);
      } else {
        // Geodesic acceleration a = -G M / r^3 * (1 + 1.5 r_s / r)
        const relFactor = 1.0 + (1.2 * captureR) / Math.max(0.4, r);
        const accelMag = (gravStrength * relFactor) / Math.max(0.35, rSq * r);
        ph.vel.x -= ph.pos.x * accelMag * dt;
        ph.vel.z -= ph.pos.z * accelMag * dt;

        // Planck-scale quantum dispersion jitter
        if (planckFactor > 0.15) {
          ph.vel.x += (Math.sin(t * 17.0 + i * 3.1) * planckFactor * 0.9) * dt;
          ph.vel.z += (Math.cos(t * 19.0 + i * 2.7) * planckFactor * 0.9) * dt;
        }

        // Normalize photon speed (constant c in local frame)
        const speed = Math.sqrt(ph.vel.x * ph.vel.x + ph.vel.z * ph.vel.z);
        if (speed > 0.01) {
          const targetSpeed = 3.15;
          ph.vel.x = (ph.vel.x / speed) * targetSpeed;
          ph.vel.z = (ph.vel.z / speed) * targetSpeed;
        }
      }

      ph.pos.x += ph.vel.x * dt;
      ph.pos.z += ph.vel.z * dt;
      ph.pos.y = this.sampleSpacetimeHeight(ph.pos.x, ph.pos.z, t) - 0.24;

      ph.headMesh.position.copy(ph.pos);

      // Shift trail buffer
      const maxPts = ph.trailPositions.length / 3;
      if (ph.trailIndex < maxPts) {
        for (let k = ph.trailIndex; k < maxPts; k++) {
          ph.trailPositions[k * 3] = ph.pos.x;
          ph.trailPositions[k * 3 + 1] = ph.pos.y;
          ph.trailPositions[k * 3 + 2] = ph.pos.z;
        }
        ph.trailIndex++;
      } else {
        ph.trailPositions.copyWithin(0, 3);
        const last = (maxPts - 1) * 3;
        ph.trailPositions[last] = ph.pos.x;
        ph.trailPositions[last + 1] = ph.pos.y;
        ph.trailPositions[last + 2] = ph.pos.z;
      }
      (ph.trailLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public spawnGeodesicPhoton(startPos?: THREE.Vector3, initialVel?: THREE.Vector3): void {
    if (this.photons.length >= 16) {
      const oldest = this.photons.shift();
      if (oldest) {
        this.spacetimeGroup.remove(oldest.trailLine);
        this.spacetimeGroup.remove(oldest.headMesh);
        oldest.trailLine.geometry.dispose();
        (oldest.trailLine.material as THREE.Material).dispose();
        oldest.headMesh.geometry.dispose();
        (oldest.headMesh.material as THREE.Material).dispose();
      }
    }

    const angle = Math.random() * Math.PI * 2;
    const impactParam = (Math.random() > 0.5 ? 1 : -1) * (1.35 + Math.random() * 1.45);
    const pos = startPos
      ? startPos.clone()
      : new THREE.Vector3(
          Math.cos(angle) * 4.5 - Math.sin(angle) * impactParam * 0.45,
          0,
          Math.sin(angle) * 4.5 + Math.cos(angle) * impactParam * 0.45,
        );

    const vel = initialVel
      ? initialVel.clone()
      : new THREE.Vector3(-Math.cos(angle) * 3.1, 0, -Math.sin(angle) * 3.1).add(
          new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(impactParam * 0.55),
        );

    pos.y = this.sampleSpacetimeHeight(pos.x, pos.z, this.elapsedTime) - 0.24;

    const trailLen = 48;
    const trailPositions = new Float32Array(trailLen * 3);
    for (let i = 0; i < trailLen; i++) {
      trailPositions[i * 3] = pos.x;
      trailPositions[i * 3 + 1] = pos.y;
      trailPositions[i * 3 + 2] = pos.z;
    }

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);

    const headGeo = new THREE.SphereGeometry(0.085, 12, 10);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.copy(pos);

    this.spacetimeGroup.add(trailLine);
    this.spacetimeGroup.add(headMesh);

    this.photons.push({
      pos,
      vel,
      trailPositions,
      trailIndex: 1,
      trailLine,
      headMesh,
      age: 0,
      maxAge: 7.5,
      active: true,
    });

    this.audio.playChime(520 + Math.random() * 180, 0.18, 0.045);
  }

  // =========================================================================
  // MODE 2: LOOP QUANTUM GRAVITY — DISCRETE SPIN NETWORK & BIG BOUNCE
  // =========================================================================
  private initLqgMode(): void {
    // Generate 3 concentric Fibonacci shells of intertwiner volume nodes (48 nodes total)
    const shells = [
      { count: 10, radius: 1.25 },
      { count: 18, radius: 2.35 },
      { count: 20, radius: 3.45 },
    ];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (const shell of shells) {
      for (let i = 0; i < shell.count; i++) {
        const y = 1 - (i / Math.max(1, shell.count - 1)) * 2;
        const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i + shell.radius * 1.7;
        const p = new THREE.Vector3(
          Math.cos(theta) * radiusAtY * shell.radius,
          y * shell.radius * 0.88 + 0.15,
          Math.sin(theta) * radiusAtY * shell.radius,
        );
        this.lqgBaseNodes.push(p);
        this.lqgCurrentNodes.push(p.clone());
      }
    }

    const nodeCount = this.lqgBaseNodes.length;
    this.lqgNodeExcitation = new Float32Array(nodeCount);

    // InstancedMesh for quantum volume polyhedra (intertwiners)
    const nodeGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const nodeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.25,
      metalness: 0.72,
      clearcoat: 0.5,
    });
    this.lqgNodeInst = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    this.lqgNodeInst.frustumCulled = false;
    this.lqgGroup.add(this.lqgNodeInst);

    // Build nearest-neighbor SU(2) spin network links (degree ~4-5 per intertwiner)
    const edgeSet = new Set<string>();
    this.lqgEdgeGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1);

    for (let i = 0; i < nodeCount; i++) {
      const dists: { j: number; d: number }[] = [];
      for (let j = 0; j < nodeCount; j++) {
        if (i === j) continue;
        dists.push({ j, d: this.lqgBaseNodes[i].distanceTo(this.lqgBaseNodes[j]) });
      }
      dists.sort((a, b) => a.d - b.d);

      const neighbors = dists.slice(0, 4);
      for (const n of neighbors) {
        const a = Math.min(i, n.j);
        const b = Math.max(i, n.j);
        const key = `${a}-${b}`;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);

        const initialSpinIndex = (a + b) % 3; // start mostly j=1/2, 1, 3/2
        const mat = new THREE.MeshStandardMaterial({
          color: SPIN_COLORS[initialSpinIndex].clone(),
          emissive: SPIN_COLORS[initialSpinIndex].clone(),
          emissiveIntensity: 0.35,
          roughness: 0.28,
          metalness: 0.65,
        });
        const mesh = new THREE.Mesh(this.lqgEdgeGeo, mat);
        mesh.userData.lqgEdgeIndex = this.lqgEdges.length;

        this.lqgEdges.push({
          a,
          b,
          spinIndex: initialSpinIndex,
          pulse: 0,
          mesh,
        });
        this.lqgGroup.add(mesh);
      }
    }

    // Translucent dual-lattice quantized area facets (subtle geometric glass triangles)
    const triVerts: number[] = [];
    for (let i = 0; i < this.lqgEdges.length; i++) {
      const e = this.lqgEdges[i];
      // Find a common neighbor to form a dual quantum area facet
      for (let k = i + 1; k < Math.min(this.lqgEdges.length, i + 18); k++) {
        const e2 = this.lqgEdges[k];
        let third = -1;
        if (e2.a === e.a) third = e2.b;
        else if (e2.b === e.a) third = e2.a;
        if (third !== -1 && third !== e.b) {
          const dCheck = this.lqgBaseNodes[e.b].distanceTo(this.lqgBaseNodes[third]);
          if (dCheck < 2.2) {
            const pa = this.lqgBaseNodes[e.a];
            const pb = this.lqgBaseNodes[e.b];
            const pc = this.lqgBaseNodes[third];
            triVerts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, pc.x, pc.y, pc.z);
            break;
          }
        }
      }
    }
    const facetGeo = new THREE.BufferGeometry();
    facetGeo.setAttribute('position', new THREE.Float32BufferAttribute(triVerts, 3));
    facetGeo.computeVertexNormals();
    const facetMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.lqgDualFacetsMesh = new THREE.Mesh(facetGeo, facetMat);
    this.lqgGroup.add(this.lqgDualFacetsMesh);
  }

  public triggerBigBounce(): void {
    this.bounceActive = true;
    this.bounceTimer = 0;
    this.bouncePhase = 'contracting';
    this.audio.playBouncePulse();
    this.callbacks.onInteractionNote('플랑크 밀도 한계 도달 — 양자 기하 반발력(빅 바운스) 작동');
  }

  private updateLqgMode(dt: number, t: number): void {
    // Handle Big Bounce compression & quantum repulsion curve
    let globalScale = 1.0;
    let bounceGlow = 0;
    if (this.bounceActive) {
      this.bounceTimer += dt;
      if (this.bounceTimer < 1.35) {
        // Contracting toward Planck density
        const p = this.bounceTimer / 1.35;
        const ease = p * p;
        globalScale = THREE.MathUtils.lerp(1.0, 0.24, ease);
        bounceGlow = ease;
        this.bouncePhase = 'contracting';
      } else if (this.bounceTimer < 3.1) {
        // Elastic quantum bounce expansion with damped overshoot
        const p = (this.bounceTimer - 1.35) / 1.75;
        const spring = 1.0 - Math.exp(-4.2 * p) * Math.cos(p * Math.PI * 2.4);
        globalScale = THREE.MathUtils.lerp(0.24, 1.0, spring);
        bounceGlow = Math.exp(-3.0 * p);
        this.bouncePhase = 'bouncing';
      } else {
        this.bounceActive = false;
        this.bouncePhase = 'equilibrium';
      }
    }

    const exciteScale = this.params.spinExcitation;

    // Gentle whole-network rotation & quantum breathing
    this.lqgGroup.rotation.y = t * 0.14;
    this.lqgDualFacetsMesh.scale.setScalar(globalScale);

    // Update node positions & instanced transforms
    for (let i = 0; i < this.lqgBaseNodes.length; i++) {
      const base = this.lqgBaseNodes[i];
      this.lqgNodeExcitation[i] = Math.max(0, this.lqgNodeExcitation[i] - dt * 1.4);

      const jitterAmp = 0.045 + exciteScale * 0.055 + bounceGlow * 0.08;
      const cur = this.lqgCurrentNodes[i];
      cur.set(
        base.x * globalScale + Math.sin(t * 1.9 + i * 1.3) * jitterAmp,
        base.y * globalScale + Math.cos(t * 1.6 + i * 1.7) * jitterAmp,
        base.z * globalScale + Math.sin(t * 2.1 + i * 0.9) * jitterAmp,
      );

      const nodeScale = 0.85 + this.lqgNodeExcitation[i] * 0.65 + bounceGlow * 0.35;
      _mat4.makeTranslation(cur.x, cur.y, cur.z);
      _mat4.scale(_v2.setScalar(nodeScale));
      this.lqgNodeInst.setMatrixAt(i, _mat4);

      _color.setRGB(
        0.55 + this.lqgNodeExcitation[i] * 0.45 + bounceGlow * 0.4,
        0.72 + this.lqgNodeExcitation[i] * 0.25,
        0.92 - bounceGlow * 0.45,
      );
      this.lqgNodeInst.setColorAt(i, _color);
    }
    this.lqgNodeInst.instanceMatrix.needsUpdate = true;
    if (this.lqgNodeInst.instanceColor) this.lqgNodeInst.instanceColor.needsUpdate = true;

    // Update SU(2) spin links between current nodes
    for (let i = 0; i < this.lqgEdges.length; i++) {
      const edge = this.lqgEdges[i];
      edge.pulse = Math.max(0, edge.pulse - dt * 1.6);

      const pA = this.lqgCurrentNodes[edge.a];
      const pB = this.lqgCurrentNodes[edge.b];

      _v1.addVectors(pA, pB).multiplyScalar(0.5); // midpoint
      _v2.subVectors(pB, pA); // delta
      const len = _v2.length();

      edge.mesh.position.copy(_v1);
      if (len > 0.0001) {
        _v3.copy(_v2).divideScalar(len);
        _quat.setFromUnitVectors(_up, _v3);
        edge.mesh.quaternion.copy(_quat);
      }

      const jVal = SPIN_VALUES[edge.spinIndex];
      const radius = (0.016 + jVal * 0.014) * (1.0 + edge.pulse * 0.65);
      edge.mesh.scale.set(radius, len, radius);

      const mat = edge.mesh.material as THREE.MeshStandardMaterial;
      const isHovered = this.hoveredLink === edge;
      const targetColor = SPIN_COLORS[edge.spinIndex];
      mat.color.copy(targetColor);
      mat.emissive.copy(targetColor);
      mat.emissiveIntensity =
        0.28 +
        exciteScale * 0.35 +
        edge.pulse * 1.35 +
        bounceGlow * 1.1 +
        (isHovered ? 0.85 : 0);
    }
  }

  private exciteSpinLink(edge: LqgEdgeData): void {
    edge.spinIndex = (edge.spinIndex + 1) % SPIN_VALUES.length;
    edge.pulse = 1.0;
    this.lqgNodeExcitation[edge.a] = 1.0;
    this.lqgNodeExcitation[edge.b] = 1.0;

    // Subtle ripple to connected edges
    for (let i = 0; i < this.lqgEdges.length; i++) {
      const other = this.lqgEdges[i];
      if (other !== edge && (other.a === edge.a || other.b === edge.a || other.a === edge.b || other.b === edge.b)) {
        other.pulse = Math.max(other.pulse, 0.52);
      }
    }

    const newJ = SPIN_VALUES[edge.spinIndex];
    this.audio.playChime(320 + newJ * 165, 0.24, 0.055);
    this.callbacks.onInteractionNote(`스핀 링크 여기: j = ${newJ.toFixed(1)} (양자 면적 고유값 증가)`);
    this.emitMetricsNow();
  }

  // =========================================================================
  // MODE 3: HOLOGRAPHY — AdS/CFT POINCARÉ BULK & ER=EPR ENTANGLEMENT ARCS
  // =========================================================================
  private initHolographyMode(): void {
    const R = this.boundaryRadius;

    // 1. Conformal Boundary Shell (CFT_2 Fresnel Optical Sphere)
    this.boundaryShellMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x38bdf8) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mv.xyz;
          vWorldPos = position;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.6);
          float latGrid = smoothstep(0.94, 0.99, abs(sin(vWorldPos.y * 4.2)));
          float lonGrid = smoothstep(0.95, 0.995, abs(sin(atan(vWorldPos.z, vWorldPos.x) * 8.0)));
          float grid = max(latGrid, lonGrid) * 0.22;
          float alpha = clamp(fresnel * 0.58 + grid, 0.03, 0.72);
          gl_FragColor = vec4(uColor * (0.75 + fresnel * 0.6), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.boundarySphere = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 36), this.boundaryShellMat);
    this.boundarySphere.position.y = 0.25;
    this.holographyGroup.add(this.boundarySphere);

    // 2. Boundary CFT Conformal Operator Lattice Points (InstancedMesh)
    const opCount = 96;
    const opGeo = new THREE.SphereGeometry(0.048, 10, 8);
    const opMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd });
    this.boundaryOperatorsInst = new THREE.InstancedMesh(opGeo, opMat, opCount);
    this.boundaryOperatorsInst.frustumCulled = false;

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < opCount; i++) {
      const y = 1 - (i / (opCount - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      _mat4.makeTranslation(Math.cos(theta) * rad * R, y * R + 0.25, Math.sin(theta) * rad * R);
      this.boundaryOperatorsInst.setMatrixAt(i, _mat4);
    }
    this.boundaryOperatorsInst.instanceMatrix.needsUpdate = true;
    this.holographyGroup.add(this.boundaryOperatorsInst);

    // 3. Central Bulk Black Hole Horizon (grows with bulkHorizonRadius)
    const bhGeo = new THREE.SphereGeometry(1, 36, 28);
    const bhMat = new THREE.MeshStandardMaterial({
      color: 0x040710,
      roughness: 0.14,
      metalness: 0.94,
    });
    this.bulkHorizonMesh = new THREE.Mesh(bhGeo, bhMat);
    this.bulkHorizonMesh.position.y = 0.25;
    this.holographyGroup.add(this.bulkHorizonMesh);

    const bhGlowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
    });
    this.bulkHorizonGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(1.06, 2), bhGlowMat);
    this.bulkHorizonGlow.position.y = 0.25;
    this.holographyGroup.add(this.bulkHorizonGlow);

    // 4. Build initial Ryu-Takayanagi / ER=EPR geodesic curves
    this.rebuildEntanglementArcs(false);
  }

  /**
   * Computes a smooth 3D hyperbolic geodesic inside the Poincaré Ball of radius R,
   * deflected smoothly around the central bulk black hole horizon of radius rH
   * (visualizing the Ryu-Takayanagi minimal surface wrapping the horizon).
   */
  private createGeodesicCurve(pA: THREE.Vector3, pB: THREE.Vector3, horizonR: number): { curve: THREE.CatmullRomCurve3; length: number } {
    const R = this.boundaryRadius;
    const pts: THREE.Vector3[] = [];
    const steps = 22;

    // Chord midpoint and radial dip into AdS bulk
    const mid = _v1.addVectors(pA, pB).multiplyScalar(0.5);
    const midLen = mid.length();
    const chordLen = pA.distanceTo(pB);
    // Hyperbolic geodesics dive deeper toward the origin when boundary endpoints are further apart
    const dipRatio = THREE.MathUtils.clamp(1.0 - chordLen / (2.0 * R), 0.1, 0.92);
    const minSafeR = Math.max(0.18, horizonR + 0.24);

    // Deterministic perpendicular axis if points are nearly antipodal
    const fallbackDir = new THREE.Vector3(0, 1, 0).cross(pA).normalize();
    if (fallbackDir.lengthSq() < 0.01) fallbackDir.set(1, 0, 0);

    const midDir = midLen > 0.08 ? mid.clone().divideScalar(midLen) : fallbackDir;

    let length = 0;
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      // Spherical linear-like blend between pA and pB, pulled inward by sine arch
      const p = new THREE.Vector3().lerpVectors(pA, pB, s);
      const arch = Math.sin(s * Math.PI);
      const targetRadialScale = THREE.MathUtils.lerp(1.0, dipRatio * 0.72, arch);

      const pLen = p.length();
      if (pLen > 0.001) {
        p.multiplyScalar((R * targetRadialScale) / pLen);
      } else {
        p.copy(midDir).multiplyScalar(minSafeR);
      }

      // Ryu-Takayanagi horizon avoidance: push geodesic smoothly outside the bulk black hole horizon
      const curR = p.length();
      if (curR < minSafeR) {
        const pushDir = curR > 0.02 ? p.clone().divideScalar(curR) : midDir;
        p.copy(pushDir).multiplyScalar(minSafeR);
      }

      p.y += 0.25; // align with boundary sphere center
      if (pts.length > 0) {
        length += p.distanceTo(pts[pts.length - 1]);
      }
      pts.push(p);
    }

    return { curve: new THREE.CatmullRomCurve3(pts), length };
  }

  private rebuildEntanglementArcs(preserveUserArcs = true): void {
    const userPairs = preserveUserArcs
      ? this.entanglementArcs.filter((a) => a.isUserSpawned).map((a) => ({ a: a.pointA, b: a.pointB }))
      : [];

    for (const arc of this.entanglementArcs) {
      this.holographyGroup.remove(arc.mesh);
      arc.mesh.geometry.dispose();
      (arc.mesh.material as THREE.Material).dispose();
    }
    this.entanglementArcs = [];

    const R = this.boundaryRadius;
    const horizonR = this.params.bulkHorizonRadius * R;
    const targetPairs = Math.round(10 + this.params.entanglementDensity * 26);

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < targetPairs; i++) {
      // Deterministic well-distributed boundary pairs
      const idxA = i * 2;
      const idxB = (i * 5 + 7) % (targetPairs * 2 + 3);

      const yA = 1 - ((idxA % 48) / 47) * 2;
      const rA = Math.sqrt(Math.max(0, 1 - yA * yA));
      const tA = golden * idxA;
      const pA = new THREE.Vector3(Math.cos(tA) * rA * R, yA * R, Math.sin(tA) * rA * R);

      const yB = 1 - ((idxB % 48) / 47) * 2;
      const rB = Math.sqrt(Math.max(0, 1 - yB * yB));
      const tB = golden * idxB + 1.45;
      const pB = new THREE.Vector3(Math.cos(tB) * rB * R, yB * R, Math.sin(tB) * rB * R);

      this.addSingleEntanglementArc(pA, pB, horizonR, false, i * 0.45);
    }

    for (const up of userPairs) {
      this.addSingleEntanglementArc(up.a, up.b, horizonR, true, 0);
    }

    this.lastBuiltHorizon = this.params.bulkHorizonRadius;
    this.lastBuiltDensity = this.params.entanglementDensity;
  }

  private addSingleEntanglementArc(
    pA: THREE.Vector3,
    pB: THREE.Vector3,
    horizonR: number,
    isUserSpawned: boolean,
    phase: number,
  ): void {
    const { curve, length } = this.createGeodesicCurve(pA, pB, horizonR);
    const tubeGeo = new THREE.TubeGeometry(curve, 28, isUserSpawned ? 0.032 : 0.017, 7, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: isUserSpawned ? 0xfbbf24 : 0x22d3ee,
      transparent: true,
      opacity: isUserSpawned ? 0.92 : 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.holographyGroup.add(mesh);
    this.entanglementArcs.push({
      pointA: pA,
      pointB: pB,
      mesh,
      phase,
      length,
      isUserSpawned,
    });
  }

  public spawnEntangledPair(boundaryPoint?: THREE.Vector3): void {
    const R = this.boundaryRadius;
    const pA = boundaryPoint
      ? boundaryPoint.clone().sub(new THREE.Vector3(0, 0.25, 0)).normalize().multiplyScalar(R)
      : new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(R);

    // Opposite-ish hemisphere point so the geodesic probes deep into the AdS bulk
    const pB = pA
      .clone()
      .negate()
      .add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4))
      .normalize()
      .multiplyScalar(R);

    // Keep user-spawned arcs bounded to avoid unbounded memory
    const userArcs = this.entanglementArcs.filter((a) => a.isUserSpawned);
    if (userArcs.length >= 12) {
      const firstIdx = this.entanglementArcs.findIndex((a) => a.isUserSpawned);
      if (firstIdx >= 0) {
        const old = this.entanglementArcs.splice(firstIdx, 1)[0];
        this.holographyGroup.remove(old.mesh);
        old.mesh.geometry.dispose();
        (old.mesh.material as THREE.Material).dispose();
      }
    }

    const horizonR = this.params.bulkHorizonRadius * R;
    this.addSingleEntanglementArc(pA, pB, horizonR, true, this.elapsedTime);
    this.audio.playChime(440 + Math.random() * 240, 0.25, 0.05);
    this.callbacks.onInteractionNote('경계 얽힘 쌍 생성 — ER=EPR 벌크 측지선 연결 완료');
    this.emitMetricsNow();
  }

  private updateHolographyMode(_dt: number, t: number): void {
    this.boundaryShellMat.uniforms.uTime.value = t;
    this.holographyGroup.rotation.y = t * 0.1;

    const horizonR = Math.max(0.05, this.params.bulkHorizonRadius * this.boundaryRadius);
    this.bulkHorizonMesh.scale.setScalar(horizonR);
    this.bulkHorizonMesh.visible = this.params.bulkHorizonRadius > 0.02;
    this.bulkHorizonGlow.scale.setScalar(horizonR * 1.08);
    this.bulkHorizonGlow.visible = this.params.bulkHorizonRadius > 0.02;
    this.bulkHorizonGlow.rotation.y = -t * 0.35;

    // Rebuild geodesic arcs when horizon radius or entanglement density changed
    if (
      Math.abs(this.lastBuiltHorizon - this.params.bulkHorizonRadius) > 0.015 ||
      Math.abs(this.lastBuiltDensity - this.params.entanglementDensity) > 0.025
    ) {
      this.rebuildEntanglementArcs(true);
    }

    // Subtle holographic coherence pulse along entanglement arcs
    for (let i = 0; i < this.entanglementArcs.length; i++) {
      const arc = this.entanglementArcs[i];
      const mat = arc.mesh.material as THREE.MeshBasicMaterial;
      const baseOp = arc.isUserSpawned ? 0.78 : 0.44;
      mat.opacity = baseOp + 0.18 * Math.sin(t * 2.2 + arc.phase);
    }
  }

  // =========================================================================
  // PUBLIC API (Mode Switching, Parameter Updates, Camera Presets, Pause)
  // =========================================================================
  public setMode(mode: QuantumMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.hoveredLink = null;
    this.renderer.domElement.style.cursor = 'grab';
    this.applyModeVisibility();
    this.setCameraPreset('default');
    this.emitMetricsNow();
  }

  private applyModeVisibility(): void {
    this.spacetimeGroup.visible = this.mode === 'spacetime';
    this.lqgGroup.visible = this.mode === 'lqg';
    this.holographyGroup.visible = this.mode === 'holography';
  }

  public updateParams(next: SimulationParams): void {
    this.params = { ...next };
    this.emitMetricsNow();
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public setCameraPreset(preset: CameraPreset): void {
    if (preset === 'default') {
      if (this.mode === 'spacetime') {
        this.cameraTargetPos = new THREE.Vector3(0.2, 6.2, 12.2);
        this.cameraTargetLook = new THREE.Vector3(0, -0.35, 0);
      } else {
        this.cameraTargetPos = new THREE.Vector3(0.4, 3.8, 11.4);
        this.cameraTargetLook = new THREE.Vector3(0, 0.15, 0);
      }
    } else if (preset === 'top') {
      this.cameraTargetPos = new THREE.Vector3(0, 14.2, 0.6);
      this.cameraTargetLook = new THREE.Vector3(0, -0.2, 0);
    } else if (preset === 'closeup') {
      if (this.mode === 'spacetime') {
        this.cameraTargetPos = new THREE.Vector3(2.8, 2.4, 5.2);
        this.cameraTargetLook = new THREE.Vector3(0, -0.5, 0);
      } else {
        this.cameraTargetPos = new THREE.Vector3(2.4, 1.5, 6.4);
        this.cameraTargetLook = new THREE.Vector3(0, 0.2, 0);
      }
    }
  }

  public triggerPrimaryExperiment(): void {
    if (this.mode === 'spacetime') {
      this.spawnGeodesicPhoton();
      this.callbacks.onInteractionNote('테스트 광자 발사 — 시공 곡률 및 양자 분산 경로 관측');
    } else if (this.mode === 'lqg') {
      this.triggerBigBounce();
    } else {
      this.spawnEntangledPair();
    }
  }

  // =========================================================================
  // POINTER INTERACTION & RAYCASTING
  // =========================================================================
  private updatePointerNDC(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownPos.x = e.clientX;
    this.pointerDownPos.y = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    // Only treat as a click if pointer barely moved (not an orbit drag)
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return;

    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(_pointer, this.camera);

    if (this.mode === 'spacetime') {
      const hitPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.photonHitPlane, hitPoint)) {
        const dist = Math.sqrt(hitPoint.x * hitPoint.x + hitPoint.z * hitPoint.z);
        if (dist > 0.7 && dist < 5.4) {
          // Launch a grazing photon aimed slightly tangential to the central singularity
          const toCenter = new THREE.Vector3(-hitPoint.x, 0, -hitPoint.z).normalize();
          const tangent = new THREE.Vector3(-toCenter.z, 0, toCenter.x);
          const vel = toCenter.multiplyScalar(2.45).add(tangent.multiplyScalar(1.95));
          this.spawnGeodesicPhoton(new THREE.Vector3(hitPoint.x, 0, hitPoint.z), vel);
          this.callbacks.onInteractionNote('클릭 지점에서 측지선 광자 발사');
        }
      }
    } else if (this.mode === 'lqg') {
      const edgeMeshes = this.lqgEdges.map((edge) => edge.mesh);
      const hits = this.raycaster.intersectObjects(edgeMeshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.lqgEdgeIndex as number | undefined;
        if (typeof idx === 'number' && this.lqgEdges[idx]) {
          this.exciteSpinLink(this.lqgEdges[idx]);
        }
      }
    } else if (this.mode === 'holography') {
      const hits = this.raycaster.intersectObject(this.boundarySphere, false);
      if (hits.length > 0) {
        // Convert world hit point into holographyGroup local space
        const localHit = this.holographyGroup.worldToLocal(hits[0].point.clone());
        this.spawnEntangledPair(localHit);
      }
    }
  };

  private lastHoverCheck = 0;
  private onPointerMove = (e: PointerEvent): void => {
    if (this.mode !== 'lqg') {
      this.hoveredLink = null;
      return;
    }
    const now = performance.now();
    if (now - this.lastHoverCheck < 55) return;
    this.lastHoverCheck = now;

    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(_pointer, this.camera);
    const edgeMeshes = this.lqgEdges.map((edge) => edge.mesh);
    const hits = this.raycaster.intersectObjects(edgeMeshes, false);

    if (hits.length > 0) {
      const idx = hits[0].object.userData.lqgEdgeIndex as number | undefined;
      if (typeof idx === 'number' && this.lqgEdges[idx]) {
        this.hoveredLink = this.lqgEdges[idx];
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
    this.hoveredLink = null;
    this.renderer.domElement.style.cursor = 'grab';
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private onContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('resize', this.onResize);
  }

  // =========================================================================
  // METRICS & RENDER LOOP (with Software WebGL afterDraw pacing)
  // =========================================================================
  private emitMetricsNow(): void {
    const spacetimeM = computeSpacetimeMetrics(this.params, this.photons.length);
    const spins = this.lqgEdges.map((e) => SPIN_VALUES[e.spinIndex]);
    const lqgM = computeLqgMetrics(spins, this.lqgBaseNodes.length, this.params.immirziGamma, this.bouncePhase);

    let totalArcLen = 0;
    for (let i = 0; i < this.entanglementArcs.length; i++) {
      totalArcLen += this.entanglementArcs[i].length;
    }
    const holoM = computeHolographyMetrics(this.params, this.entanglementArcs.length, totalArcLen);

    this.callbacks.onMetricsUpdate({
      ...spacetimeM,
      ...lqgM,
      ...holoM,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
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

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.min(0.06, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const simDt = this.isPaused ? 0 : rawDt;
    this.elapsedTime += simDt;

    // Smooth camera preset damping
    if (this.cameraTargetPos && this.cameraTargetLook) {
      const lambda = 5.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraTargetPos.x, lambda, rawDt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraTargetPos.y, lambda, rawDt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraTargetPos.z, lambda, rawDt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.cameraTargetLook.x, lambda, rawDt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.cameraTargetLook.y, lambda, rawDt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.cameraTargetLook.z, lambda, rawDt);

      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.04) {
        this.cameraTargetPos = null;
        this.cameraTargetLook = null;
      }
    }

    this.controls.update();

    // Subtle ambient observatory gimbal precession
    this.observatory.outerGimbal.rotation.y = this.elapsedTime * 0.05;
    this.observatory.caliperGroup.rotation.y = -this.elapsedTime * 0.08;
    this.starField.rotation.y = this.elapsedTime * 0.012;

    // Update active physics simulation
    if (this.mode === 'spacetime') {
      this.updateSpacetimeMode(simDt, this.elapsedTime);
    } else if (this.mode === 'lqg') {
      this.updateLqgMode(simDt, this.elapsedTime);
    } else {
      this.updateHolographyMode(simDt, this.elapsedTime);
    }

    // Periodically sync real physics metrics to React HUD (~5Hz, zero churn)
    if (now - this.lastMetricsEmit > 220) {
      this.lastMetricsEmit = now;
      this.emitMetricsNow();
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);
    window.removeEventListener('resize', this.onResize);

    this.controls.dispose();
    this.observatory.dispose();
    this.starField.geometry.dispose();
    (this.starField.material as THREE.Material).dispose();

    // Dispose scene children recursively
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Line).isLine) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });

    if (this.scene.environment) {
      this.scene.environment.dispose();
    }
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
