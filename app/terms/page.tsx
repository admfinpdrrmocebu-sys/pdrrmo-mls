import React from 'react';
import type { Metadata } from 'next';
import {
  ShieldCheck,
  HardDrive,
  Lock,
  FileText,
  CheckCircle2,
  Scale,
  Server,
  Building2,
  Database,
  Eye,
  Share2,
  Trash2,
  Cookie,
  RefreshCw,
  Mail,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy & Terms and Conditions — PDRRMO Monitoring & Logging System (MLS)',
  description:
    'Official Privacy Policy, Data Collection and Usage Disclosure, Google API Services Limited Use Policy, and Terms and Conditions for the PDRRMO Monitoring & Logging System (MLS).',
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Public Privacy Policy & Terms and Conditions Screen (/terms & /terms-and-conditions)
 * ====================================================================================
 * Server-rendered standalone public compliance document for Google Cloud OAuth
 * Consent Screen verification and Google Drive API compliance.
 * Accessible without authentication.
 */
export default function TermsAndPrivacyPolicyPage() {
  const effectiveDate = 'October 21, 2026';

  return (
    <main className="min-h-screen w-full py-10 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] text-[#1E293B]">
      <article className="max-w-4xl mx-auto space-y-8">
        {/* =================================================================== */}
        {/* 1. OFFICIAL HEADER BANNER */}
        {/* =================================================================== */}
        <header className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-[#004AC6]/5 rounded-bl-[120px] -mr-8 -mt-8 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-[#E2E8F0] p-2.5 flex items-center justify-center shrink-0 shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="PDRRMO Monitoring and Logging System Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                Official Privacy Policy, Data Governance &amp; Terms of Service
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Privacy Policy &amp; Terms and Conditions
              </h1>
              <p className="text-xs sm:text-sm text-[#505F76] font-medium">
                PDRRMO Monitoring &amp; Logging System (MLS) • Data Collection, Usage &amp; Google Drive API Compliance
              </p>
              <p className="text-xs text-[#757680]">
                Effective Date &amp; Last Updated: <strong className="text-[#1E293B]">{effectiveDate}</strong> • Application Domain:{' '}
                <a
                  href="https://pdrrmo-mls.vercel.app"
                  className="text-[#004AC6] underline font-medium"
                >
                  https://pdrrmo-mls.vercel.app
                </a>
              </p>
            </div>
          </div>
        </header>

        {/* =================================================================== */}
        {/* 2. GOOGLE API LIMITED USE DISCLOSURE CALLOUT */}
        {/* =================================================================== */}
        <section
          aria-labelledby="google-limited-use-heading"
          className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 id="google-limited-use-heading" className="text-base font-bold text-[#1E293B]">
                Google API Services User Data Policy &amp; Limited Use Disclosure
              </h2>
              <p className="text-xs text-[#757680]">
                Mandatory compliance disclosure for Google OAuth 2.0 &amp; Google Drive API integration
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#334155] leading-relaxed space-y-2">
            <p>
              <strong>PDRRMO Monitoring &amp; Logging System (MLS)</strong>&apos;s use and transfer to any
              other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#004AC6] font-semibold underline hover:opacity-80"
              >
                Google API Services User Data Policy
              </a>
              , including the <strong>Limited Use</strong> requirements.
            </p>
            <p>
              Specifically, PDRRMO MLS accesses Google Drive API scopes solely when an authorized user
              explicitly initiates an archival file transfer of official PDRRMO operational shift logs or
              VHF radio roll call reports. We do not sell Google user data, we do not use Google user data
              for advertising, and we do not use Google user data to train artificial intelligence (AI) or
              machine learning models.
            </p>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. COMPREHENSIVE PRIVACY POLICY (DATA COLLECTION & USAGE) */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-sm text-[#334155] leading-relaxed">
          <div className="border-b border-[#E2E8F0] pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#004AC6]">
              Part I — Privacy Policy
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E293B] mt-1">
              Privacy Policy: Data Collection, Usage &amp; Protection
            </h2>
            <p className="text-xs sm:text-sm text-[#505F76] mt-1">
              This Privacy Policy explains in detail what information the PDRRMO Monitoring &amp; Logging
              System (&quot;PDRRMO MLS&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;the Application&quot;) collects, how we use and
              protect that information, and how users can exercise their data privacy rights.
            </p>
          </div>

          {/* Section 1: Introduction & Overview */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#004AC6]" />
              1. Introduction &amp; Overview
            </h3>
            <p>
              The <strong>PDRRMO Monitoring &amp; Logging System (MLS)</strong>, accessible at{' '}
              <a href="https://pdrrmo-mls.vercel.app" className="text-[#004AC6] underline">
                https://pdrrmo-mls.vercel.app
              </a>
              , is an internal disaster risk reduction telemetry, shift incident logging, and VHF radio
              station roll call management web application operated for the{' '}
              <strong>Provincial Disaster Risk Reduction and Management Office (PDRRMO)</strong>. We are
              committed to protecting the privacy, confidentiality, and security of all personal data and
              Google user data processed through our platform.
            </p>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 2: Information We Collect (Data Collection) */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#004AC6]" />
              2. Information We Collect (Data Collection)
            </h3>
            <p>
              We collect only the minimum information necessary to authenticate authorized personnel,
              maintain operational disaster monitoring logs, and execute user-requested archival exports to
              Google Drive. The categories of data we collect include:
            </p>

            <div className="space-y-3 pl-1">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                <h4 className="font-bold text-[#1E293B]">
                  2.1 Account &amp; Personnel Profile Information
                </h4>
                <p className="text-xs sm:text-sm">
                  When an administrator registers an account or when a user updates their profile, we
                  collect: full name, official email address, position title, organizational division,
                  assigned shift schedule, optional profile avatar image, and optional digital signature
                  image (used for certifying official shift reports).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                <h4 className="font-bold text-[#1E293B]">
                  2.2 Operational Telemetry, Shift Logs &amp; Roll Call Records
                </h4>
                <p className="text-xs sm:text-sm">
                  During normal use of the application, we collect user-submitted operational records,
                  including daily shift logs, weather and situational updates, emergency incident entries,
                  VHF radio roll call attendance statuses, internal announcements, announcement
                  acknowledgment timestamps, and system audit logs.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                <h4 className="font-bold text-[#1E293B]">
                  2.3 Google User Data &amp; Google Drive API Scopes
                </h4>
                <p className="text-xs sm:text-sm">
                  When you explicitly click to connect your Google Account on the Archive Transfer screen to
                  export archived logs to Google Drive, we request temporary OAuth 2.0 authorization for
                  the following Google Drive API scopes:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                  <li>
                    <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-[#1E293B] font-mono text-xs">
                      https://www.googleapis.com/auth/drive.file
                    </code>{' '}
                    — Grants permission to view and manage only the specific Google Drive files and folders
                    that are created or opened with PDRRMO MLS.
                  </li>
                  <li>
                    <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-[#1E293B] font-mono text-xs">
                      https://www.googleapis.com/auth/drive
                    </code>{' '}
                    — Used when transferring compiled archive packages into an existing shared organizational
                    Google Drive folder specified by the user via Folder ID or Google Drive web link.
                  </li>
                </ul>
                <p className="text-xs sm:text-sm pt-1">
                  Through this authorization, the application receives a short-lived OAuth 2.0 access token
                  and metadata regarding the specific destination folder ID you designate and the files
                  uploaded during the transfer session.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                <h4 className="font-bold text-[#1E293B]">
                  2.4 Technical Session, Cookies &amp; Local Storage Data
                </h4>
                <p className="text-xs sm:text-sm">
                  We collect standard technical metadata necessary to maintain secure sessions, including
                  authentication session cookies managed by Supabase Auth, browser user-agent headers, and
                  client-side UI preferences (such as light/dark mode preference stored in{' '}
                  <code className="px-1 py-0.5 rounded bg-slate-200/70 font-mono text-xs">
                    localStorage
                  </code>
                  ).
                </p>
              </div>
            </div>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 3: How We Use Your Information (Data Usage) */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#004AC6]" />
              3. How We Use Your Information (Data Usage)
            </h3>
            <p>
              We use the collected information strictly for official PDRRMO operational purposes and
              user-requested features:
            </p>
            <ul className="space-y-2.5 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Authentication &amp; Role-Based Access Control (RBAC):</strong> To verify user
                  identity, enforce role permissions (Administrator, Monitoring Officer, Staff), and
                  attribute operational log entries and announcements to the responsible officer.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Operational Monitoring &amp; Report Generation:</strong> To record, display, and
                  compile daily shift logs, incident telemetry, and VHF radio roll call summaries into
                  standardized archival documents (PDF, DOCX, XLSX).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Google Drive Cloud-to-Cloud Archival Transfers (Google User Data Usage):</strong>{' '}
                  We use Google Drive API access exclusively to:
                  <ul className="list-disc pl-5 mt-1.5 space-y-1 text-xs sm:text-sm">
                    <li>
                      Verify that the user-designated Google Drive destination folder exists and is writable
                      by the authenticated Google Account.
                    </li>
                    <li>
                      Create date-structured archive subfolders (when configured by the user) inside the
                      designated destination folder.
                    </li>
                    <li>
                      Upload selected Shift Log and Roll Call archive files directly from PDRRMO MLS to the
                      user&apos;s designated Google Drive folder upon explicit user confirmation.
                    </li>
                  </ul>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No Background or Unsolicited Access:</strong> PDRRMO MLS never accesses your
                  Google Drive in the background when you are not actively performing a transfer, and never
                  reads, indexes, modifies, or deletes unrelated personal or organizational files stored in
                  your Google Drive.
                </span>
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 4: Google API Limited Use Requirements */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#004AC6]" />
              4. Compliance with Google API Services User Data Policy (Limited Use)
            </h3>
            <p>
              Our integration with Google OAuth 2.0 and the Google Drive API strictly complies with all
              provisions of the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#004AC6] font-semibold underline"
              >
                Google API Services User Data Policy
              </a>
              :
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Limited Use Only:</strong> Google user data is used exclusively to provide the
                user-facing Google Drive archive transfer feature visible in the PDRRMO MLS interface.
              </li>
              <li>
                <strong>No Sale of Data:</strong> We never sell, license, rent, or trade Google user data
                or personal information to any third party, data broker, or marketing entity.
              </li>
              <li>
                <strong>No Advertising or Profiling:</strong> We never use Google user data for serving
                advertisements, including retargeting, personalized, or interest-based advertising.
              </li>
              <li>
                <strong>No AI / ML Model Training:</strong> We never use Google user data or files accessed
                via Google APIs to train, fine-tune, or improve generalized artificial intelligence (AI) or
                machine learning (ML) models.
              </li>
              <li>
                <strong>Strict Human Access Restrictions:</strong> No human personnel outside the
                authenticated user can view your Google Drive data through our application unless you
                explicitly grant affirmative consent for troubleshooting a specific technical support issue,
                or where strictly required by law or security investigation.
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 5: Data Sharing, Transfer & Third-Party Disclosure */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#004AC6]" />
              5. Data Sharing, Transfer &amp; Third-Party Disclosure
            </h3>
            <p>
              We do not share, disclose, or transfer your personal data or Google user data to third
              parties except in the following limited, service-essential circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Authorized Organizational Personnel:</strong> Operational shift logs, roll call
                records, and announcement acknowledgments are accessible to authenticated PDRRMO officers
                in accordance with their assigned Role-Based Access Control (RBAC) clearance.
              </li>
              <li>
                <strong>Google LLC (Google Drive API):</strong> When you initiate an archive transfer, the
                selected archival files are transmitted directly to Google Drive APIs using your authorized
                OAuth 2.0 session.
              </li>
              <li>
                <strong>Core Cloud Infrastructure Providers:</strong> We utilize <strong>Supabase</strong>{' '}
                (for managed PostgreSQL database, authentication, and encrypted file storage) and{' '}
                <strong>Vercel</strong> (for secure HTTPS web application hosting). These providers act
                strictly as data processors bound by enterprise security and confidentiality obligations.
              </li>
              <li>
                <strong>Legal &amp; Regulatory Requirements:</strong> Where disclosure is mandated by
                applicable Philippine law, government audit, or lawful court order.
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 6: Data Storage & Security */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#004AC6]" />
              6. Data Storage, Security &amp; Protection Mechanisms
            </h3>
            <p>
              We implement industry-standard administrative, technical, and physical safeguards to protect
              all collected data and Google OAuth credentials against unauthorized access, alteration,
              disclosure, or destruction:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Encryption in Transit:</strong> All communication between your web browser, our
                application servers, Supabase, and Google APIs is encrypted using HTTPS / TLS 1.2+ and TLS
                1.3 protocols.
              </li>
              <li>
                <strong>Encryption at Rest:</strong> Operational database records and archived document
                buckets hosted on Supabase are encrypted at rest using AES-256 encryption.
              </li>
              <li>
                <strong>Ephemeral In-Memory OAuth Token Handling:</strong> Google OAuth 2.0 access tokens
                issued via Google Identity Services are held strictly in volatile memory within your active
                browser session only for the duration of the archive transfer operation. We do{' '}
                <strong>not</strong> store your Google account password or persist raw Google OAuth access
                tokens in any database table.
              </li>
              <li>
                <strong>Row-Level Security (RLS):</strong> Database tables enforce PostgreSQL Row-Level
                Security policies and server-side middleware validation to prevent unauthorized access.
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 7: Data Retention, Revocation & Deletion */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-[#004AC6]" />
              7. Data Retention, Access Revocation &amp; Deletion Rights
            </h3>
            <p>
              We retain operational data only for as long as necessary to fulfill the official disaster
              monitoring and archival mandates of the PDRRMO, and we provide clear mechanisms for revoking
              access or requesting data deletion:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Google OAuth Token Retention:</strong> Google OAuth 2.0 tokens are ephemeral,
                expire automatically after the browser session or token TTL (typically 1 hour), and can be
                cleared immediately by signing out or refreshing the page.
              </li>
              <li>
                <strong>Revoking Google Account Permissions:</strong> You may revoke PDRRMO MLS&apos;s
                access to your Google Account at any time by visiting your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#004AC6] font-semibold underline hover:opacity-80"
                >
                  Google Account Security &amp; Third-Party Access Settings
                  (https://myaccount.google.com/permissions)
                </a>
                . Revoking access immediately terminates our ability to make Google Drive API calls on your
                behalf.
              </li>
              <li>
                <strong>Operational Archive Purge:</strong> Once operational shift logs and roll call
                records are archived and transferred to Google Drive, system administrators can purge the
                local cloud storage copies directly through the Archive Transfer &amp; Purge interface.
              </li>
              <li>
                <strong>Requesting Account &amp; Personal Data Deletion:</strong> Users have the right to
                request access to, correction of, or permanent deletion of their user profile and personal
                data by contacting the PDRRMO System Administrator at the contact address listed in Section
                11 below. Verified deletion requests are processed within thirty (30) days.
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 8: Cookies & Local Storage */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Cookie className="w-4 h-4 text-[#004AC6]" />
              8. Cookies &amp; Local Storage Policy
            </h3>
            <p>
              PDRRMO MLS uses strictly necessary first-party cookies and browser local storage to operate
              the application. Specifically, we use secure HTTP authentication cookies to maintain your
              signed-in Supabase session across page reloads, and browser{' '}
              <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-xs">localStorage</code> to
              remember your interface theme preference (Light Mode or Dark Mode). We do not use third-party
              advertising or cross-site tracking cookies.
            </p>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 9: Changes to This Privacy Policy */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#004AC6]" />
              9. Changes to This Privacy Policy
            </h3>
            <p>
              We may update this Privacy Policy and Terms and Conditions from time to time to reflect
              operational enhancements, regulatory updates, or Google API policy changes. Any modifications
              will be posted directly on this page (<code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-xs">/terms-and-conditions</code>) with an updated{' '}
              <strong>Effective Date</strong> at the top of the document.
            </p>
          </section>
        </div>

        {/* =================================================================== */}
        {/* 4. PART II — TERMS AND CONDITIONS OF SERVICE */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-sm text-[#334155] leading-relaxed">
          <div className="border-b border-[#E2E8F0] pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#004AC6]">
              Part II — Terms of Service
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E293B] mt-1">
              Terms and Conditions of Use
            </h2>
            <p className="text-xs sm:text-sm text-[#505F76] mt-1">
              Rules, responsibilities, and operational terms governing access to the PDRRMO Monitoring
              &amp; Logging System and its Google Drive API archival tools.
            </p>
          </div>

          {/* Section 10 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#004AC6]" />
              10. Acceptance of Terms, Acceptable Use &amp; User Responsibilities
            </h3>
            <p>
              By accessing or using the <strong>PDRRMO Monitoring &amp; Logging System (MLS)</strong>, you
              agree to comply with these Terms and Conditions and the Privacy Policy above:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Authorized Personnel Only:</strong> Access to protected operational dashboards is
                restricted to authorized PDRRMO officers and staff with active credentials.
              </li>
              <li>
                <strong>Folder Clearance for Google Drive Transfers:</strong> Users initiating Google Drive
                archive transfers must ensure they possess appropriate organizational authorization and
                write permissions for the destination Google Drive folder ID or web link.
              </li>
              <li>
                <strong>Prohibited Conduct:</strong> Users agree not to use the platform or its Google
                Drive integration to upload malicious files, falsify disaster telemetry records, or bypass
                role-based security controls.
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 11 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#004AC6]" />
              11. Service Availability &amp; Limitation of Liability
            </h3>
            <p>
              The Google Drive transfer workflow depends on the availability of Google Cloud and Google
              Drive API services. PDRRMO MLS verifies upload completion before marking archival batches as
              transferred; however, the platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
              warranties of uninterrupted third-party API uptime.
            </p>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 12: Contact Information */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#004AC6]" />
              12. Governing Organization &amp; Privacy Contact Information
            </h3>
            <p>
              If you have any questions, concerns, or requests regarding this <strong>Privacy Policy</strong>,
              our data collection and usage practices, Google Drive API compliance, or these{' '}
              <strong>Terms and Conditions</strong>, please contact our Data Protection &amp; System
              Administration team:
            </p>
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm space-y-1.5">
              <p className="font-bold text-[#1E293B] text-sm">
                Provincial Disaster Risk Reduction and Management Office (PDRRMO)
              </p>
              <p className="text-[#505F76] font-medium">
                Monitoring &amp; Logging System (MLS) — Data Governance &amp; System Administration
              </p>
              <p className="text-[#757680]">
                Address: Cebu Provincial Capitol Compound, Escario St., Cebu City, 6000 Cebu, Philippines
              </p>
              <p className="text-[#505F76] flex items-center gap-1.5 pt-1">
                <Mail className="w-4 h-4 text-[#004AC6] shrink-0" />
                <span>
                  Official Contact Email:{' '}
                  <a
                    href="mailto:pdrrmo.mls.admin@gmail.com"
                    className="text-[#004AC6] font-semibold underline"
                  >
                    pdrrmo.mls.admin@gmail.com
                  </a>
                </span>
              </p>
              <p className="text-[#505F76] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#004AC6] shrink-0" />
                <span>
                  Policy URL:{' '}
                  <a
                    href="https://pdrrmo-mls.vercel.app/terms-and-conditions"
                    className="text-[#004AC6] font-semibold underline"
                  >
                    https://pdrrmo-mls.vercel.app/terms-and-conditions
                  </a>
                </span>
              </p>
            </div>
          </section>
        </div>

        {/* Footer Caption */}
        <footer className="text-center text-xs text-[#757680] space-y-1">
          <p>
            &copy; {new Date().getFullYear()} Provincial Disaster Risk Reduction and Management Office
            (PDRRMO) — Monitoring &amp; Logging System. All rights reserved.
          </p>
          <p>
            Privacy Policy &amp; Terms and Conditions • Compliant with Google API Services User Data Policy
          </p>
        </footer>
      </article>
    </main>
  );
}
