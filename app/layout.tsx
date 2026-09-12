import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Inter } from "next/font/google";
import { ScreenBackground } from "@/components/layout";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

/**
 * ============================================================================
 * MODERN FINTECH PRECISION — UI/UX DESIGN SYSTEM INSIGHTS & SPECIFICATION
 * ============================================================================
 * Reference: Google Stitch Project (ID: 16431745712621379672) — MLS Insight Monitor
 *
 * 1. DESIGN PHILOSOPHY & AESTHETIC:
 *    - "Modern Fintech Precision" marries enterprise-grade operational reliability
 *      with the fluid, welcoming aesthetic of high-trust fintech dashboards.
 *    - High-density telemetry & log tracking presented through clean visual hierarchy,
 *      eliminating cognitive fatigue through deliberate contrast, generous white space,
 *      and soft tactile depth.
 *
 * 2. CORE PALETTE & TOKEN SPECIFICATIONS:
 *    - Primary (#004AC6 / #003594): High-authority actionable blue for buttons, active
 *      nav items, primary indicators, and focus rings.
 *    - Secondary (#505F76): Slate navy for structural framing, tab headers, and secondary actions.
 *    - Tertiary (#943700): Energetic amber/rust for badges, critical callouts, and alerts.
 *    - Neutral (#757680): Balanced gray for metadata, timestamps, and muted text.
 *    - App Canvas (#F8FAFC): Cool, soft off-white background preventing ocular strain.
 *    - Surface Cards (#FFFFFF): Elevated cards with subtle 1px border (#E2E8F0) and soft depth.
 *    - High Contrast Text (#1E293B / #111C2D): Crisp primary typography for maximum legibility.
 *
 * 3. COMPONENT WRAPPER ARCHITECTURE (Phase 1):
 *    - Strict wrapper component pattern: All UI elements are encapsulated in reusable
 *      primitives under `components/` (button, card, input, table, nav-route).
 *    - Pure static presentation and responsive layouts in Phase 1; clean separation
 *      of concerns ready for Supabase database hooks in Phase 2.
 * ============================================================================
 */

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#004AC6",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "PDRRMO MLS — Monitoring & Logging System",
  description:
    "Provincial Disaster Risk Reduction and Management Office (PDRRMO) Modern Precision Monitoring & Logging System.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hankenGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-[#004AC6]/15 selection:text-[#004AC6]">
        <ScreenBackground>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ScreenBackground>
      </body>
    </html>
  );
}
