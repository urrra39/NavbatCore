/**
 * Root layout for the Next.js App Router.
 *
 * Light-mode clinical canvas (Akfa Medline white-label dashboard).
 * Server Component — only loads global styles, declares the document
 * shell, and emits SEO + viewport metadata. The interactive dashboard
 * lives in nested client components.
 */

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Akfa Medline · Bosh navbat boshqaruv paneli",
    template: "%s · NavbatCore",
  },
  description:
    "Akfa Medline shifoxonalar tarmog'i uchun klinik navbat boshqaruv tizimi. Bo'limlar bo'yicha bemorlar saralash, real vaqt holati nazorati va saralash algoritmi.",
  applicationName: "NavbatCore",
  keywords: [
    "Akfa Medline",
    "shifoxona navbat",
    "klinik panel",
    "saralash algoritmi",
    "navbat boshqaruvi",
  ],
  authors: [{ name: "NavbatCore" }],
  openGraph: {
    title: "Akfa Medline · Bosh navbat boshqaruv paneli",
    description:
      "Bo'limlar bo'yicha jonli navbat va saralash algoritmi (Yengil 15 daq · O'rta 25 daq · Og'ir 45 daq).",
    type: "website",
    siteName: "Akfa Medline",
    locale: "uz_UZ",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
