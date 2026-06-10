/* ============================================================================
   DUSTSHIELD DIGITAL TWIN // THREE.JS RENDERER & SIMULATION ENGINE
   ============================================================================ */

'use strict';

// ─── Scene globals ───────────────────────────────────────────────────────────
let scene, camera, renderer, controls, clock;
let moonMesh, starField;
let surfaceGroup, roverMesh, groundMesh, dustPoints;

// ─── Simulation State ────────────────────────────────────────────────────────
const state = {
  mode: 'orbit',         // 'orbit' | 'descending' | 'surface' | 'ascending'
  edsActive: false,      // is electrostatic clearing active?
  voltage: 1250,         // Volts (0-2000)
  frequency: 60,         // Hz (1-100)
  phase: 3,              // 2-phase or 3-phase
  dustCoverage: 100,     // Coverage percentage (0-100)
  solarEfficiency: 0,    // Solar cell efficiency percentage (0-100)
  hardwareConnected: false // Mock MCU UART status
};

// ─── Animation & Transition State ───────────────────────────────────────────
let transitionTime = 0;
const transitionDuration = 2.0; // seconds for zoom
const startCamPos = new THREE.Vector3();
const targetCamPos = new THREE.Vector3();
const startControlsTarget = new THREE.Vector3();
const targetControlsTarget = new THREE.Vector3();
let selectedLat = 0;
let selectedLon = 0;

// ─── Rover Loader State ──────────────────────────────────────────────────────
let isRoverLoading = false;
let roverLoaded = false;

// ─── Dust Particle Physics Data ─────────────────────────────────────────────
const totalParticles = 380;
const particles = [];
let dustPositionsAttr, dustColorsAttr;
let dustMaterial;

const MAX_PARTICLES = 600;
const LUNAR_GRAVITY = -1.62 * 0.3;

const dustSystem = {
  panelMeshes: [],
  panelBoxes: [],
  panelSurfaces: [],
  stuckCounts: [],
  usingFallback: false
};

// ─── DOM References ─────────────────────────────────────────────────────────
let elSliderVoltage, elDisplayVoltage;
let elSliderFrequency, elDisplayFrequency;
let elPhaseButtons;
let elBtnActivate, elBtnActivateText;
let elBtnReset;
let elBtnHardware, elHardwareStatusText;
let elBtnReturnOrbit, elDescentHud, elHudCoords, elHudStatus;
let elValueCoverage, elProgressCoverage;
let elValueEfficiency, elProgressEfficiency;
let elConsoleTime;

let hardwareTimer = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('threejs-container');
  if (!container) return;

  const W = container.clientWidth;
  const H = container.clientHeight;

  // ── Clock ──────────────────────────────────────────────────────────────────
  clock = new THREE.Clock();

  // ── Scene ──────────────────────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000005); // Near-black deep space

  // ── Camera ─────────────────────────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);
  camera.position.set(0, 0, 3.2);

  // ── Renderer ───────────────────────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // ── Orbit Controls ─────────────────────────────────────────────────────────
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.minDistance = 1.4;
  controls.maxDistance = 12;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;
  controls.enablePan = false;

  // ── Lighting ───────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x111122, 0.25);
  scene.add(ambient);

  const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.2);
  sunLight.position.set(5, 2, 3);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x203060, 0.18);
  fillLight.position.set(-4, -1, -3);
  scene.add(fillLight);

  // ── Moon Globe ─────────────────────────────────────────────────────────────
  buildMoon();

  // ── Star Field ─────────────────────────────────────────────────────────────
  buildStars();

  // ── Surface Scene Setup (Terrain, Rover and Particles Group) ───────────────
  surfaceGroup = new THREE.Group();
  surfaceGroup.visible = false;
  scene.add(surfaceGroup);

  loadLunarTerrain();
  buildDustParticles();
  loadRover();

  // ── UI Events Binding ──────────────────────────────────────────────────────
  bindUIEvents();

  // ── Landing Button (replaces raycaster) ────────────────────────────────────
  const btnLand = document.getElementById('btn-land');
  if (btnLand) {
    btnLand.addEventListener('click', () => {
      initiateDescent();
    });
  }

  // ── Resize handler ─────────────────────────────────────────────────────────
  window.addEventListener('resize', onResize);

  // ── Start loop ─────────────────────────────────────────────────────────────
  renderer.setAnimationLoop(tick);
}

// ─── Moon Construction ────────────────────────────────────────────────────────
function buildMoon() {
  const loader = new THREE.TextureLoader();

  const moonTex = loader.load(
    'assets/nasa/moon.jpg',
    (tex) => {
      writeLog('Moon texture loaded successfully.', 'success');
    },
    undefined,
    () => writeLog('Failed to load Moon texture.', 'error')
  );

  const geo = new THREE.SphereGeometry(1, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 1.0,
    metalness: 0.0,
  });

  moonMesh = new THREE.Mesh(geo, mat);
  moonMesh.rotation.z = THREE.MathUtils.degToRad(1.5);
  scene.add(moonMesh);
}

