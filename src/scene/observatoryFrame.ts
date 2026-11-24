import * as THREE from 'three';

/**
 * Generates a high-contrast procedural calibration dial CanvasTexture
 * with degree markings and subtle Planck coordinate ticks.
 */
function createCalibrationRingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;

    // Subtle concentric calibration circles
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.465, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.425, 0, Math.PI * 2);
    ctx.stroke();

    // Radial vernier ticks (every 2 degrees, major every 10, cardinal every 30)
    for (let deg = 0; deg < 360; deg += 2) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const isMid = deg % 10 === 0;
      const rOuter = size * 0.465;
      const rInner = isMajor ? size * 0.415 : isMid ? size * 0.435 : size * 0.45;

      ctx.strokeStyle = isMajor
        ? 'rgba(245, 158, 11, 0.72)'
        : isMid
          ? 'rgba(203, 213, 225, 0.55)'
          : 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = isMajor ? 2.5 : isMid ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
      ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
      ctx.stroke();

      if (isMajor) {
        ctx.save();
        ctx.translate(cx + Math.cos(rad) * (size * 0.382), cy + Math.sin(rad) * (size * 0.382));
        ctx.rotate(rad + Math.PI / 2);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
        ctx.font = '600 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg}°`, 0, 0);
        ctx.restore();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a soft radial contact shadow & observatory floor texture.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, size * 0.04, cx, cx, size * 0.49);
    grad.addColorStop(0, 'rgba(2, 6, 16, 0.78)');
    grad.addColorStop(0.45, 'rgba(6, 12, 24, 0.42)');
    grad.addColorStop(0.75, 'rgba(14, 116, 144, 0.09)');
    grad.addColorStop(1, 'rgba(6, 9, 17, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface ObservatoryFrameHandle {
  group: THREE.Group;
  outerGimbal: THREE.Mesh;
  caliperGroup: THREE.Group;
  dispose: () => void;
}

/**
 * Builds a composite multi-part PBR scientific containment apparatus
 * (machined titanium, anodized slate, brushed brass bezel, vernier calibration dial,
 * cardinal sensor pylons, and grounded contact shadow base) so all quantum gravity
 * specimens sit anchored in a tactile precision observatory instrument.
 */
