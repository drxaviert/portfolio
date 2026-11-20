"use client";

import { useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

/**
 * The stateful half of `<StepFigure>`. The server wrapper resolves a `media`
 * id into a `<Media>` element and passes it down as `media`, so the panel can
 * hold a real picture without this file importing the manifest reader.
 */
export function StepFigurePanel({
  steps,
  media,
}: {
  steps: string[];
  media?: ReactNode;
}) {
  const [step, setStep] = useState(0);
  const tabId = (index: number) => `wd-step-tab-${index}`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % steps.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + steps.length - 1) % steps.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = steps.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setStep(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <figure className="wd-step">
      <div
        id="wd-step-panel"
        className="wd-step-panel"
        role="tabpanel"
        aria-labelledby={tabId(step)}
      >
        {media ?? <div className="wd-media wd-step-media" />}

        <div className="wd-step-bar">
          <div
            className="wd-step-tabs"
            role="tablist"
            aria-label="Figure steps"
          >
            {steps.map((caption, index) => (
              <button
                key={caption}
                id={tabId(index)}
                type="button"
                role="tab"
                className="wd-step-tab"
                aria-selected={index === step}
                aria-controls="wd-step-panel"
                tabIndex={index === step ? 0 : -1}
                onClick={() => setStep(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="wd-step-replay"
            onClick={() => setStep(0)}
          >
            Replay
          </button>
        </div>

        <p className="wd-caption" aria-live="polite">
          {steps[step]}
        </p>
      </div>
    </figure>
  );
}
