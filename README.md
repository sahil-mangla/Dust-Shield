# DustShield Digital Twin // Mission Operations Simulator

An interactive, browser-based 3D digital twin and operations control dashboard for the **Electrodynamic Dust Shield (EDS)** lunar mission. This application visualizes lunar orbit navigation, surface landing, and real-time EDS physics simulation to clear electrostatic dust from solar panels.

## 🚀 Live Simulation Features

### 1. 3D Lunar Orbit & Navigation
- **Photorealistic Moon & Space Environment**: Renders a textured 3D Moon using high-resolution NASA albedo maps (`assets/nasa/moon.jpg`) suspended in a realistic space skybox with custom procedural starfields.
- **Landing Indicator**: A pulsing, interactive overlay button (`#btn-land`) floats dynamically above the lunar target. Hovering over it expands the button to "INITIATE LANDING".
- **Dynamic Descent Logic**: Clicking the landing button triggers a smooth animation that zooms the camera down to the lunar surface. The landing coordinates are dynamically calculated based on the user's current camera viewport look direction.

### 2. Lunar Surface Operations & 3D Rover View
- **NASA Lunar Rover Integration**: Loads a 3D GLTF rover model (`assets/nasa/rover.glb`) situated directly on the lunar dust bed. A procedurally generated high-fidelity landing pad/rover fallback is rendered if the asset is missing.
- **Focused Camera Zoom**: The camera focuses directly on the rover's solar panels where the dust accumulation and clearing simulation takes place.
- **Return to Orbit**: A dedicated HUD controls action panel contains a "Return to Orbit" button (`#btn-return-orbit`) that seamlessly ascends the camera back into orbit, resetting the mission view.

### 3. Electrodynamic Dust Shield (EDS) Simulation
- **AC Traveling-Wave Clearing Physics**: Simulates the multi-phase AC high-voltage traveling-wave electrostatic forces used to lift and transport charged lunar regolith particles off the solar panels.
- **Interactive Controls Panel**: Real-time configuration sliders for:
  - **Voltage (V_pp)**: Adjusts the electrostatic potential strength. Higher voltages clear dust faster and handle heavier particles.
  - **Frequency (Hz)**: Alters the propagation speed of the traveling wave.
  - **Phase Angle (θ)**: Shifts phase alignment to optimize particle transport direction.
- **Dust Coverage Telemetry**: Real-time readouts displaying remaining dust coverage percentage, active solar panel efficiency (inversely proportional to dust coverage), and electrostatic field status.

### 4. Telemetry & Hardware Integration HUD
- **Mission Status Indicators**: Visual warnings and alerts (e.g. system status, high voltage warning, signal quality).
- **Mock MCU / UART Terminal**: Toggleable hardware serial console mimicking an ESP32/MCU UART interface. Shows mock telemetry payloads, status frames, and allows manual control sequence injections.

---

## 📁 Project Structure

```bash
DustShield/
├── assets/
│   └── nasa/
│       ├── moon.jpg          # Moon surface texture map
│       ├── moon_albedo.jpg   # High resolution lunar albedo map
│       ├── rover.glb         # 3D GLTF model of the lunar rover
│       └── moon_small.glb    # Lightweight moon 3D geometry
├── index.html                # Main HUD dashboard and 3D container layout
├── index.css                 # Glassmorphic premium dashboard styling & animations
├── main.js                   # Three.js rendering engine, descent/ascent logic, & EDS physics loop
├── CSS_TOKENS.css            # Standardized UI colors, spacing, and styling tokens
├── DESIGN_SYSTEM.md          # Architectural specifications of the user experience
└── README.md                 # Project documentation (this file)
```

---

## 🛠️ How to Run Locally

Since the application uses Three.js and loads external assets (GLTF models and texture maps) via Web APIs, running it directly by double-clicking the `index.html` file will trigger CORS security blocks in your browser. 

Please run it through a local web server:

1. **Open your terminal** and navigate to the project directory:
   ```bash
   cd /path/to/DustShield
   ```

2. **Start a local HTTP server** using Python:
   ```bash
   python3 -m http.server 8000
   ```

3. **Open your browser** and navigate to:
   [http://localhost:8000](http://localhost:8000)

---

## ⚙️ Technologies Used
- **Three.js** (loaded via CDN) for the web-based WebGL 3D rendering pipeline.
- **HTML5 & Vanilla Javascript (ES6+)** for application logic, physics simulation, and state management.
- **Vanilla CSS3** featuring CSS variables, modern flexbox/grid layout systems, glassmorphism filters, and CSS keyframe animations.