// ─── Procedural Star Field ────────────────────────────────────────────────────
function buildStars() {
  const starCount = 6000;
  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const alphas = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 800 + Math.random() * 200;

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    sizes[i]  = Math.random() < 0.05 ? (2.5 + Math.random() * 1.5) : (0.6 + Math.random() * 0.8);
    alphas[i] = 0.5 + Math.random() * 0.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('alpha',    new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 }
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying float vAlpha;
      uniform float uTime;

      void main() {
        vAlpha = alpha;
        float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + position.x * 0.01 + position.y * 0.007);
        vAlpha *= twinkle;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        float alpha = vAlpha * smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  starField = new THREE.Points(geo, mat);
  scene.add(starField);
}


// ─── Lunar Terrain Loader (GLB Asset) ────────────────────────────────────────
// Loads assets/nasa/lunar_surface.glb and scales it to fit the surface camera
// viewport (maxDistance ≈ 1.6 units). A clipping plane removes geometry beyond
// the visible radius so the GPU never processes unseen terrain.
function loadLunarTerrain() {
  const loader = new THREE.GLTFLoader();
  writeLog('Loading lunar surface terrain (lunar_surface.glb)...', 'info');

  loader.load(
    'assets/nasa/lunar_surface.glb',
    (gltf) => {
      const terrainRoot = gltf.scene;

      // ── Measure the raw asset bounds ──────────────────────────────────────
      const box = new THREE.Box3().setFromObject(terrainRoot);
      const size = new THREE.Vector3();
      box.getSize(size);

      // We want the terrain to fill roughly the surface camera's max view
      // distance. The camera maxDistance is 1.6 units; we target a diameter of
      // ~4 units so the terrain always extends slightly beyond the viewport.
      const TARGET_DIAMETER = 4.0;
      const rawMaxXZ = Math.max(size.x, size.z) || 1;
      const scaleFactor = TARGET_DIAMETER / rawMaxXZ;

      terrainRoot.scale.setScalar(scaleFactor);

      // Re-compute bounds after scaling and centre the mesh at world origin
      terrainRoot.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(terrainRoot);
      const centre = new THREE.Vector3();
      scaledBox.getCenter(centre);

      // Shift so the terrain surface sits at y = -0.2 (rover / panel base)
      const scaledFloor = scaledBox.min.y;
      terrainRoot.position.set(
        -centre.x,
        -scaledFloor - 0.2,
        -centre.z
      );

      // ── Apply material tweaks for lunar look ──────────────────────────────
      terrainRoot.traverse((child) => {
        if (!child.isMesh) return;
        child.receiveShadow = false;
        child.castShadow   = false;

        // Ensure every mesh has at least a Standard material so lighting works
        if (!child.material || child.material.isMeshBasicMaterial) {
          child.material = new THREE.MeshStandardMaterial({
            color:     0x2a2b2e,
            roughness: 0.95,
            metalness: 0.02,
          });
        } else {
          // Darken to lunar grey if the asset's albedo is very bright
          if (child.material.color) {
            const c = child.material.color;
            const luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
            if (luma > 0.55) child.material.color.multiplyScalar(0.45);
          }
          child.material.roughness = Math.max(child.material.roughness ?? 0, 0.85);
          child.material.metalness = Math.min(child.material.metalness ?? 0, 0.05);
        }

        // Clip geometry beyond a radius of 2.2 units from the scene centre
        // so we don't render terrain the camera can never see.
        renderer.clippingPlanes = [];
        child.material.clippingPlanes = [
          new THREE.Plane(new THREE.Vector3( 1,  0,  0), 2.2),
          new THREE.Plane(new THREE.Vector3(-1,  0,  0), 2.2),
          new THREE.Plane(new THREE.Vector3( 0,  0,  1), 2.2),
          new THREE.Plane(new THREE.Vector3( 0,  0, -1), 2.2),
        ];
        child.material.clipIntersection = false;
        child.material.needsUpdate = true;
      });

      // Enable clipping on the renderer
      renderer.localClippingEnabled = true;

      groundMesh = terrainRoot;
      surfaceGroup.add(terrainRoot);

      writeLog('Lunar surface terrain loaded from GLB asset.', 'success');
    },
    undefined,
    (err) => {
      writeLog('lunar_surface.glb failed to load — using minimal fallback plane.', 'warning');
      _buildFallbackTerrain();
    }
  );
}

// ─── Minimal Fallback Terrain (if GLB load fails) ────────────────────────────
function _buildFallbackTerrain() {
  const geo = new THREE.PlaneGeometry(4, 4, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    let h = Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.04;
    h += (Math.random() - 0.5) * 0.015;
    posAttr.setY(i, -0.2 + h);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x242528, roughness: 0.95, metalness: 0.02 });
  groundMesh = new THREE.Mesh(geo, mat);
  surfaceGroup.add(groundMesh);
}


