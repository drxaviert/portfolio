import type { Metadata, Viewport } from "next";
import { Work_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { NavDock } from "@/components/nav/nav-dock";
import { TypeScaleSwitcher } from "@/components/proto/type-scale-switcher";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { TYPE_SCALE_INIT_SCRIPT } from "@/lib/type-scale";
import "./globals.css";
import "./proto-type-scale.css";

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

export default function RootLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <html lang="en" className={workSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: TYPE_SCALE_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          {/* One nav for the whole site, between the page and the modal so it
              comes before the reader in tab order. */}
          <NavDock />
          {modal}
          <TypeScaleSwitcher />
        </ThemeProvider>
      </body>
    </html>
  );
}
