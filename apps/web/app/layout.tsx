import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StatMentor AI",
    template: "%s | StatMentor AI",
  },
  description:
    "A guided statistical workspace for doctoral researchers—from research design to defensible analysis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
