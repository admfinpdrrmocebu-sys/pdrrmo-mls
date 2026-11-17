import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Hanken_Grotesk, Inter } from "next/font/google";
import type { User } from "@supabase/supabase-js";
import { ScreenBackground, NetworkStatusBanner } from "@/components/layout";
import { AuthProvider, type UserProfile } from "@/lib/auth/auth-context";
import type { RoleDefinition, RolePermission } from "@/lib/auth/rbac";
import { PushNotificationProvider } from "@/lib/push/push-context";
import { ThemeProvider, THEME_COOKIE_NAME, type ThemeMode } from "@/lib/theme/theme-context";
import { PersistentOperationsHost } from "@/components/nav-route/persistent-operations-host";
import { createClient } from "@/lib/supabase/server";
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
  title: "PDRRMO - IDOCS",
  description:
    "Provincial Disaster Risk Reduction and Management Office Incident Data & Operations Control System (PDRRMO-IDOCS).",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  verification: {
    google: [
      "AYj2qq5Y9ZxHq9SOPNXZ2UkkbHXUdaSQuin_PCyAQEM",
      "TYvChdWDcV1vd2haZKvCHC0_gl4wrRsVyRcnEbTapZs",
    ],
  },
};

interface ServerAuthPayload {
  initialUser: User | null;
  initialProfile: UserProfile | null;
  initialRoles: RoleDefinition[] | undefined;
}

async function loadInitialServerAuth(
  hasAuthCookie: boolean
): Promise<ServerAuthPayload> {
  if (!hasAuthCookie) {
    return { initialUser: null, initialProfile: null, initialRoles: undefined };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as
      | {
          sub?: string;
          email?: string;
          aud?: string;
          user_metadata?: Record<string, unknown>;
          app_metadata?: Record<string, unknown>;
        }
      | undefined;

    if (claimsError || !claims?.sub) {
      return { initialUser: null, initialProfile: null, initialRoles: undefined };
    }

    const userId = claims.sub;
    const initialUser: User = {
      id: userId,
      email: claims.email ?? "",
      aud: claims.aud ?? "authenticated",
      role: "authenticated",
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? {},
      created_at: "",
    } as User;

    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("access_roles")
        .select("id, code, name, badge, badge_type, description, permissions, is_system")
        .order("created_at", { ascending: true }),
    ]);

    const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
    const initialProfile: UserProfile | null = profileData
      ? ({
          ...profileData,
          full_name:
            profileData.full_name ||
            (typeof meta.full_name === "string" ? meta.full_name : "") ||
            claims.email?.split("@")[0] ||
            "Monitoring Officer",
          email: profileData.email || claims.email || "",
          position_title:
            profileData.position_title ||
            (typeof meta.position === "string" ? meta.position : "Monitoring Officer"),
          role: profileData.role || (typeof meta.role === "string" ? meta.role : "monitoring"),
          division:
            profileData.division ||
            "Provincial Disaster Risk Reduction Management Office",
          is_active: profileData.is_active ?? true,
        } as UserProfile)
      : null;

    const initialRoles: RoleDefinition[] | undefined =
      Array.isArray(rolesData) && rolesData.length > 0
        ? rolesData.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            badge: r.badge || "Operational",
            badgeType: (r.badge_type as RoleDefinition["badgeType"]) || "operational",
            description: r.description || "",
            permissions: Array.isArray(r.permissions)
              ? (r.permissions as RolePermission[])
              : [],
            isSystem: r.is_system ?? false,
          }))
        : undefined;

    return { initialUser, initialProfile, initialRoles };
  } catch {
    return { initialUser: null, initialProfile: null, initialRoles: undefined };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme: ThemeMode = themeCookie === "dark" ? "dark" : "light";
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  const { initialUser, initialProfile, initialRoles } =
    await loadInitialServerAuth(hasAuthCookie);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={initialTheme}
      className={`${hankenGrotesk.variable} ${inter.variable} h-full antialiased${
        initialTheme === "dark" ? " dark" : ""
      }`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var hasCookie = document.cookie.indexOf('${THEME_COOKIE_NAME}=') !== -1;
                  if (!hasCookie) {
                    var theme = localStorage.getItem('pdrrmo-theme');
                    if (theme === 'dark') {
                      document.documentElement.classList.add('dark');
                      document.documentElement.setAttribute('data-theme', 'dark');
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-[#004AC6]/15 selection:text-[#004AC6] transition-colors duration-200">
        <ThemeProvider initialTheme={initialTheme}>
          <ScreenBackground>
            <AuthProvider
              initialUser={initialUser}
              initialProfile={initialProfile}
              initialRoles={initialRoles}
            >
              <PushNotificationProvider>
                <NetworkStatusBanner />
                <PersistentOperationsHost>
                  {children}
                </PersistentOperationsHost>
              </PushNotificationProvider>
            </AuthProvider>
          </ScreenBackground>
        </ThemeProvider>
      </body>
    </html>
  );
}
