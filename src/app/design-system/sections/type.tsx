import type { JSX } from "react";
import { TokenRow } from "@/components/system/token-row";

const TEXT_TOKENS = [
  "--text-xs",
  "--text-sm",
  "--text-base",
  "--text-lg",
  "--text-xl",
  "--text-2xl",
  "--text-3xl",
  "--text-4xl",
  "--text-title",
  "--text-title-sm",
];

export function TypeSection(): JSX.Element {
  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-on-surface-variant">
        Work Sans carries every size. Headings stay medium; body uses the
        scale below.
      </p>

      <p className="font-sans text-2xl font-medium tracking-tight">
        Work Sans
      </p>

      <div className="space-y-2">
        {TEXT_TOKENS.map((token) => (
          <TokenRow
            key={token}
            token={token}
            usage="Type scale token."
            preview={
              <span
                aria-hidden="true"
                className="block w-24 truncate font-medium leading-none"
                style={{ fontSize: `var(${token})` }}
              >
                Aa
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
