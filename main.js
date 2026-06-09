/* ============================================================================
   DUSTSHIELD DIGITAL TWIN // THREE.JS RENDERER & SIMULATION ENGINE
   ============================================================================ */

'use strict';

// ─── Scene globals ───────────────────────────────────────────────────────────
let scene, camera, renderer, controls, clock;
let moonMesh, starField;
let surfaceGroup, roverMesh, groundMesh, solarPanelMesh, dustPoints;

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
const totalParticles = 180;
const particles = [];
let dustPositionsAttr, dustColorsAttr;

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

  buildLocalTerrain();
  buildSolarPanel();
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

// ─── Local Moon Terrain (Surface Mode) ───────────────────────────────────────
function buildLocalTerrain() {
  const geo = new THREE.PlaneGeometry(12, 12, 64, 64);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    
    let height = Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.04;
    height += (Math.random() - 0.5) * 0.015;
    
    const craterDist = Math.sqrt(Math.pow(x - 2, 2) + Math.pow(z + 1, 2));
    if (craterDist < 1.5) {
      height += -0.06 * Math.cos((craterDist / 1.5) * Math.PI * 0.5);
    }
    
    posAttr.setY(i, -0.2 + height);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x242528,
    roughness: 0.95,
    metalness: 0.02
  });

  groundMesh = new THREE.Mesh(geo, mat);
  surfaceGroup.add(groundMesh);
}

// ─── Procedural Solar Panel with canvas-based electrodes texture ──────────────
function buildSolarPanel() {
  const panelTex = createSolarPanelTexture();
  
  const solarCellMat = new THREE.MeshStandardMaterial({
    map: panelTex,
    roughness: 0.15,
    metalness: 0.6
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x5a5d64,
    roughness: 0.3,
    metalness: 0.8
  });

  const materials = [frameMat, frameMat, solarCellMat, frameMat, frameMat, frameMat];

  const geo = new THREE.BoxGeometry(0.5, 0.02, 0.4);
  solarPanelMesh = new THREE.Mesh(geo, materials);
  solarPanelMesh.position.set(0, 0.16, 0);
  surfaceGroup.add(solarPanelMesh);
}

function createSolarPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#0a1428';
  ctx.fillRect(0, 0, 512, 512);
  
  ctx.strokeStyle = '#1a2a48';
  ctx.lineWidth = 3;
  for (let x = 64; x < 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 128; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.lineWidth = 3.0;
  
  ctx.strokeStyle = '#b8924b';
  ctx.beginPath();
  ctx.moveTo(20, 15);
  ctx.lineTo(492, 15);
  ctx.stroke();
  
  ctx.strokeStyle = '#9eb6df';
  ctx.beginPath();
  ctx.moveTo(20, 497);
  ctx.lineTo(492, 497);
  ctx.stroke();

  const numFingers = 24;
  const spacing = 472 / numFingers;
  for (let i = 0; i <= numFingers; i++) {
    const x = 20 + i * spacing;
    if (i % 2 === 0) {
      ctx.strokeStyle = '#b8924b';
      ctx.beginPath();
      ctx.moveTo(x, 15);
      ctx.lineTo(x, 470);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#9eb6df';
      ctx.beginPath();
      ctx.moveTo(x, 497);
      ctx.lineTo(x, 42);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// ─── Dust Particles Generator ───────────────────────────────────────────────
function buildDustParticles() {
  const count = totalParticles;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const px = (Math.random() - 0.5) * 0.47;
    const pz = (Math.random() - 0.5) * 0.37;
    const py = 0.171 + Math.random() * 0.003;

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    const isBrown = Math.random() < 0.25;
    const r = isBrown ? (0.64 + Math.random() * 0.1) : (0.75 + Math.random() * 0.1);
    const g = isBrown ? (0.54 + Math.random() * 0.08) : (0.75 + Math.random() * 0.1);
    const b = isBrown ? (0.44 + Math.random() * 0.08) : (0.75 + Math.random() * 0.1);

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    particles.push({
      x: px,
      y: py,
      z: pz,
      vx: 0,
      vy: 0,
      vz: 0,
      active: true,
      isFlying: false,
      sizeClass: Math.random() < 0.15 ? 'large' : (Math.random() < 0.5 ? 'medium' : 'small')
    });
  }

  const geo = new THREE.BufferGeometry();
  dustPositionsAttr = new THREE.BufferAttribute(positions, 3);
  dustColorsAttr = new THREE.BufferAttribute(colors, 3);
  geo.setAttribute('position', dustPositionsAttr);
  geo.setAttribute('color', dustColorsAttr);

  const dustMat = new THREE.PointsMaterial({
    size: 0.016,
    map: createDustTexture(),
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending
  });

  dustPoints = new THREE.Points(geo, dustMat);
  surfaceGroup.add(dustPoints);
}

function createDustTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.3, 'rgba(220, 220, 220, 0.85)');
  grad.addColorStop(0.7, 'rgba(160, 160, 160, 0.25)');
  grad.addColorStop(1, 'rgba(160, 160, 160, 0.0)');
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  
  return new THREE.CanvasTexture(canvas);
}