// ─── Dust Panel Detection (hierarchy-based) ───────────────────────────────────
// Traverses the rover GLB hierarchy and targets any mesh whose parent Object3D
// name contains "panels". This replaces all prior color-detection fallback logic.
function detectDustPanels(root) {
  dustSystem.panelMeshes  = [];
  dustSystem.panelBoxes   = [];
  dustSystem.panelSurfaces = [];
  dustSystem.stuckCounts  = [];

  root.updateMatrixWorld(true);

  root.traverse((child) => {
    const parentName = child.parent?.name?.toLowerCase() || '';
    if (child.isMesh && parentName.includes('panels')) {
      child.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(child);

      console.log('SOLAR PANEL DETECTED:', child.name);
      console.log('  Box3 min:', box.min);
      console.log('  Box3 max:', box.max);

      dustSystem.panelMeshes.push(child);
      dustSystem.panelBoxes.push(box);
      dustSystem.panelSurfaces.push(box.max.y);
      dustSystem.stuckCounts.push(0);
    }
  });

  const n = dustSystem.panelMeshes.length;
  if (n > 0) {
    dustSystem.usingFallback = false;
    writeLog(`[DustShield] Detected ${n} solar panel mesh(es) via rover hierarchy. Targeting for dust simulation.`, 'success');
  } else {
    writeLog('[DustShield] No panel meshes found in rover hierarchy. Check GLB node names.', 'warning');
  }

  rebuildParticlesForPanels();
}

// ─── Dust Particles Generator (No-op placeholder) ────────────────────────────
// Real particles are built after rover load + detectDustPanels() completes.
function buildDustParticles() {}

// ─── Particle Pool Builder (targeting detected panel surfaces) ────────────────
function rebuildParticlesForPanels() {
  particles.length = 0;
  if (dustPoints) {
    surfaceGroup.remove(dustPoints);
    dustPoints.geometry.dispose();
    dustPoints = null;
  }

  const panelCount = dustSystem.panelBoxes.length;
  if (panelCount === 0) return;

  const count = MAX_PARTICLES;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const pIdx = Math.floor(Math.random() * panelCount);
    const box  = dustSystem.panelBoxes[pIdx];
    const surfY = dustSystem.panelSurfaces[pIdx];

    // Irregular scatter: bias spawn toward random sub-clusters within the panel
    // to avoid a uniform rectangle fill.
    const clusterU = Math.random();
    const clusterV = Math.random();
    const jitterU  = (Math.random() - 0.5) * 0.35;
    const jitterV  = (Math.random() - 0.5) * 0.35;
    const u = Math.max(0, Math.min(1, clusterU + jitterU));
    const v = Math.max(0, Math.min(1, clusterV + jitterV));

    const px = box.min.x + u * (box.max.x - box.min.x);
    const pz = box.min.z + v * (box.max.z - box.min.z);
    const py = surfY + 0.0005 + Math.random() * 0.0008;

    positions[i * 3]     = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    // Colour: warm grey-beige regolith tones with subtle variation
    const t = Math.random();
    colors[i * 3]     = 0.72 + t * 0.10;  // R
    colors[i * 3 + 1] = 0.68 + t * 0.08;  // G
    colors[i * 3 + 2] = 0.58 + t * 0.06;  // B

    particles.push({
      x: px, y: py, z: pz,
      vx: 0, vy: 0, vz: 0,
      stuck: true,
      panelIdx: pIdx,
      active: true,
      sizeClass: Math.random() < 0.15 ? 'large' : (Math.random() < 0.5 ? 'medium' : 'small')
    });

    dustSystem.stuckCounts[pIdx] = (dustSystem.stuckCounts[pIdx] || 0) + 1;
  }

  const geo = new THREE.BufferGeometry();
  dustPositionsAttr = new THREE.BufferAttribute(positions, 3);
  dustColorsAttr    = new THREE.BufferAttribute(colors, 3);
  geo.setAttribute('position', dustPositionsAttr);
  geo.setAttribute('color', dustColorsAttr);

  dustMaterial = new THREE.PointsMaterial({
    size: 0.006,
    map: createDustTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  dustPoints = new THREE.Points(geo, dustMaterial);
  surfaceGroup.add(dustPoints);

  writeLog(`[DustShield] ${count} regolith particles initialised on ${panelCount} panel surface(s).`, 'info');
}

// Crisp hard-edged grain texture — resembles a microscopic regolith speck.
// No soft gradient / fog falloff.
function createDustTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Hard circular core with a razor-thin anti-alias ring
  const cx = 8, cy = 8;
  ctx.clearRect(0, 0, 16, 16);

  // Outer anti-alias halo (very thin, radius 6)
  const halo = ctx.createRadialGradient(cx, cy, 4.5, cx, cy, 6.5);
  halo.addColorStop(0.0, 'rgba(255,255,255,0.18)');
  halo.addColorStop(1.0, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 16, 16);

  // Crisp filled disc core
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

// ─── Rover 3D Loader & Fallback Builder ──────────────────────────────────────
function loadRover() {
  const loader = new THREE.GLTFLoader();
  isRoverLoading = true;
  writeLog('Loading lunar rover GLTF model...', 'info');

  loader.load(
    'assets/nasa/rover.glb',
    (gltf) => {
      roverMesh = gltf.scene;

      // ── Scale to fit the surface scene ──────────────────────────────────
      const box = new THREE.Box3().setFromObject(roverMesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = 0.65 / (maxDim || 1);
      roverMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      roverMesh.position.set(0, -0.2, 0);

      // ── Material quality pass ────────────────────────────────────────────
      roverMesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          if (child.material) {
            child.material.roughness = Math.max(child.material.roughness, 0.35);
          }
        }
      });

      surfaceGroup.add(roverMesh);
      isRoverLoading = false;
      roverLoaded = true;
      writeLog('Rover 3D model loaded successfully.', 'success');

      // ── Detect solar panels via GLB node hierarchy ───────────────────────
      // Must run after the rover is added to the scene so world matrices are valid.
      detectDustPanels(roverMesh);
    },
    undefined,
    (err) => {
      isRoverLoading = false;
      writeLog('Rover model load failed. Constructing procedural fallback (no dust panels).', 'warning');
      buildProceduralRover();
      // Procedural rover has no "panels" hierarchy — dust sim stays inactive.
    }
  );
}

