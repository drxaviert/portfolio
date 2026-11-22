import type { Metadata, Viewport } from "next";
import { Work_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { SharedHorizon } from "@/components/horizon/shared-horizon";
import { NavDock } from "@/components/nav/nav-dock";
import { MobileGate } from "@/components/system/mobile-gate";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // --surface in globals.css: neutral-200 (#e5e5e5) in Dawn, Day and Dusk,
  // neutral-700 (#0d0d0d) in Night. The phase itself follows the clock, so the
  // media query is the closest the browser gives us.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e5e5e5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

/**
 * The mobile gate's bypass, before paint. The session flag is the visitor's
 * choice for this tab, so a bypassed reload must never flash the gate. The
 * viewport meta may be injected after this head script runs, hence the short
 * observer; MobileGate's effect re-applies it after hydration.
 *
 * Desktop browsers ignore the meta. If the layout viewport is still under 768
 * after load, the bypass cannot be honored, so drop the marker and the flag:
 * the gate's CSS already follows the viewport, so the stacked layout is never
 * what this load shows.
 */
/**
 * The /work prototype's pre-paint switch. The index is a static shell and cannot
 * see the query, so a hard load of `?thumb=left` would paint the shipped cursor
 * layout first and jump ~480px when `WorkList` reads the param after hydration.
 * This sets the marker the docked CSS keys on with the same fit test the
 * component uses, before the list is parsed; a soft arrival never runs this and
 * takes WorkList's own layout effect, which also keeps the marker current after
 * a resize or a dev-toggle switch.
 */
const WORK_THUMB_INIT_SCRIPT = `(function(){try{if(location.pathname.indexOf("/work")!==0)return;var fits=window.matchMedia("(min-width: 1200px) and (hover: hover) and (pointer: fine)").matches;if(fits&&new URLSearchParams(location.search).get("thumb")==="left")document.documentElement.setAttribute("data-work-thumb","left");}catch(error){}})();`;

const MOBILE_GATE_INIT_SCRIPT = `(function(){try{if(window.sessionStorage.getItem("mobile-gate:desktop")!=="1")return;var root=document.documentElement;root.setAttribute("data-desktop-view","");var apply=function(){var meta=document.querySelector('meta[name="viewport"]');if(!meta)return false;meta.setAttribute("content","width=1280");return true;};if(!apply()){var observer=new MutationObserver(function(){if(apply())observer.disconnect();});observer.observe(document.head,{childList:true,subtree:true});window.setTimeout(function(){observer.disconnect();},1000);}var check=function(){if(!window.matchMedia("(max-width: 767.98px)").matches)return;root.removeAttribute("data-desktop-view");try{window.sessionStorage.removeItem("mobile-gate:desktop");}catch(error){}};var afterLoad=function(){requestAnimationFrame(check);};if(document.readyState==="complete"){afterLoad();}else{window.addEventListener("load",afterLoad);}}catch(error){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={workSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: WORK_THUMB_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MOBILE_GATE_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <SharedHorizon />
          {children}
          {/* One nav for the whole site, after the page so the overlay's focus
              trap can cycle from the panel into it. The homepage's edge blur is
              mounted by `/` itself (app/page.tsx), not here. */}
          <NavDock />
          <MobileGate />
        </ThemeProvider>
      </body>
    </html>
  );
}
