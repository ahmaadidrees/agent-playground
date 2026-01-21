# Theme system: dark toggle + teal/aqua primary

## Context
Shift the UI to a teal/aqua primary palette and add a light/dark theme toggle. The UI is currently hard-coded with amber utilities and light-only surfaces.

## Goals
- Add a theme toggle (light/dark) with persistence and sensible defaults.
- Replace amber/orange styling with teal/aqua via shared CSS tokens.
- Keep layouts unchanged; only visual palette/theme changes.

## Checklist
- [ ] Define CSS theme tokens in `src/index.css` (light + dark) including teal/aqua accent scale.
- [ ] Update global background/selection to use tokens; remove inline body background from `index.html`.
- [ ] Implement theme state + persistence in `src/App.tsx` and add a toggle in the top UI.
- [ ] Replace amber/orange utility classes with token-based colors across core components.
- [ ] Update `src/App.css` (scrollbars/markdown/selection) to use theme tokens.
- [ ] QA: verify contrast, toggle persistence, and key screens in both themes.

## Risks / Assumptions
- Large search/replace may miss scattered amber utilities; needs a careful manual sweep.
- Some components may need extra tokens to maintain contrast in dark mode.
- Tailwind arbitrary values will be used for CSS variables (e.g., `text-[color:var(--text)]`).
