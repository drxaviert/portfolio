import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Design engineer portfolio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
