# Accessibility Compliance & WCAG 2.2 Level AA Checklist

## 1. Accessibility Commitment

Air pollution disproportionately affects elderly adults, children, and people with chronic respiratory or visual impairments. **AtmoSense AI** is engineered from the ground up to conform to **WCAG 2.2 Level AA** across desktop, tablet, and mobile viewports in both light and dark themes.

---

## 2. WCAG 2.2 Level AA Conformance Matrix

### 2.1 Perceivable

| Criterion                        | Level | Status | Implementation in AtmoSense AI                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.1.1 Non-text Content**       | A     | Pass   | All decorative Lucide icons carry `aria-hidden="true"`. Interactive SVG charts (`ForecastSvgPlot.tsx`, `TrendChartSvg.tsx`) expose `role="img"`, `<title>`, `<desc>`, descriptive `aria-label`, and a parallel `.sr-only` data summary of hourly AQI, peak hours, and safe solar convection windows.                            |
| **1.3.1 Info and Relationships** | A     | Pass   | Complete semantic HTML5 landmarks (`<header>`, `<nav aria-label="Primary navigation">`, `<main id="main-content">`, `<footer>`), skip-to-main-content link, properly associated `<label htmlFor>` inputs, `<fieldset>` / `<legend>` groupings in symptom tracking, and semantic `<table>` markup for the Community Leaderboard. |
| **1.3.2 Meaningful Sequence**    | A     | Pass   | Visual grid order matches DOM reading order across all workspace tabs at `390px`, `1024px`, and `1440px`.                                                                                                                                                                                                                       |
| **1.3.4 Orientation**            | AA    | Pass   | Responsive layouts adapt seamlessly across portrait and landscape orientations with zero orientation locks and `0px` horizontal overflow (`min-w-0` grid discipline).                                                                                                                                                           |
| **1.4.1 Use of Color**           | A     | Pass   | **Never color alone.** Every AQI level, pollutant severity, inversion risk, vulnerable-person badge, and gamification streak pairs distinct **color + text label + vector icon** (e.g., `Moderate` + info icon, `High` + shield-alert icon, `Nominal` + check-circle icon).                                                     |
| **1.4.3 Contrast (Minimum)**     | AA    | Pass   | Programmatically verified via sRGB relative luminance in `wcagStructure.test.tsx`: body copy (`slate-900` on `white`/`slate-50` = `15.4:1`, `slate-100` on `slate-950` = `17.2:1`), muted labels (`slate-600` on `white` = `7.0:1`), and primary cyan buttons (`white` on `#0e7490` = `5.4:1`) all exceed `4.5:1`.              |
| **1.4.4 Resize Text**            | AA    | Pass   | All typography uses relative `rem` units via Tailwind CSS v4; layouts reflow cleanly up to `200%` browser zoom without clipping or overlapping text.                                                                                                                                                                            |
| **1.4.10 Reflow**                | AA    | Pass   | Verified `0px` horizontal scrolling at `390px` mobile viewport width across all tabs including `FamilyManager`, `SymptomTracker`, and `HealthInsights`.                                                                                                                                                                         |
| **1.4.11 Non-text Contrast**     | AA    | Pass   | Input borders, toggle controls, focus rings, progress bars, and SVG chart grid/data strokes maintain `>= 3:1` contrast against adjacent light and dark card backgrounds.                                                                                                                                                        |

### 2.2 Operable

