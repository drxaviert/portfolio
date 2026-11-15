import type { JSX } from "react";
import { TokenRow } from "@/components/system/token-row";
import { PALETTE, ROLES } from "@/lib/system/source.generated";
import type { Phase } from "@/lib/theme";

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];
const ROLE_TOKENS = Object.keys(ROLES.day);

function familyOf(token: string): string {
  return token.match(/^--palette-([a-z]+)-/)?.[1] ?? "other";
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const PALETTE_GROUPS: ReadonlyArray<[string, string[]]> = (() => {
  const groups = new Map<string, string[]>();

  for (const token of Object.keys(PALETTE)) {
    const family = familyOf(token);
    const tokens = groups.get(family) ?? [];

    tokens.push(token);
    groups.set(family, tokens);
  }

  return [...groups.entries()];
})();

function Swatch({ token }: { token: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="block size-9 rounded-xs shadow-card"
      style={{ background: `var(${token})` }}
    />
  );
}

export function ColourSection(): JSX.Element {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium">Palette · primitives</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          The raw layer. Roles point here; components use the role, never the
          primitive.
        </p>

        <div className="mt-4 space-y-6">
          {PALETTE_GROUPS.map(([family, tokens]) => (
            <div key={family}>
              <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
                {capitalise(family)}
              </h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {tokens.map((token) => (
                  <TokenRow
                    key={token}
                    token={token}
                    usage="Primitive colour. Reference it from a role."
                    preview={<Swatch token={token} />}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Roles · current time of day</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          Roles are the colours and surfaces the page actually uses. These
          values are live: move a control and they change with it.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLE_TOKENS.map((token) => (
            <TokenRow
              key={token}
              token={token}
              usage="Role token. Use this in components, not its primitive."
              preview={<Swatch token={token} />}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Defaults per phase</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          The shipped values from the generated source. The live table above
          blends these between stops.
        </p>

        <div className="mt-3 overflow-x-auto rounded-lg bg-surface-container-low shadow-card">
          <table className="w-full min-w-[40rem] text-left text-xs">
            <caption className="sr-only">
              Default role values per phase
            </caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                <th scope="col" className="px-3 py-2 font-medium">
                  Token
                </th>
                {PHASES.map((phase) => (
                  <th
                    key={phase}
                    scope="col"
                    className="px-3 py-2 font-medium"
                  >
                    {capitalise(phase)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_TOKENS.map((token) => (
                <tr key={token} className="align-top">
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    <code className="font-mono text-[11px]">{token}</code>
                  </th>
                  {PHASES.map((phase) => (
                    <td key={phase} className="px-3 py-1.5">
                      <code className="block max-w-[9rem] truncate font-mono text-[10px] text-on-surface-variant">
                        {ROLES[phase][token]}
                      </code>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
