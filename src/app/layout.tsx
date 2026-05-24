/**
 * Root layout for the Next.js App Router.
 *
 * The layout is a Server Component (no `"use client"`) — it loads the global
 * Tailwind stylesheet, exports the document `<html>` / `<body>` shell, and
 * delegates SEO metadata to `generateMetadata` callers further down the tree
 * (e.g. `/c/[slug]/page.tsx`). Keep this file logic-light: anything that
 * needs hooks, state, or browser APIs belongs in a client component nested
 * deeper in the tree.
 */

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "NavbatCore — Real-Time Clinic Queue Infrastructure",
    template: "%s · NavbatCore",
  },
  description:
    "Multi-tenant, zero-error queue infrastructure for clinics. Millisecond-precise live tickets, Liquid Glass UI, encrypted cold archive.",
  applicationName: "NavbatCore",
  keywords: [
    "clinic queue",
    "navbat",
    "real-time queue",
    "appointment infrastructure",
    "multi-tenant SaaS",
  ],
  authors: [{ name: "NavbatCore" }],
  openGraph: {
    title: "NavbatCore — Real-Time Clinic Queue Infrastructure",
    description:
      "Multi-tenant, zero-error queue infrastructure for clinics with millisecond-precise live tickets.",
    type: "website",
    siteName: "NavbatCore",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#070914",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-navbat-ink font-display text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
