import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { DayRowVariantPanel } from "@/components/theme/day-row-variant-panel";
import { ThemeProvider } from "@/components/theme/theme-provider";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={workSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        {/* Dev-only comparison of the Day row's keyboard-open variants. */}
        {process.env.NODE_ENV === "development" ? <DayRowVariantPanel /> : null}
      </body>
    </html>
  );
}