function buildProceduralRover() {
  const chassisGeo = new THREE.BoxGeometry(0.38, 0.18, 0.6);
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x76787e,
    roughness: 0.35,
    metalness: 0.8
  });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.set(0, 0.05, 0);
  
  const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x18181a,
    roughness: 0.85,
    metalness: 0.1
  });
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelPositions = [
    [-0.21, -0.05, 0.18],
    [ 0.21, -0.05, 0.18],
    [-0.21, -0.05, -0.18],
    [ 0.21, -0.05, -0.18]
  ];

  wheelPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(pos[0], pos[1], pos[2]);
    chassis.add(wheel);
  });

  const mastGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x56585e, metalness: 0.6 });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 0.2, 0.22);
  chassis.add(mast);
  
  const headGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.11, 0);
  mast.add(head);

  roverMesh = chassis;
  roverMesh.position.set(0, -0.2, 0);
  surfaceGroup.add(roverMesh);
  
  writeLog('Procedural rover constructed at origin.', 'success');
}

// ─── Landing Trigger (Button-driven) ────────────────────────────────────────
function initiateDescent() {
  if (state.mode !== 'orbit') return;

  // Derive landing point from current camera look direction → moon surface
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  // Cast from camera position along look direction, find where it hits unit sphere
  const point = camDir.clone().normalize();

  startCamPos.copy(camera.position);
  startControlsTarget.copy(controls.target);

  // Target: just above the surface (radius 1.08) in the camera forward direction
  targetCamPos.copy(point).multiplyScalar(1.08);
  targetControlsTarget.copy(point);

  // Compute lat/lon from the landing normal
  const phi   = Math.acos(Math.min(1, Math.max(-1, point.y)));
  const theta = Math.atan2(point.z, point.x);
  selectedLat = 90 - (phi * 180 / Math.PI);
  selectedLon = theta * 180 / Math.PI;

  const latStr = `${Math.abs(selectedLat).toFixed(2)}° ${selectedLat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(selectedLon).toFixed(2)}° ${selectedLon >= 0 ? 'E' : 'W'}`;

  state.mode = 'descending';
  transitionTime = 0;

  controls.enabled = false;
  controls.autoRotate = false;

  const btnLand = document.getElementById('btn-land');
  if (btnLand) btnLand.style.display = 'none';

  if (elHudCoords) elHudCoords.textContent = `LAT: ${latStr} // LON: ${lonStr}`;
  if (elHudStatus) elHudStatus.textContent = 'STATUS: INITIATING RETRO-DESCENT BURN';
  if (elDescentHud) elDescentHud.style.display = 'flex';

  writeLog(`Landing sequence locked: LAT ${latStr}, LON ${lonStr}. Descending...`, 'info');
}

// ─── Ascent Handler ──────────────────────────────────────────────────────────
function initiateAscent() {
  if (state.mode !== 'surface') return;

  state.mode = 'ascending';
  transitionTime = 0;

  startCamPos.copy(camera.position);
  startControlsTarget.copy(controls.target);

  targetCamPos.set(0, 0, 3.2);
  targetControlsTarget.set(0, 0, 0);

  controls.enabled = false;
  controls.autoRotate = false;

  if (state.edsActive) {
    state.edsActive = false;
    if (elBtnActivate) elBtnActivate.classList.remove('active');
    if (elBtnActivateText) elBtnActivateText.textContent = 'ACTIVATE COULOMB CLEARING';
  }

  if (elHudStatus) elHudStatus.textContent = 'STATUS: ENGAGING ASCENT INJECTION THRUST';
  if (elDescentHud) elDescentHud.style.display = 'flex';
  if (elBtnReturnOrbit) elBtnReturnOrbit.style.display = 'none';

  writeLog('De-docking completed. Initiating orbital ascent sequence...', 'info');
}

