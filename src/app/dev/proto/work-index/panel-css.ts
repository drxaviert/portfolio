/**
 * Panel chrome for the work-index prototype, built on the entrance panel's
 * pattern: tokens only, so it follows the phase theme.
 */
export const PANEL_CSS = `
.wip-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(232px, calc(100vw - 24px));
  padding: 10px;
  border-radius: var(--radius-lg);
  background: var(--surface-container-low);
  box-shadow: 0 0 0 1px var(--outline-variant) inset, var(--shadow-card);
  color: var(--on-surface);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}
.wip-panel-title { margin: 0; font-size: 12px; font-weight: 600; }
.wip-panel-note { margin: 0; color: var(--on-surface-variant); font-size: 10px; }
.wip-panel-variants {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-md);
  background: var(--surface-container);
}
.wip-panel-variant {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 5px 6px;
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--on-surface-variant);
  font: inherit;
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}
.wip-panel-variant kbd { font: inherit; font-variant-numeric: tabular-nums; opacity: 0.6; }
.wip-panel-variant:hover { color: var(--on-surface); }
.wip-panel-variant[data-active] {
  background: var(--surface-container-high);
  color: var(--on-surface);
  font-weight: 600;
}
.wip-panel-check { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.wip-panel-variant:focus-visible,
.wip-panel-check input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
`;