export function buildObservatoryFrame(maxAnisotropy: number): ObservatoryFrameHandle {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  // 1. Primary Structural Material: Matte Anodized Slate Titanium (roughness 0.52, metalness 0.78)
  const slateTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x161f30,
    roughness: 0.52,
    metalness: 0.78,
  });
  // 2. Secondary Machined Material: Brushed Chamfered Brass (roughness 0.22, metalness 0.92)
  const brushedBrassMat = new THREE.MeshPhysicalMaterial({
    color: 0xc29552,
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
  // 3. Accent Material: Polished Carbon Ceramic (roughness 0.78, metalness 0.15) -> >=0.25 roughness delta!
  const ceramicHousingMat = new THREE.MeshStandardMaterial({
    color: 0x0d1320,
    roughness: 0.8,
    metalness: 0.12,
  });
  // 4. Calibrated Cyan Optical Marker
  const cyanMarkerMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.4,
  });
  materials.push(slateTitaniumMat, brushedBrassMat, ceramicHousingMat, cyanMarkerMat);

  // Part 1: Main Equatorial Containment Ring (LatheGeometry with beveled industrial profile)
  const ringProfile = [
    new THREE.Vector2(6.08, -0.18),
    new THREE.Vector2(6.58, -0.18),
    new THREE.Vector2(6.72, -0.06),
    new THREE.Vector2(6.72, 0.08),
    new THREE.Vector2(6.55, 0.18),
    new THREE.Vector2(6.08, 0.18),
    new THREE.Vector2(5.98, 0.09),
    new THREE.Vector2(5.98, -0.09),
    new THREE.Vector2(6.08, -0.18),
  ];
  const mainRingGeo = new THREE.LatheGeometry(ringProfile, 96);
  geometries.push(mainRingGeo);
  const mainRing = new THREE.Mesh(mainRingGeo, slateTitaniumMat);
  mainRing.position.y = -2.45;
  mainRing.receiveShadow = true;
  group.add(mainRing);

  // Part 2: Upper Brushed Brass Vernier Bezel Ring
  const brassBezelGeo = new THREE.TorusGeometry(6.28, 0.048, 18, 96);
  brassBezelGeo.rotateX(Math.PI / 2);
  geometries.push(brassBezelGeo);
  const brassBezel = new THREE.Mesh(brassBezelGeo, brushedBrassMat);
  brassBezel.position.y = -2.26;
  group.add(brassBezel);

  // Part 3: Inner Recessed Ceramic Collar
  const innerCollarGeo = new THREE.TorusGeometry(5.96, 0.055, 16, 96);
  innerCollarGeo.rotateX(Math.PI / 2);
  geometries.push(innerCollarGeo);
  const innerCollar = new THREE.Mesh(innerCollarGeo, ceramicHousingMat);
  innerCollar.position.y = -2.35;
  group.add(innerCollar);

  // Part 4: Engraved Calibration Dial Plate (CanvasTexture with SRGBColorSpace & max anisotropy)
  const dialTex = createCalibrationRingTexture(maxAnisotropy);
  textures.push(dialTex);
  const dialGeo = new THREE.RingGeometry(4.4, 6.18, 96);
  dialGeo.rotateX(-Math.PI / 2);
  geometries.push(dialGeo);
  const dialMat = new THREE.MeshBasicMaterial({
    map: dialTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  materials.push(dialMat);
  const dialMesh = new THREE.Mesh(dialGeo, dialMat);
  dialMesh.position.y = -2.24;
  group.add(dialMesh);

  // Part 5: Four Cardinal Precision Interferometer Pylons (grounded on the ring)
  const pylonBaseGeo = new THREE.BoxGeometry(0.46, 0.56, 0.72);
  const pylonCapGeo = new THREE.CylinderGeometry(0.11, 0.15, 0.28, 20);
  const sensorTipGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12);
  geometries.push(pylonBaseGeo, pylonCapGeo, sensorTipGeo);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const pylon = new THREE.Group();
    pylon.position.set(Math.cos(angle) * 6.38, -2.22, Math.sin(angle) * 6.38);
    pylon.rotation.y = -angle + Math.PI / 2;

    const housing = new THREE.Mesh(pylonBaseGeo, ceramicHousingMat);
    housing.position.y = 0.22;
    pylon.add(housing);

    const brassMount = new THREE.Mesh(pylonCapGeo, brushedBrassMat);
    brassMount.position.set(0, 0.56, -0.1);
    pylon.add(brassMount);

    const tip = new THREE.Mesh(sensorTipGeo, cyanMarkerMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.34, -0.42);
    pylon.add(tip);

    group.add(pylon);
  }

  // Part 6: Subtle Tilted Precision Outer Gimbal Arc (slowly precessing meridian ring)
  const gimbalGeo = new THREE.TorusGeometry(6.85, 0.022, 12, 112);
  geometries.push(gimbalGeo);
  const outerGimbal = new THREE.Mesh(gimbalGeo, brushedBrassMat);
  outerGimbal.position.y = 0.15;
  outerGimbal.rotation.x = Math.PI * 0.44;
  outerGimbal.rotation.z = Math.PI * 0.08;
  group.add(outerGimbal);

  // Part 7: Equatorial Alignment Caliper Group (subtle measurement ticks floating cleanly at perimeter)
  const caliperGroup = new THREE.Group();
  const caliperArcGeo = new THREE.TorusGeometry(6.48, 0.014, 10, 96, Math.PI * 0.32);
  caliperArcGeo.rotateX(Math.PI / 2);
  geometries.push(caliperArcGeo);

  for (let i = 0; i < 2; i++) {
    const arc = new THREE.Mesh(caliperArcGeo, cyanMarkerMat);
    arc.position.y = -2.2;
    arc.rotation.y = i * Math.PI + 0.25;
    caliperGroup.add(arc);
  }
  group.add(caliperGroup);

  // Part 8: Grounded Observatory Floor Contact Shadow Plane (offset well below ring, no Z-fighting)
  const shadowTex = createContactShadowTexture();
  textures.push(shadowTex);
  const shadowPlaneGeo = new THREE.PlaneGeometry(18, 18);
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  geometries.push(shadowPlaneGeo);
  const shadowPlaneMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  materials.push(shadowPlaneMat);
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.position.y = -3.35;
  group.add(shadowPlane);

  // Part 9: Subtle Deep Background Polar Coordinate Reference Floor Grid
  const polarGrid = new THREE.PolarGridHelper(9.5, 12, 6, 64, 0x1b2942, 0x111a2d);
  polarGrid.position.y = -3.32;
  const gridMat = polarGrid.material as THREE.Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.42;
  group.add(polarGrid);

  return {
    group,
    outerGimbal,
    caliperGroup,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      polarGrid.geometry.dispose();
      (polarGrid.material as THREE.Material).dispose();
    },
  };
}