// ─── UI Bindings & Event Logic ──────────────────────────────────────────────
function bindUIEvents() {
  elSliderVoltage = document.getElementById('slider-voltage');
  elDisplayVoltage = document.getElementById('display-voltage');
  elSliderFrequency = document.getElementById('slider-frequency');
  elDisplayFrequency = document.getElementById('display-frequency');
  
  const phaseSelector = document.getElementById('phase-selector');
  elPhaseButtons = phaseSelector ? phaseSelector.getElementsByClassName('btn-phase') : [];

  elBtnActivate = document.getElementById('btn-activate');
  elBtnActivateText = document.getElementById('btn-activate-text');
  elBtnReset = document.getElementById('btn-reset');
  elBtnHardware = document.getElementById('btn-hardware');
  elHardwareStatusText = document.getElementById('hardware-status-text');

  elBtnReturnOrbit = document.getElementById('btn-return-orbit');
  elDescentHud = document.getElementById('descent-hud');
  elHudCoords = document.getElementById('hud-coords');
  elHudStatus = document.getElementById('hud-status');

  elValueCoverage = document.getElementById('value-coverage');
  elProgressCoverage = document.getElementById('progress-coverage');
  elValueEfficiency = document.getElementById('value-efficiency');
  elProgressEfficiency = document.getElementById('progress-efficiency');

  elConsoleTime = document.getElementById('console-time');

  if (elSliderVoltage) {
    elSliderVoltage.addEventListener('input', (e) => {
      state.voltage = parseInt(e.target.value);
      if (elDisplayVoltage) elDisplayVoltage.textContent = state.voltage + 'V';
    });
    elSliderVoltage.addEventListener('change', () => {
      writeLog(`HV Field Output set to ${state.voltage}V.`, 'info');
    });
  }

  if (elSliderFrequency) {
    elSliderFrequency.addEventListener('input', (e) => {
      state.frequency = parseInt(e.target.value);
      if (elDisplayFrequency) elDisplayFrequency.textContent = state.frequency + 'Hz';
    });
    elSliderFrequency.addEventListener('change', () => {
      writeLog(`AC Frequency tuned to ${state.frequency}Hz.`, 'info');
    });
  }

  if (elPhaseButtons) {
    Array.from(elPhaseButtons).forEach(btn => {
      btn.addEventListener('click', () => {
        Array.from(elPhaseButtons).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.phase = parseInt(btn.getAttribute('data-phase'));
        writeLog(`Alternating wave config: ${state.phase}-Phase AC mode.`, 'info');
      });
    });
  }

  if (elBtnActivate) {
    elBtnActivate.addEventListener('click', () => {
      if (state.mode !== 'surface') {
        writeLog('Landing checklist incomplete. System locked.', 'error');
        return;
      }
      state.edsActive = !state.edsActive;
      if (state.edsActive) {
        elBtnActivate.classList.add('active');
        if (elBtnActivateText) elBtnActivateText.textContent = 'STOP COULOMB CLEARING';
        writeLog(`EDS SYSTEM ACTIVE // ${state.voltage}V AC // ${state.frequency}Hz // ${state.phase}-Phase.`, 'success');
      } else {
        elBtnActivate.classList.remove('active');
        if (elBtnActivateText) elBtnActivateText.textContent = 'ACTIVATE COULOMB CLEARING';
        writeLog('EDS SYSTEM DEACTIVATED // Voltage cut.', 'info');
      }
    });
  }

  if (elBtnReset) {
    elBtnReset.addEventListener('click', () => {
      resetDust();
      writeLog('Simulated regolith particles re-deposited. Coverage: 100%.', 'info');
    });
  }

  if (elBtnHardware) {
    elBtnHardware.addEventListener('click', () => {
      state.hardwareConnected = !state.hardwareConnected;
      if (state.hardwareConnected) {
        elBtnHardware.classList.add('active');
        elBtnHardware.innerHTML = `<span class="material-symbols-outlined">power_settings_new</span> DISCONNECT PHYSICAL MCU`;
        if (elHardwareStatusText) {
          elHardwareStatusText.className = 'status-connected';
          elHardwareStatusText.innerHTML = `<span class="material-symbols-outlined">link</span> UART: CONNECTED (ESP32-C3)`;
        }
        writeLog('MCU UART Connection verified via COM3 (ESP32-C3). Telemetry sync active.', 'success');
        
        simulateMicrocontrollerSignals();
      } else {
        elBtnHardware.classList.remove('active');
        elBtnHardware.innerHTML = `<span class="material-symbols-outlined">power_settings_new</span> CONNECT PHYSICAL MCU`;
        if (elHardwareStatusText) {
          elHardwareStatusText.className = 'status-disconnected';
          elHardwareStatusText.innerHTML = `<span class="material-symbols-outlined">link_off</span> UART: DISCONNECTED`;
        }
        writeLog('MCU connection terminated.', 'info');
        if (hardwareTimer) {
          clearInterval(hardwareTimer);
          hardwareTimer = null;
        }
      }
    });
  }

  if (elBtnReturnOrbit) {
    elBtnReturnOrbit.addEventListener('click', () => {
      initiateAscent();
    });
  }
}

