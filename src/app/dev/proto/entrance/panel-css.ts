/**
 * Control panel chrome: neutral dark glass, fixed top-right, no project
 * tokens. Same posture as the other proto harnesses (see
 * /dev/proto/work-carousel/panel-css.ts): a tool, not part of the design.
 */
export const PANEL_CSS = `
.en-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(248px, calc(100vw - 32px));
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

.en-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

/* Collapsed: a single 28px button, so it barely covers the 375 review. */
.en-panel[data-open="false"] {
  width: auto;
  gap: 0;
  padding: 4px;
}

.en-panel[data-open="false"] .en-panel-head > div {
  display: none;
}

.en-panel-title {
  margin: 0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.en-panel-axis {
  margin: 1px 0 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 10px;
}

.en-panel-toggle {
  flex-shrink: 0;
  width: 20px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}

.en-panel-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
}

.en-panel-toggle:focus-visible,
.en-panel-variant:focus-visible,
.en-panel-replay:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.en-panel-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.en-panel-variants {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
}

.en-panel-variant {
  padding: 5px 4px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.en-panel-variant:hover {
  color: rgba(255, 255, 255, 0.85);
}

.en-panel-variant[data-active] {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.en-panel-replay {
  padding: 6px 0;
  border: 0;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.en-panel-replay:hover {
  background: rgba(255, 255, 255, 0.18);
}

.en-panel-replay:active {
  transform: scale(0.985);
}

.en-panel-timing {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.en-panel-hint {
  margin: 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
}
`;
