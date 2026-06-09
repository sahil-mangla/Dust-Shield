# DustShield Digital Twin — Simulation Architecture & Agent Reference

## Project Context

**DustShield** is an Electrodynamic Dust Shield (EDS) Digital Twin that simulates lunar dust removal from solar panels using a browser-based 3D environment. The simulator mirrors the behavior of the physical hardware stack and provides a real-time visualization of EDS performance without requiring actual electronics.

This document aligns with the project artifacts found in:

- PROJECT_BRIEF.md
- TECH_STACK.json
- ROADMAP.json
- RESEARCH_ANALYSIS.md
- DESIGN_SYSTEM.md

---

# Core Concept: Simulation as a Digital Mirror

A digital twin is not a static 3D model.

It is a living simulation that reacts to the same control inputs used by the real hardware and produces equivalent system behavior.

### Input → Physics → Output Pipeline

```text
User Controls
(Voltage, Phase Mode, ON/OFF)
        ↓
EDS Physics Simulation
(Dust Motion Model)
        ↓
Performance Metrics
(Coverage %, Efficiency %)
        ↓
3D Visualization
(Dust Clearing Animation)
```

The user adjusts a control, and the simulation updates immediately, replicating the response of a physical EDS controller.

---

# Hardware-to-Simulation Mapping

| Physical Hardware | Digital Twin Equivalent |
|------------------|-------------------------|
| ESP32-C3 firmware variables | JavaScript global state |
| PWM output generation | Voltage scaling logic |
| 2-phase / 3-phase mode selection | Phase multiplier |
| MOSFET enable signal | `edsActive` flag |
| Flyback transformer HV output | Voltage slider (0–2 kV) |
| ITO electrode traveling wave | Particle motion toward edges |
| Dust removal on panel | Particle deactivation |
| Increased solar power recovery | Efficiency metric increase |

The simulation behaves as if it is connected directly to the PCB telemetry stream.

---

# Technology Stack

## Rendering

- Three.js (WebGL)
- requestAnimationFrame rendering loop
- Procedural particle generation
- Browser-native execution

## Frontend

- HTML5
- Vanilla JavaScript (ES6 Modules)
- CSS Custom Properties
- CSS Grid/Flexbox

## Future Hardware Integration

Telemetry format:

```text
voltage,frequency,phase,active
1500,45,3,1
```

Supported through:

- Web Serial API
- ESP32-C3
- USB-UART bridge communication

---

# Simulation Architecture

## 1. 3D Scene

The scene contains:

### Solar Panel

- Blue photovoltaic surface
- Metallic frame
- Dust collection area

### Lunar Terrain

- Gray regolith surface
- Ambient and directional lighting
- Soft shadow effects

### Dust Particle System

Each dust particle is represented as a sprite.

Stored particle properties:

```js
{
  x,
  z,
  sizeClass,
  active
}
```

### Particle Attributes

| Property | Purpose |
|----------|---------|
| x, z | Position on panel |
| sizeClass | Small / Medium / Large |
| active | Determines if particle still exists on panel |

---

# Physics Model

The goal is not full electromagnetic simulation.

Instead, an empirical model reproduces realistic EDS behavior while remaining computationally lightweight.

---

## EDS OFF State

Particles remain mostly stationary.

Optional Brownian-style drift:

```text
small random movement
```

Used to mimic thermal motion and prevent a static scene.

---

## EDS ON State

Each particle:

1. Finds the nearest panel edge.
2. Computes a direction vector.
3. Moves toward that edge.
4. Disappears once it exits panel bounds.

### Velocity Equation

```text
speed =
(voltage / 2.0)
× phaseMultiplier
× sizeFactor
```

### Phase Multipliers

| Mode | Multiplier |
|--------|----------|
| 2-Phase | 0.8 |
| 3-Phase | 1.5 |

### Particle Size Factors

| Size | Factor |
|--------|--------|
| Small | 1.2 |
| Medium | 0.8 |
| Large | 0.4 |

Smaller particles move faster and are removed more efficiently.

### Position Update

```text
newPosition =
oldPosition +
(speed × deltaTime)
```

### Removal Rule

```text
if particle leaves panel:
    active = false
```

---

# Real-Time Metrics Engine

Metrics are recalculated every animation frame.

## Coverage

```text
coverage =
(activeParticles / totalParticles) × 100
```

Represents remaining dust on the panel.

---

## Efficiency

```text
efficiency =
max(0, 100 - coverage × 0.9)
```

Represents recovered solar performance.

As dust decreases:

- Coverage decreases
- Efficiency increases

---

# Control System

## Activate Button

```js
edsActive = true | false
```

Enables or disables particle movement.

---

## Voltage Slider

```js
voltage = 0 → 2.0 kV
```

Controls particle velocity.

Higher voltage results in faster cleaning.

---

## Phase Selector

```js
phaseMode = 2 | 3
```

Changes the effectiveness multiplier.

3-phase operation clears dust faster than 2-phase operation.

---

## Reset Dust

```js
resetDust()
```

Respawns particles at random locations and restores initial conditions.

---

# Runtime Data Flow

```text
User Adjusts Control
          ↓
Simulation State Updated
          ↓
Animation Frame Executes
          ↓
Particle Motion Calculated
          ↓
Particles Removed
          ↓
Coverage Recalculated
          ↓
Efficiency Recalculated
          ↓
UI Updated
          ↓
Three.js Scene Rendered
```

Target refresh rate:

```text
60 FPS
```

---

# Core Functions

## updateDustMovement(deltaTime)

Responsibilities:

- Compute direction vectors
- Apply velocity equation
- Move particles
- Remove particles leaving bounds

---

## updateMetrics()

Responsibilities:

- Count active particles
- Calculate coverage
- Calculate efficiency
- Update dashboard values

---

## resetDust()

Responsibilities:

- Respawn all particles
- Randomize placement
- Reset metrics
- Restore initial simulation state

---

# Digital Twin Validation Logic

The simulator should satisfy the following behavior:

### Voltage Relationship

```text
Higher Voltage
      ↓
Faster Particle Motion
      ↓
Lower Coverage
      ↓
Higher Efficiency
```

### Phase Relationship

```text
3-Phase > 2-Phase
```

for dust-clearing effectiveness.

### Particle Inertia Relationship

```text
Small Dust
    >
Medium Dust
    >
Large Dust
```

for removal speed.

---

# MVP Justification

| Requirement | Implementation |
|------------|---------------|
| Real-time interaction | requestAnimationFrame |
| Browser-only deployment | HTML + JS |
| No backend | Fully client-side |
| Hardware mirroring | Variable mapping layer |
| Easy debugging | Simple physics model |
| Demonstration ready | Single-page application |

---

# Demonstration Flow

1. Open the application.
2. Observe dust-covered solar panel.
3. Click Activate EDS.
4. Watch particles move toward edges.
5. Increase voltage to 2 kV.
6. Observe faster clearing.
7. Switch between 2-phase and 3-phase.
8. Compare cleaning rates.
9. Monitor Coverage and Efficiency metrics.
10. Click Reset Dust to restart the experiment.

---

# Agent Notes

When extending the simulator:

### Maintain

- Hardware ↔ simulation parameter mapping
- Real-time metric updates
- Deterministic particle lifecycle
- Browser-only execution

### Avoid

- Heavy physics engines
- Maxwell-equation solvers
- Backend dependencies
- Complex GPU compute pipelines

The goal of DustShield is a convincing, interactive, explainable Digital Twin suitable for demonstrations, judging, rapid iteration, and future hardware integration.