// ─── Microcontroller Mock UART Signals ──────────────────────────────────────
function simulateMicrocontrollerSignals() {
  if (!state.hardwareConnected) return;
  writeLog('ESP32-C3 handshake OK. Telemetry pipeline streaming.', 'success');

  if (hardwareTimer) clearInterval(hardwareTimer);
  hardwareTimer = setInterval(() => {
    if (!state.hardwareConnected) {
      clearInterval(hardwareTimer);
      return;
    }
    const rand = Math.random();
    if (rand < 0.25) {
      writeLog(`UART RX Telemetry Packet: { eds_active: ${state.edsActive ? 1 : 0}, v_out: ${state.voltage}V, freq: ${state.frequency}Hz }`, 'info');
    }
  }, 4000);
}

// (overlay system removed — dust is now represented exclusively by point particles)

// ─── Dust Re-deposition (Reset) ──────────────────────────────────────────────
function resetDust() {
  if (!dustPositionsAttr) return;
  const posArr = dustPositionsAttr.array;
  const panelCount = dustSystem.panelBoxes.length;

  for (let pi = 0; pi < panelCount; pi++) dustSystem.stuckCounts[pi] = 0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const pIdx = Math.floor(Math.random() * Math.max(1, panelCount));
    const box = panelCount > 0 ? dustSystem.panelBoxes[pIdx] : null;

    let px, pz, py;
    if (box) {
      px = box.min.x + Math.random() * (box.max.x - box.min.x);
      pz = box.min.z + Math.random() * (box.max.z - box.min.z);
      py = dustSystem.panelSurfaces[pIdx] + 0.001;
    } else {
      px = (Math.random() - 0.5) * 0.47;
      pz = (Math.random() - 0.5) * 0.37;
      py = 0.171;
    }

    p.x = px; p.y = py; p.z = pz;
    p.vx = 0; p.vy = 0; p.vz = 0;
    p.stuck = true;
    p.active = true;
    p.panelIdx = pIdx;

    posArr[i * 3]     = px;
    posArr[i * 3 + 1] = py;
    posArr[i * 3 + 2] = pz;

    if (panelCount > 0) dustSystem.stuckCounts[pIdx]++;
  }

  dustPositionsAttr.needsUpdate = true;
  
  state.dustCoverage = 100;
  state.solarEfficiency = 0;

  if (elValueCoverage) elValueCoverage.textContent = 100;
  if (elProgressCoverage) {
    elProgressCoverage.style.width = '100%';
    elProgressCoverage.className = 'progress-bar-fill fill-error';
    const icon = document.querySelector('.telemetry-card:first-child .telemetry-status-icon');
    if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-error animate-pulse';
  }

  if (elValueEfficiency) elValueEfficiency.textContent = 0;
  if (elProgressEfficiency) {
    elProgressEfficiency.style.width = '0%';
    elProgressEfficiency.className = 'progress-bar-fill fill-error';
    const icon = document.querySelector('.telemetry-card:nth-child(2) .telemetry-status-icon');
    if (icon) icon.style.color = 'var(--color-error)';
  }

  if (state.edsActive) {
    state.edsActive = false;
    if (elBtnActivate) elBtnActivate.classList.remove('active');
    if (elBtnActivateText) elBtnActivateText.textContent = 'ACTIVATE COULOMB CLEARING';
  }
}