| Criterion                                  | Level | Status | Implementation in AtmoSense AI                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.1.1 Keyboard**                         | A     | Pass   | Every interactive control (tab bar, station selector, My Location trigger, pollutant inspection cards, SVG chart hour scrubber with `ArrowLeft`/`ArrowRight`, theme switcher, symptom severity buttons, AI consent toggle, PDF export) is reachable and activatable via keyboard. |
| **2.1.2 No Keyboard Trap**                 | A     | Pass   | No component traps keyboard focus; `Escape` and explicit close buttons dismiss inline forms and panels cleanly.                                                                                                                                                                   |
| **2.2.2 Pause, Stop, Hide**                | A     | Pass   | Zero auto-playing carousels or flashing animations; refresh spinner runs strictly during active network requests.                                                                                                                                                                 |
| **2.3.1 Three Flashes or Below Threshold** | A     | Pass   | Zero flashing elements; global `@media (prefers-reduced-motion: reduce)` rule in `client/src/index.css` disables non-essential motion across transitions and animations.                                                                                                          |
| **2.4.1 Bypass Blocks**                    | A     | Pass   | Skip-to-main-content link plus four distinct landmark regions (`banner`, `navigation`, `main`, `contentinfo`) allow screen readers and keyboard users to jump directly to live AQI content.                                                                                       |
| **2.4.2 Page Titled**                      | A     | Pass   | Unique descriptive document title: `AtmoSense AI — Urban Air Quality Assistant`.                                                                                                                                                                                                  |
| **2.4.3 Focus Order**                      | A     | Pass   | Natural top-to-bottom, left-to-right focus sequence with zero positive `tabIndex` overrides.                                                                                                                                                                                      |
| **2.4.7 Focus Visible**                    | AA    | Pass   | Global high-contrast `:focus-visible` outline (`2px solid` + offset in `client/src/index.css`) paired with Tailwind `focus-visible:ring-2 focus-visible:ring-cyan-600` across all interactive controls.                                                                           |
| **2.5.8 Target Size (Minimum)**            | AA    | Pass   | Touch targets (navigation buttons, symptom radio buttons, location triggers, refresh/theme toggles) meet WCAG 2.2 minimum target size (`>= 24×24 CSS px`, with primary controls `>= 36–44 px` tall).                                                                              |

### 2.3 Understandable

| Criterion                        | Level | Status | Implementation in AtmoSense AI                                                                                                                                               |
| -------------------------------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3.1.1 Language of Page**       | A     | Pass   | `<html lang="en">` declared on root document (`client/index.html`).                                                                                                          |
| **3.2.1 On Focus**               | A     | Pass   | Focusing interactive elements never triggers unexpected navigation or modal openings.                                                                                        |
| **3.3.1 Error Identification**   | A     | Pass   | Failed telemetry fetches render explicit inline alerts with a keyboard-accessible **Retry** button; form validation errors describe the exact offending field in plain text. |
| **3.3.2 Labels or Instructions** | A     | Pass   | Explicit labels on station selector (`Active Station`), family profile fields, symptom severity scales, and AI consent checkbox.                                             |

### 2.4 Robust

| Criterion                   | Level | Status | Implementation in AtmoSense AI                                                                                                                                                                                                    |
| --------------------------- | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.1.2 Name, Role, Value** | A     | Pass   | Native semantic `<button>`, `<select>`, `<input>`, `<table>` elements used throughout; toggle states expose `aria-pressed` / `aria-expanded` / `aria-current`.                                                                    |
| **4.1.3 Status Messages**   | AA    | Pass   | Live AQI metric announces updates via `aria-live="polite"`; loading skeletons, offline banners, and error notifications use `role="status"` / `role="alert"` so screen readers announce state transitions without stealing focus. |

---

## 3. Automated & Structural Verification

### 3.1 Automated `axe-core` Audit (`client/src/tests/accessibility/axe.test.ts`)

- Runs **axe-core 4.14** via Vitest + React Testing Library against rendered DOM trees for:
  - `AQIDashboard` (including `PollutantCard`, `InversionIndicator`, `HealthRecommendation`, and `ForecastChart`)
  - `HealthAssistantPanel`
  - `RoutineOptimizer`
  - `VoiceInterface`
  - `FamilyManager` (including `SymptomTracker` and `HealthInsights`)
- **Result**: **0 critical, 0 serious, 0 moderate violations**.

### 3.2 Mathematical Contrast & Landmark Audit (`client/src/tests/accessibility/wcagStructure.test.tsx`)

- Programmatically computes WCAG 2.2 sRGB relative luminance contrast ratios across primary light and dark theme token pairs (`>= 4.5:1` AA threshold).
- Verifies skip-link target wiring, semantic landmarks (`banner`, `navigation`, `main`, `contentinfo`), SVG `<title>`/`<desc>` accessibility nodes, and keyboard arrow navigation on charts.

### 3.3 Assistive & Gamification Accessibility Guarantees

- **Community Leaderboard**: Always rendered in semantic HTML `<table>` (`<thead>`, `<th scope="col">`, `<tbody>`) rather than purely visual card stacks so screen readers navigate rank, district, streak, and $\text{CO}_2$ avoided cell-by-cell.
- **Voice Interface**: Provides Web Speech API microphone input and spoken AQI briefing synthesis for users who prefer audio interaction.
- **Reduced Motion**: Honors OS-level `prefers-reduced-motion: reduce` globally across transitions, loading skeletons, and badges.

---

## 4. Running the Accessibility Audits

```bash
# Run automated axe-core + WCAG contrast/landmark suites
npx vitest run client/src/tests/accessibility/
```
