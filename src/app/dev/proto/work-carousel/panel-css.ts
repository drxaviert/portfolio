/**
 * Control panel chrome: neutral dark glass, fixed top-right, no project
 * tokens. Copied from the card-hover harness so both prototypes carry the same
 * "harness, not design" posture.
 */
export const PANEL_CSS = `
.wc-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 240px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 10px;
  border-radius: 14px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.55);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.wc-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.wc-panel-title {
  margin: 0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.wc-panel-axis {
  margin: 1px 0 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 10px;
}

.wc-panel-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.wc-panel-copy,
.wc-panel-toggle {
  flex-shrink: 0;
  padding: 3px 7px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.wc-panel-toggle {
  width: 20px;
  padding: 0;
  font-size: 12px;
  line-height: 20px;
}

.wc-panel-copy:hover,
.wc-panel-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
}

.wc-panel-copy:focus-visible,
.wc-panel-toggle:focus-visible,
.wc-panel-preset:focus-visible,
.wc-panel-phase-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.wc-panel-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wc-panel-phase,
.wc-panel-presets {
  display: grid;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
}

.wc-panel-phase {
  grid-template-columns: repeat(4, 1fr);
}

.wc-panel-presets {
  grid-template-columns: repeat(2, 1fr);
}

.wc-panel-phase-item,
.wc-panel-preset {
  padding: 4px 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.wc-panel-preset {
  font-size: 10px;
}

.wc-panel-phase-item {
  text-transform: capitalize;
}

.wc-panel-phase-item:hover,
.wc-panel-preset:hover {
  color: rgba(255, 255, 255, 0.85);
}

.wc-panel-phase-item[data-active],
.wc-panel-preset[data-active] {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.wc-panel-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1px 8px;
}

.wc-panel-label {
  color: rgba(255, 255, 255, 0.6);
}

.wc-panel-value {
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.wc-panel-range {
  grid-column: 1 / -1;
  width: 100%;
  height: 14px;
  margin: 0;
  accent-color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.wc-panel-select {
  grid-column: 1 / -1;
  width: 100%;
  padding: 3px 4px;
  border: 0;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.wc-panel-select:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.wc-panel-check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.wc-panel-check input {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: rgba(255, 255, 255, 0.8);
}

.wc-panel-group {
  margin: 2px 0 0;
  color: rgba(255, 255, 255, 0.35);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.wc-panel-hint {
  margin: 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
}
`;
