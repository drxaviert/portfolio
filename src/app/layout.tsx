import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { NavDock } from "@/components/nav/nav-dock";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ENTRANCE_INIT_SCRIPT } from "@/lib/entrance-script";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Design engineer portfolio.",
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
        {/* T14 only: the blur-variant comparison switch. */}
        <script dangerouslySetInnerHTML={{ __html: ENTRANCE_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          {/* One nav for the whole site, between the page and the modal so it
              comes before the reader in tab order. */}
          <NavDock />
          {modal}
        </ThemeProvider>
      </body>
    </html>
  );
}
