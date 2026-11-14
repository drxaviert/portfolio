import type { CSSProperties } from "react";

export type Mode = "still" | "loop";

type Tone = "ink" | "mid" | "strong" | "solid";

/** A placeholder block. All four tones are design-system tokens. */
function Bar({
  w,
  h = 6,
  tone = "ink",
  r = 999,
  style,
}: {
  w: number | string;
  h?: number;
  tone?: Tone;
  r?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="fu-bar"
      data-tone={tone}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

function Plus() {
  return (
    <svg className="fu-plus" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M5 1.6v6.8M1.6 5h6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The macOS-style arrow, its hotspot on the button's centre. */
function Cursor() {
  return (
    <span className="fu-cursor" aria-hidden="true">
      <svg viewBox="0 0 22 22">
        <path d="M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z" />
      </svg>
    </span>
  );
}

function StatusIcons() {
  return (
    <span className="fu-status__icons" aria-hidden="true">
      <svg width="17" height="11" viewBox="0 0 17 11">
        <rect x="0" y="7.5" width="3" height="3.5" rx="1" fill="currentColor" />
        <rect
          x="4.5"
          y="5.5"
          width="3"
          height="5.5"
          rx="1"
          fill="currentColor"
        />
        <rect x="9" y="3.2" width="3" height="7.8" rx="1" fill="currentColor" />
        <rect
          x="13.5"
          y="0.6"
          width="3"
          height="10.4"
          rx="1"
          fill="currentColor"
        />
      </svg>
      <svg width="15" height="11" viewBox="0 0 15 11">
        <path
          d="M1 3.9a9.2 9.2 0 0 1 13 0M4.1 7a5 5 0 0 1 6.8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="7.5" cy="9.8" r="1.15" fill="currentColor" />
      </svg>
      <svg width="23" height="11" viewBox="0 0 23 11">
        <rect
          x="0.5"
          y="0.5"
          width="19"
          height="10"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
        />
        <rect x="2" y="2" width="16" height="7" rx="1.6" fill="currentColor" />
        <path
          d="M21.4 3.4v4.2"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

const NAV = ["Overview", "Projects", "Reports", "Settings"];

const STATS: { label: number; value: number; bare: number }[] = [
  { label: 34, value: 62, bare: 20 },
  { label: 40, value: 48, bare: 26 },
  { label: 28, value: 56, bare: 18 },
];

const WINDOW_BARS = [42, 58, 34, 66, 48, 74, 56];

export function WindowScene({ mode }: { mode: Mode }) {
  return (
    <div className="fu-window" data-mode={mode}>
      <aside className="fu-window__side">
        <div className="fu-lights" aria-hidden="true">
          <span className="fu-light" />
          <span className="fu-light" />
          <span className="fu-light" />
        </div>

        <div className="fu-brand" aria-hidden="true">
          <span className="fu-logo" />
          <span className="fu-brand-bar" />
        </div>

        <nav className="fu-nav" aria-hidden="true">
          {NAV.map((label, index) => (
            <div
              key={label}
              className="fu-nav-row"
              data-on={index === 0 || undefined}
            >
              <span className="fu-nav-ico" />
              {label}
            </div>
          ))}
        </nav>

        <span className="fu-side-divider" aria-hidden="true" />

        <nav className="fu-nav fu-nav--filler" aria-hidden="true">
          {[64, 48, 56].map((width) => (
            <div key={width} className="fu-nav-row">
              <span className="fu-nav-dot" />
              <Bar w={width} h={6} />
            </div>
          ))}
        </nav>
      </aside>

      <div className="fu-window__main">
        <header className="fu-toolbar">
          <span className="fu-title">Overview</span>

          <span className="fu-search" aria-hidden="true">
            <span className="fu-search__dot" />
            <Bar w={48} h={5} />
          </span>

          <span className="fu-new">
            <Plus />
            New
            <Cursor />
          </span>
        </header>

        <div className="fu-body" aria-hidden="true">
          <div className="fu-stats">
            {STATS.map((stat, index) => (
              <div key={index} className="fu-stat">
                <Bar w={stat.label} h={6} tone="ink" />
                <span className="fu-stat-row">
                  <Bar w={stat.value} h={14} tone="mid" r={4} />
                  <Bar w={stat.bare} h={5} tone="ink" />
                </span>
              </div>
            ))}
          </div>

          <div className="fu-chart">
            <div className="fu-chart-head">
              <Bar w={64} h={7} tone="mid" />
              <span className="fu-chart-pill">
                <i />
                <i data-on="true" />
                <i />
              </span>
            </div>

            <div className="fu-bars">
              {WINDOW_BARS.map((height, index) => (
                <span
                  key={index}
                  data-on={index === 5 || undefined}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          <div className="fu-list">
            <div className="fu-list-head">
              <Bar w={46} h={6} tone="mid" />
              <Bar w={22} h={6} tone="ink" />
            </div>

            {[0, 1, 2].map((index) => (
              <div key={index} className="fu-list-row">
                <span className="fu-list-thumb" />
                <Bar
                  w={[118, 92, 106][index]}
                  h={6}
                  tone={index === 0 ? "mid" : "ink"}
                />
                <Bar w={28} h={5} tone="ink" style={{ marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const ROWS: { name: number; sub: number }[] = [
  { name: 132, sub: 78 },
  { name: 110, sub: 64 },
  { name: 148, sub: 92 },
  { name: 96, sub: 58 },
];

export function PhoneScene({ mode }: { mode: Mode }) {
  return (
    <div className="fu-phone" data-mode={mode}>
      <div className="fu-phone__screen">
        <div className="fu-status" aria-hidden="true">
          <span>9:41</span>
          <StatusIcons />
        </div>

        <header className="fu-phone__head" aria-hidden="true">
          <Bar w={52} h={7} tone="strong" />
          <div className="fu-phone__title-row">
            <span className="fu-phone__title">Overview</span>
            <span className="fu-phone__avatar" />
          </div>
        </header>

        <div className="fu-phone__list" aria-hidden="true">
          <span className="fu-phone__hl" />

          {ROWS.map((row, index) => (
            <div key={index} className="fu-phone__row">
              <span className="fu-thumb" />
              <span className="fu-phone__row-text">
                <Bar w={row.name} h={8} tone="strong" />
                <Bar w={row.sub} h={6} />
              </span>
              <Bar w={26} h={6} tone="ink" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TILE_BARS = [46, 62, 38, 74, 54, 82, 60, 70];
const NOTIFICATIONS = [96, 74, 62];

export function TilesScene({ mode }: { mode: Mode }) {
  return (
    <div className="fu-tiles" data-mode={mode} aria-hidden="true">
      <div className="fu-tile fu-tile--chart">
        <span className="fu-tile__label">Activity</span>
        <span className="fu-tile__value">
          <Bar w={104} h={22} tone="mid" r={5} />
        </span>
        <span className="fu-tile__delta">
          <Bar w={30} h={6} tone="mid" />
          <Bar w={18} h={6} tone="ink" />
        </span>

        <div className="fu-bars">
          {TILE_BARS.map((height, index) => (
            <span
              key={index}
              data-on={index === 5 || undefined}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>

      <div className="fu-tile">
        <div className="fu-tile__head">
          <span className="fu-tile__label">Notifications</span>
          <span className="fu-toggle">
            <span className="fu-toggle__knob" />
          </span>
        </div>

        <div className="fu-minis">
          {NOTIFICATIONS.map((width, index) => (
            <span
              key={index}
              className="fu-mini"
              data-on={index === 0 || undefined}
            >
              <span className="fu-mini__dot" />
              <Bar w={width} h={6} tone={index === 0 ? "mid" : "ink"} />
            </span>
          ))}
        </div>
      </div>

      <div className="fu-tile">
        <div className="fu-tile__head">
          <span className="fu-tile__label">Team</span>
          <Bar w={28} h={6} tone="ink" />
        </div>

        <div className="fu-facepile">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="fu-face" />
          ))}
        </div>

        <Bar w={118} h={6} tone="mid" style={{ marginTop: 14 }} />

        <span className="fu-meter">
          <span />
        </span>
      </div>
    </div>
  );
}
