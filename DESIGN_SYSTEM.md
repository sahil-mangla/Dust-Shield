# Design System Brief: Mission Operations Deck

This brief outlines the visual language, typography, and color strategies for the DustShield Digital Twin. It is designed to look like a high-precision, flight-ready space instrument.

---

## 1. Visual Tone & Identity
- **Tone**: Technical, desaturated, high-fidelity, and mission-critical.
- **Aesthetic**: A premium dark mode "Mission Operations Deck."
- **Focus**: Data density, high contrast, clean layouts, and responsive 3D elements.

---

## 2. Color Strategy (HSL Tokens)
The canvas uses desaturated deep space tones to make the telemetry signals and 3D simulation stand out.

- **Base Canvas**: `hsl(224, 25%, 8%)` (The deep space backdrop)
- **Container Base**: `hsl(224, 25%, 12%)` (Dashboard card backgrounds)
- **Active Accents**:
  - **Signal Blue**: `hsl(210, 100%, 60%)` (Normal telemetry, connections)
  - **Stable Emerald**: `hsl(145, 80%, 45%)` (EDS Active state, 100% solar efficiency)
  - **Warning Amber**: `hsl(38, 95%, 55%)` (EDS Off state, moderate dust accumulation)
  - **Critical Red**: `hsl(355, 85%, 55%)` (Error state, extreme dust degradation)
- **Text & Contrast**:
  - **Primary Body**: `hsl(210, 20%, 95%)`
  - **Secondary Caption**: `hsl(210, 15%, 70%)`
  - **Inverted text**: `hsl(224, 25%, 8%)`

---

## 3. Typography Pairings
To prevent "AI slop" typography, we pair a technical display font with a highly legible body font:
- **Display & Numeric Font**: **Space Grotesk** (for panel titles, voltage numbers, and percentages). Clamped sizes `clamp(1.5rem, 5vw, 6rem)` with letter-spacing `>= -0.02em`.
- **Body & Controls Font**: **Inter** (for descriptions, labels, and instructional texts). Formatted at `16px` with a line-height of `1.6` and maximum line length of `70ch` to optimize reading.

---

## 4. Layout, Spacing, and Elevation
- **Grid**: Built on an `8px` modular scale (spacing tokens: 8px, 16px, 24px, 32px).
- **Radius**: Cards and control widgets are clamped to `border-radius <= 12px` (avoiding soft over-rounding).
- **Z-Index Scale**:
  - Base: `0`
  - 3D Canvas: `10`
  - Floating Panels: `40`
  - Overlay Modals: `100`

---

## 5. Motion & Interaction
- **Transitions**: Transition variables set with smooth cubic-bezier functions (`cubic-bezier(0.16, 1, 0.3, 1)`), duration `200ms` for enters, and `120ms` for exits.
- **Reduced Motion**: All animations are fully bypassed for users with `prefers-reduced-motion: reduce` settings.
- **Targets**: All interactive inputs and buttons are at least `44x44px` in area, with standard focus ring visibility.

---

## 6. Strict Design Bans (No Violations)
- **No Text Gradients**: Titles use flat primary colors.
- **No Side-Stripe Card Borders**: Outlines are uniform `1px` or omitted.
- **No Ghost Cards**: Cards use either a flat background color or a subtle border, never a border + heavy shadow combo.
- **No Decorative Doodles**: Layouts are clean and mechanical.
