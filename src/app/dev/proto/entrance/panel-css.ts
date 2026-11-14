/**
 * Panel chrome for the entrance tuner. Day and Night both come straight from
 * the phase tokens (globals.css), so the panel follows the nav's theme toggle
 * instead of carrying its own dark-glass look.
 *
 * Only the over-budget colour is not a token: the design system has no warning
 * state, so it is a documented pair — dark red by day, the Night primary by
 * night — both above 4.5:1 on the panel surface.
 */
export const PANEL_CSS = `
.ent-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(284px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-container-low);
  box-shadow:
    0 0 0 1px var(--outline-variant) inset,
    var(--shadow-card);
  color: var(--on-surface);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.ent-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.ent-panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.ent-panel-axis {
  margin: 1px 0 0;
  color: var(--on-surface-variant);
  font-size: 10px;
}

.ent-panel-toggle {
  flex-shrink: 0;
  width: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-container);
  color: var(--on-surface);
  font: inherit;
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;
}

.ent-panel-toggle:hover {
  background: var(--surface-container-high);
}

.ent-panel-toggle:focus-visible,
.ent-panel-variant:focus-visible,
.ent-panel-replay:focus-visible,
.ent-panel-button:focus-visible,
.ent-panel select:focus-visible,
.ent-panel input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Collapsed: a single 22px button, so it barely covers the 375 review. */
.ent-panel[data-open="false"] {
  width: auto;
  gap: 0;
  padding: 4px;
}

.ent-panel[data-open="false"] .ent-panel-head > div {
  display: none;
}

.ent-panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ent-panel-variants {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-md);
  background: var(--surface-container);
}

.ent-panel-variant {
  padding: 5px 4px;
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--on-surface-variant);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.ent-panel-variant:hover {
  color: var(--on-surface);
}

.ent-panel-variant[data-active] {
  background: var(--surface-container-high);
  color: var(--on-surface);
  font-weight: 600;
}

.ent-panel-easing {
  display: grid;
  gap: 4px;
  color: var(--on-surface-variant);
  font-size: 10px;
}

.ent-panel-easing select {
  width: 100%;
  padding: 4px 5px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-container);
  color: var(--on-surface);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.ent-panel-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ent-control {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px 8px;
}

.ent-control-label {
  color: var(--on-surface-variant);
}

.ent-control-value {
  color: var(--on-surface);
  font-variant-numeric: tabular-nums;
}

.ent-control input[type="range"] {
  grid-column: 1 / -1;
  width: 100%;
  height: 16px;
  margin: 0;
  accent-color: var(--primary);
  cursor: pointer;
}

.ent-panel-total {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--outline-variant);
  color: var(--on-surface-variant);
}

.ent-panel-total strong {
  color: var(--on-surface);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

/* Over the 700ms budget: the only non-token colour, see the file header. */
.ent-panel-total strong[data-over] {
  color: #b3261e;
}

[data-phase="night"] .ent-panel-total strong[data-over] {
  color: var(--primary);
}

.ent-panel-budget {
  margin-left: auto;
  color: var(--on-surface-variant);
  font-size: 9px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ent-panel-note {
  margin: 0;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface-container);
  color: var(--on-surface-variant);
  font-size: 10px;
}

.ent-panel-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.ent-panel-replay,
.ent-panel-button {
  padding: 6px 8px;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.ent-panel-replay {
  grid-column: 1 / -1;
  border-color: transparent;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 11px;
  font-weight: 600;
}

.ent-panel-replay:hover {
  filter: brightness(1.06);
}

.ent-panel-button {
  background: var(--surface-container);
  color: var(--on-surface);
}

.ent-panel-button:hover {
  background: var(--surface-container-high);
}

.ent-panel-replay:active,
.ent-panel-button:active {
  transform: scale(0.985);
}

.ent-panel-hint {
  margin: 0;
  padding-top: 6px;
  border-top: 1px solid var(--outline-variant);
  color: var(--on-surface-variant);
  font-size: 10px;
}
`;
