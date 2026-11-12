/**
 * Horizon glow tuner chrome: fixed bottom-right, above the phase picker.
 * Themed with the phase tokens (surface/text/outline) so it stays readable in
 * both Day and Night. Same "harness, not design" posture as the work-carousel
 * panel, but phase-token themed instead of opaque dark glass.
 */
export const GLOW_TUNER_CSS = `
.glow-tuner {
  position: fixed;
  right: 12px;
  bottom: 64px;
  z-index: 50;
  width: 272px;
  max-width: calc(100vw - 24px);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
  color: var(--on-surface);
  -webkit-font-smoothing: antialiased;
  pointer-events: none;
}

.glow-tuner-open,
.glow-tuner-launch {
  pointer-events: auto;
}

@media (min-width: 768px) {
  .glow-tuner {
    right: 16px;
    bottom: 72px;
  }
}

.glow-tuner-open {
  display: flex;
  flex-direction: column;
  max-height: min(78dvh, 720px);
  overflow: hidden;
  border: 1px solid var(--outline-variant);
  border-radius: 10px;
  background: var(--surface-container-low);
  box-shadow: var(--shadow-card);
}

.glow-tuner-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--outline-variant);
}

.glow-tuner-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.glow-tuner-phase {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-container);
  color: var(--on-surface);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  text-transform: capitalize;
}

.glow-tuner-toggle,
.glow-tuner-launch {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--outline-variant);
  background: var(--surface-container-low);
  color: var(--on-surface);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.glow-tuner-toggle {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 5px;
  font-size: 12px;
  line-height: 1;
}

.glow-tuner-launch {
  gap: 6px;
  padding: 5px 9px;
  border-radius: 8px;
  box-shadow: var(--shadow-card);
}

.glow-tuner-toggle:hover,
.glow-tuner-launch:hover {
  background: var(--surface-container);
}

.glow-tuner-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 10px;
  overflow-y: auto;
}

.glow-tuner-group {
  margin: 0;
  color: var(--on-surface-variant);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.glow-tuner-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.glow-tuner-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1px 8px;
}

.glow-tuner-label {
  color: var(--on-surface-variant);
}

.glow-tuner-value {
  color: var(--on-surface);
  font-variant-numeric: tabular-nums;
}

.glow-tuner-range {
  grid-column: 1 / -1;
  width: 100%;
  height: 14px;
  margin: 0;
  accent-color: var(--primary);
  cursor: pointer;
}

.glow-tuner-color {
  grid-column: 1 / -1;
  width: 100%;
  height: 20px;
  padding: 0;
  border: 1px solid var(--outline-variant);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.glow-tuner-color::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.glow-tuner-color::-webkit-color-swatch,
.glow-tuner-color::-moz-color-swatch {
  border: 0;
  border-radius: 2px;
}

.glow-tuner-select {
  grid-column: 1 / -1;
  width: 100%;
  padding: 3px 4px;
  border: 1px solid var(--outline-variant);
  border-radius: 5px;
  background: var(--surface-container);
  color: var(--on-surface);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.glow-tuner-details {
  padding-top: 6px;
  border-top: 1px solid var(--outline-variant);
}

.glow-tuner-summary {
  color: var(--on-surface-variant);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.glow-tuner-details[open] .glow-tuner-summary {
  margin-bottom: 6px;
}

.glow-tuner-check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--on-surface-variant);
  cursor: pointer;
}

.glow-tuner-check input {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--primary);
}

.glow-tuner-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding-top: 2px;
}

.glow-tuner-button {
  padding: 4px 2px;
  border: 1px solid var(--outline-variant);
  border-radius: 5px;
  background: var(--surface-container);
  color: var(--on-surface);
  font: inherit;
  font-size: 9px;
  white-space: nowrap;
  cursor: pointer;
}

.glow-tuner-button:hover {
  background: var(--surface-container-high);
}

.glow-tuner-hint {
  margin: 0;
  color: var(--on-surface-variant);
  font-size: 9px;
}

.glow-tuner button:focus-visible,
.glow-tuner input:focus-visible,
.glow-tuner select:focus-visible,
.glow-tuner summary:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
`;