// ─── Dust Physics Updates ────────────────────────────────────────────────────
function updateDustSimulation(deltaTime, elapsed) {
  if (!dustPositionsAttr || particles.length === 0) return;

  const phaseMultiplier = state.phase === 3 ? 1.5 : 0.8;
  const baseSpeed = (state.voltage / 2000.0) * phaseMultiplier * 0.06;
  const freqHz = state.frequency;

  const posArr = dustPositionsAttr.array;
  const panelCount = dustSystem.panelBoxes.length;
  const count = particles.length;

  // Reset stuck counts for re-tally each frame
  for (let pi = 0; pi < panelCount; pi++) dustSystem.stuckCounts[pi] = 0;

  for (let i = 0; i < count; i++) {
    const p = particles[i];

    if (!p.active) {
      posArr[i * 3] = 9999; posArr[i * 3 + 1] = 9999; posArr[i * 3 + 2] = 9999;
      continue;
    }

    if (p.stuck) {
      // ── Particle adhered to panel surface ────────────────────────────────
      dustSystem.stuckCounts[p.panelIdx] = (dustSystem.stuckCounts[p.panelIdx] || 0) + 1;

      if (state.edsActive) {
        // AC traveling-wave force dislodges stuck particles
        const sizeFactor = p.sizeClass === 'small' ? 1.4 : p.sizeClass === 'large' ? 0.35 : 0.85;
        const speed = baseSpeed * sizeFactor;
        const dir = Math.sign(p.x) || (i % 2 === 0 ? 1 : -1);

        p.x += dir * speed * deltaTime;
        p.z += Math.sin(elapsed * freqHz * 0.35 + i * 0.7) * 0.0008 * (freqHz / 60);

        // Check if swept off panel edge
        const box = dustSystem.panelBoxes[p.panelIdx];
        if (box && (p.x < box.min.x - 0.01 || p.x > box.max.x + 0.01 ||
                    p.z < box.min.z - 0.01 || p.z > box.max.z + 0.01)) {
          p.stuck = false;
          p.vx = dir * Math.max(0.05, speed * 2.2);
          p.vy = 0.015 + Math.random() * 0.02;
          p.vz = (Math.random() - 0.5) * 0.025;
          dustSystem.stuckCounts[p.panelIdx] = Math.max(0, (dustSystem.stuckCounts[p.panelIdx] || 1) - 1);
        }
      } else {
        // Micro-Brownian motion while settled
        p.x += (Math.random() - 0.5) * 0.0003;
        p.z += (Math.random() - 0.5) * 0.0003;
        const box = dustSystem.panelBoxes[p.panelIdx];
        if (box) {
          p.x = Math.max(box.min.x, Math.min(box.max.x, p.x));
          p.z = Math.max(box.min.z, Math.min(box.max.z, p.z));
        }
      }
    } else {
      // ── Particle airborne ─────────────────────────────────────────────────
      p.vy += LUNAR_GRAVITY * deltaTime;
      p.vx *= 0.995;
      p.vz *= 0.995;

      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.z += p.vz * deltaTime;

      // Check adhesion against all panel surfaces
      for (let pi = 0; pi < panelCount; pi++) {
        const box = dustSystem.panelBoxes[pi];
        const surfY = dustSystem.panelSurfaces[pi];
        if (!box) continue;
        if (p.y <= surfY + 0.008 &&
            p.x >= box.min.x && p.x <= box.max.x &&
            p.z >= box.min.z && p.z <= box.max.z) {
          p.stuck = true;
          p.y = surfY + 0.001;
          p.vx = 0; p.vy = 0; p.vz = 0;
          p.panelIdx = pi;
          dustSystem.stuckCounts[pi]++;
          break;
        }
      }

      if (p.y < -2.0) p.active = false;
    }

    posArr[i * 3]     = p.x;
    posArr[i * 3 + 1] = p.y;
    posArr[i * 3 + 2] = p.z;
  }

  dustPositionsAttr.needsUpdate = true;

  // Aggregate coverage
  let totalStuck = 0;
  for (let pi = 0; pi < panelCount; pi++) totalStuck += dustSystem.stuckCounts[pi] || 0;

  const coverage   = Math.min(100, Math.round((totalStuck / count) * 100));
  const efficiency = Math.max(0, 100 - coverage);

  if (state.dustCoverage !== coverage) {
    state.dustCoverage = coverage;
    if (elValueCoverage) elValueCoverage.textContent = coverage;
    if (elProgressCoverage) {
      elProgressCoverage.style.width = coverage + '%';
      if (coverage > 60) {
        elProgressCoverage.className = 'progress-bar-fill fill-error';
        const icon = document.querySelector('.telemetry-card:first-child .telemetry-status-icon');
        if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-error animate-pulse';
      } else if (coverage > 15) {
        elProgressCoverage.className = 'progress-bar-fill fill-warning';
        const icon = document.querySelector('.telemetry-card:first-child .telemetry-status-icon');
        if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-warning';
      } else {
        elProgressCoverage.className = 'progress-bar-fill fill-success';
        const icon = document.querySelector('.telemetry-card:first-child .telemetry-status-icon');
        if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-success';
      }
    }
  }

  if (state.solarEfficiency !== efficiency) {
    state.solarEfficiency = efficiency;
    if (elValueEfficiency) elValueEfficiency.textContent = efficiency;
    if (elProgressEfficiency) {
      elProgressEfficiency.style.width = efficiency + '%';
      if (efficiency >= 85) {
        elProgressEfficiency.className = 'progress-bar-fill fill-success';
        const icon = document.querySelector('.telemetry-card:nth-child(2) .telemetry-status-icon');
        if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-success';
      } else if (efficiency >= 30) {
        elProgressEfficiency.className = 'progress-bar-fill fill-warning';
        const icon = document.querySelector('.telemetry-card:nth-child(2) .telemetry-status-icon');
        if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-warning';
      } else {
        elProgressEfficiency.className = 'progress-bar-fill fill-error';
        const icon = document.querySelector('.telemetry-card:nth-child(2) .telemetry-status-icon');
        if (icon) icon.className = 'material-symbols-outlined telemetry-status-icon text-error';
      }
    }
  }

  if (coverage === 0 && state.edsActive) {
    state.edsActive = false;
    if (elBtnActivate) elBtnActivate.classList.remove('active');
    if (elBtnActivateText) elBtnActivateText.textContent = 'ACTIVATE COULOMB CLEARING';
    writeLog('EDS System Auto-Shutdown. Solar surface 100% restored.', 'success');
  }
}

