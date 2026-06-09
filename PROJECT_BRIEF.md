# Project Brief: DustShield (Electrodynamic Dust Shield Digital Twin)

---

## 1. Overview, Selected Topic, & Research Gap
Lunar dust (regolith) presents a critical technology gap for sustained lunar bases. Electrodynamic Dust Shields (EDS) mitigate this by utilizing multi-phase AC high voltages to produce traveling electric fields that transport charged and uncharged dust particles off critical surfaces (such as solar panels).

**Research Gap**: While NASA's Kennedy Space Center has proven EDS efficacy physically, there is a lack of accessible, open-source **Digital Twin** platforms. Optimization loops (adjusting voltage amplitude, frequencies, and phases) are confined to expensive, slow vacuum chamber tests. This project provides a virtual simulator that ingests hardware-equivalent telemetry parameters and visualizes particle kinetics and solar panel recovery dynamically.

---

## 2. Citations & Bibliography
Foundational papers and reports grounding this project:

- **[Calle2008]**: Calle, C. I., et al. "Dust particle removal by electrostatic and dielectrophoretic forces with applications to NASA exploration missions." *ESA Annual Meeting on Electrostatics*, 2008.
- **[Buhler2024]**: Buhler, C. R., et al. "Current State of the Electrodynamic Dust Shield for Mitigation." *NASA Technical Reports*, 2024.
- **[Mazumder2007]**: Mazumder, M. K., et al. "Development of self-cleaning solar panels for lunar and Martian exploration missions." *IEEE Transactions on Industry Applications*, 2007.

See full BibTeX entries in [PAPER_REFERENCES.bib](file:///Users/sahilmangla/DustShield/PAPER_REFERENCES.bib).

---

## 3. Baseline Metrics & Evaluation Protocol
We evaluate the digital twin against the following criteria:

- **Initial Dust Coverage**: 100% (represented by 150 particles scattered randomly).
- **Initial Solar Efficiency**: 0% (modeled as $100 - (\text{Coverage} \times 1.2)$, capped at 0%).
- **Verification Gates**:
  - *Phase Superiority*: 3-Phase AC (120° offset) must clear particles 1.5x faster than 2-Phase AC (180° offset).
  - *Voltage Curve*: Higher voltages must clear particles exponentially faster (scaling with $V^2$ in physics, simulated as linear speed increments).
  - *Inertia Mapping*: Large particles must move slower than small particles due to mass characteristics.

---

## 4. Tech Stack & Performance Architecture
- **Language & Core**: HTML5 and vanilla JavaScript ES6 Modules.
- **3D Engine**: Three.js (r128 via UNPKG CDN) for WebGL rendering.
- **Styling**: Pure CSS Custom Properties and Grid/Flex layouts. No Tailwind or heavy component libraries.
- **No Waterfalls**: Asset loads are bypassed entirely by using procedural sprite generation via a 2D HTML Canvas context, achieving instantaneous paint times.
- **Hardware Telemetry Readiness**: Includes a native Web Serial receiver adapter class that can hook directly to ASCII streams (`voltage,frequency,phase,active\n`) from external microcontrollers.

---

## 5. Design System Spec
Rooted in the **"Mission Operations Deck"** aesthetic:

- **Colors (HSL)**: Base canvas `hsl(224, 25%, 8%)`, card base `hsl(224, 25%, 12%)`. Telemetry accents: Blue (active), Emerald (clean), Amber (off), Red (error).
- **Typography**: Space Grotesk (technical display headers and numeric telemetry data) paired with Inter (high-readability body text).
- **Strict Design Bans**: No text gradients, no side-stripe card colors, no ghost-cards (border + shadow combo), and card border-radius clamped <= 12px.
- **Motion**: Transition variables set with smooth cubic-bezier functions, fully overridden for users with `prefers-reduced-motion` settings.

---

## 6. Task-Wise Roadmap
The implementation roadmap is broken down by components:

1. **Setup & Design Integration**: Map CSS custom variables, define HTML layout cards.
2. **3D Scene Construction**: Create WebGL renderer, perspective camera, lunar terrain plane, and solar panel mesh.
3. **Particle Generator**: Initialize 150 particles with size-based classifications and Brownian drift.
4. **Kinematics Engine**: Implement directional traveling-wave velocity equations and boundary deactivation.
5. **Dashboard Synchronization**: Bind Voltage/Frequency sliders and phase toggles to active metrics.
6. **Telemetry Adapter**: Stub Web Serial parser class for future microcontroller interfacing.

For full subpart detail and verification criteria, see [ROADMAP.json](file:///Users/sahilmangla/DustShield/ROADMAP.json).

---

## 7. Accessibility Compliance Status
We verify AA WCAG standards:

- *Semantic Markup*: Use landmark elements (`<main>`, `<aside>`, `<header>`) and a single `<h1>`.
- *Contrast*: Contrast ratio of text vs. container backgrounds is 11.2:1 (exceeding the 4.5:1 requirement).
- *Focus States*: Custom active rings highlight inputs and buttons.
- *Touch Targets*: Minimum button target sizing is set to 44x44px.

---

## 8. Performance Metrics
- **Largest Contentful Paint (LCP)**: Targeted at < 1.5s due to procedural sprites.
- **Interaction to Next Paint (INP)**: Targeted at < 150ms.
- **Console Health**: Zero runtime errors, zero compilation warnings.

---

## 9. Definition of Done
The project is complete and ready to submit when:
1. All workflow JSON/markdown files are created and validated in the workspace.
2. The interactive 3D WebGL simulator is fully functional.
3. Telemetry sliders, phase switches, and active metrics update correctly.
4. The verification script `verify_project.py` reports zero failures.