// ─── Rover 3D Loader & Fallback Builder ─────────────────────────────────────
function loadRover() {
  const loader = new THREE.GLTFLoader();
  isRoverLoading = true;
  writeLog('Loading lunar rover GLTF model...', 'info');

  loader.load(
    'assets/nasa/rover.glb',
    (gltf) => {
      roverMesh = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(roverMesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      
      const scaleFactor = 0.65 / (maxDim || 1);
      roverMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      roverMesh.position.set(0, -0.2, 0);

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
    },
    undefined,
    (err) => {
      isRoverLoading = false;
      writeLog('Rover model load failed. Constructing high-fidelity fallback.', 'warning');
      buildProceduralRover();
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
  if (elBtnReturnOrbit) {
    elBtnReturnOrbit.addEventListener('click', () => initiateAscent());
  }
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

// ─── Dust Re-deposition (Reset) ──────────────────────────────────────────────
function resetDust() {
  const count = totalParticles;
  const posArr = dustPositionsAttr.array;

  for (let i = 0; i < count; i++) {
    const p = particles[i];
    const px = (Math.random() - 0.5) * 0.47;
    const pz = (Math.random() - 0.5) * 0.37;
    const py = 0.171 + Math.random() * 0.003;

    p.x = px;
    p.y = py;
    p.z = pz;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.active = true;
    p.isFlying = false;

    posArr[i * 3] = px;
    posArr[i * 3 + 1] = py;
    posArr[i * 3 + 2] = pz;
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

// ─── Dust Physics Updates ───────────────────────────────────────────────────
function updateDustSimulation(deltaTime, elapsed) {
  const phaseMultiplier = state.phase === 3 ? 1.5 : 0.8;
  const baseSpeed = (state.voltage / 2000.0) * phaseMultiplier * 0.07;
  
  const posArr = dustPositionsAttr.array;
  let activeInBounds = 0;

  for (let i = 0; i < totalParticles; i++) {
    const p = particles[i];

    if (!p.active) {
      posArr[i * 3] = 9999;
      posArr[i * 3 + 1] = 9999;
      posArr[i * 3 + 2] = 9999;
      continue;
    }

    if (!p.isFlying) {
      activeInBounds++;

      if (state.edsActive) {
        let sizeFactor = 0.8;
        if (p.sizeClass === 'small') sizeFactor = 1.3;
        if (p.sizeClass === 'large') sizeFactor = 0.4;

        const speed = baseSpeed * sizeFactor;
        const moveDir = Math.sign(p.x);
        const dir = moveDir === 0 ? (i % 2 === 0 ? 1 : -1) : moveDir;

        p.x += dir * speed * deltaTime;

        const freqHz = state.frequency;
        const jitterAmp = 0.001 * (freqHz / 60);
        p.z += Math.sin(elapsed * freqHz * 0.4 + i) * jitterAmp;
        p.y = 0.171 + Math.sin(elapsed * freqHz * 0.8 + i) * jitterAmp * 0.45;

        if (Math.abs(p.x) >= 0.246) {
          p.isFlying = true;
          p.vx = dir * Math.max(0.06, speed * 2.5);
          p.vy = 0.02 + Math.random() * 0.025;
          p.vz = (Math.random() - 0.5) * 0.03;
        }
      } else {
        p.x += (Math.random() - 0.5) * 0.0006;
        p.z += (Math.random() - 0.5) * 0.0006;
        p.y = 0.171 + (Math.random() - 0.5) * 0.0002;
        
        p.x = Math.max(-0.24, Math.min(0.24, p.x));
        p.z = Math.max(-0.19, Math.min(0.19, p.z));
      }
    } else {
      p.vy -= 1.62 * 0.2 * deltaTime;
      
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.z += p.vz * deltaTime;

      if (p.y <= -0.19) {
        p.active = false;
        p.isFlying = false;
      }
    }

    posArr[i * 3] = p.x;
    posArr[i * 3 + 1] = p.y;
    posArr[i * 3 + 2] = p.z;
  }

  dustPositionsAttr.needsUpdate = true;

  const coverage = Math.round((activeInBounds / totalParticles) * 100);
  const efficiency = Math.max(0, Math.round(100 - coverage * 1.2));

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