// ─── Resize Handler ───────────────────────────────────────────────────────────
function onResize() {
  const container = document.getElementById('threejs-container');
  if (!container) return;
  const W = container.clientWidth;
  const H = container.clientHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// ─── System Logs Output Helper ───────────────────────────────────────────────
function writeLog(message, type = 'info') {
  const out = document.getElementById('console-output');
  if (!out) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const line = document.createElement('div');
  line.className = 'log-line';

  const ts = document.createElement('span');
  ts.className = 'log-time';
  ts.textContent = `[${timeStr}]`;

  const txt = document.createElement('span');
  txt.className = `log-${type}`;
  txt.textContent = ' ' + message;

  line.appendChild(ts);
  line.appendChild(txt);
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

// ─── Tick Loop ───────────────────────────────────────────────────────────────
function tick() {
  const deltaTime = Math.min(0.1, clock.getDelta());
  const elapsed = clock.getElapsedTime();

  if (starField && starField.material.uniforms) {
    starField.material.uniforms.uTime.value = elapsed;
  }

  if (elConsoleTime) {
    const totalSecs = Math.floor(elapsed);
    const ms = Math.floor((elapsed - totalSecs) * 100);
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    const msStr = ms.toString().padStart(2, '0');
    elConsoleTime.textContent = `T+ ${hrs}:${mins}:${secs}:${msStr}`;
  }

  if (state.mode === 'orbit') {
    if (moonMesh) {
      moonMesh.rotation.y = elapsed * 0.04;
    }
    controls.update();
  } 
  else if (state.mode === 'descending') {
    transitionTime += deltaTime;
    let t = Math.min(1.0, transitionTime / transitionDuration);
    let ease = t * t * (3 - 2 * t);
    
    camera.position.lerpVectors(startCamPos, targetCamPos, ease);
    controls.target.lerpVectors(startControlsTarget, targetControlsTarget, ease);
    controls.update();

    if (t > 0.35 && t < 0.75 && elHudStatus) {
      elHudStatus.textContent = 'STATUS: DEPLOYING LANDING STRUTS';
    }
    if (t >= 0.75 && elHudStatus) {
      elHudStatus.textContent = 'STATUS: STATIONARY CONTACT LOCK';
    }

    if (t >= 1.0) {
      state.mode = 'surface';
      if (elDescentHud) elDescentHud.style.display = 'none';
      if (elBtnReturnOrbit) elBtnReturnOrbit.style.display = 'flex';

      if (moonMesh) moonMesh.visible = false;
      if (surfaceGroup) surfaceGroup.visible = true;

      camera.position.set(0, 0.45, 0.55);
      controls.target.set(0, -0.04, 0);
      
      controls.enabled = true;
      controls.autoRotate = false;
      controls.minDistance = 0.25;
      controls.maxDistance = 1.6;
      controls.update();

      const latStr = `${Math.abs(selectedLat).toFixed(2)}° ${selectedLat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(selectedLon).toFixed(2)}° ${selectedLon >= 0 ? 'E' : 'W'}`;
      const coordEl = document.querySelector('.viewport-overlay-bottom-left p:first-child');
      if (coordEl) coordEl.textContent = `COORD_LUNAR: ${latStr}, ${lonStr}`;

      writeLog(`Landing confirmed at LAT: ${latStr}, LON: ${lonStr}. Digital twin running.`, 'success');
      writeLog('Solar cell array output degraded: 100% dust coverage.', 'error');
    }
  } 
  else if (state.mode === 'ascending') {
    transitionTime += deltaTime;
    let t = Math.min(1.0, transitionTime / transitionDuration);
    let ease = t * t * (3 - 2 * t);

    camera.position.lerpVectors(startCamPos, targetCamPos, ease);
    controls.target.lerpVectors(startControlsTarget, targetControlsTarget, ease);
    controls.update();

    if (transitionTime < 0.08) {
      if (moonMesh) moonMesh.visible = true;
      if (surfaceGroup) surfaceGroup.visible = false;
    }

    if (t >= 1.0) {
      state.mode = 'orbit';
      if (elDescentHud) elDescentHud.style.display = 'none';

      controls.enabled = true;
      controls.autoRotate = true;
      controls.minDistance = 1.4;
      controls.maxDistance = 12;
      controls.update();

      const btnLandEl = document.getElementById('btn-land');
      if (btnLandEl) btnLandEl.style.display = 'flex';

      const coordEl = document.querySelector('.viewport-overlay-bottom-left p:first-child');
      if (coordEl) coordEl.textContent = 'COORD_LUNAR: 0.12° N, 30.55° E';

      writeLog('Returned to low lunar orbit.', 'info');
    }
  } 
  else if (state.mode === 'surface') {
    updateDustSimulation(deltaTime, elapsed);
    controls.update();
  }

  renderer.render(scene, camera);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  init();
  writeLog('Three.js Space View initialised. Drag to orbit Moon globe.', 'info');
  writeLog('Select any landing point on the Moon surface to proceed.', 'info');
});
