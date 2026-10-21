'use client';

import React from 'react';
import {
  ShieldCheck,
  HardDrive,
  Lock,
  FileText,
  CheckCircle2,
  Scale,
  Server,
  Building2,
} from 'lucide-react';

/**
 * Public Terms & Conditions Screen (/terms)
 * =========================================
 * Standalone public compliance page for Google Cloud OAuth Consent Screen
 * and Google Drive API verification. Accessible without authentication.
 */
export default function TermsAndConditionsPage() {
  const lastUpdated = 'October 21, 2026';

  return (
    <main className="min-h-screen w-full py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* =================================================================== */}
        {/* 1. OFFICIAL HEADER BANNER */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-[#004AC6]/5 rounded-bl-[120px] -mr-8 -mt-8 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-[#E2E8F0] p-2.5 flex items-center justify-center shrink-0 shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="PDRRMO Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                Official Terms of Service & Google API Compliance
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
                Terms and Conditions
              </h1>
              <p className="text-xs sm:text-sm text-[#505F76] font-medium">
                PDRRMO Monitoring &amp; Logging System (MLS) • Google Drive API Integration Policy
              </p>
              <p className="text-xs text-[#757680]">
                Effective Date &amp; Last Updated: <strong className="text-[#1E293B]">{lastUpdated}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. GOOGLE API LIMITED USE DISCLOSURE CALLOUT */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">
                Google API Services User Data Policy &amp; Limited Use Disclosure
              </h2>
              <p className="text-xs text-[#757680]">
                Mandatory compliance statement for Google OAuth 2.0 &amp; Google Drive API integration
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#334155] leading-relaxed">
            <strong>PDRRMO Monitoring &amp; Logging System (MLS)</strong>&apos;s use and transfer to any
            other application of information received from Google APIs will strictly adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#004AC6] font-semibold underline hover:opacity-80"
            >
              Google API Services User Data Policy
            </a>
            , including the <strong>Limited Use</strong> requirements. Google Drive access is utilized
            solely for user-initiated archival transfers of official operational reports.
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. DETAILED TERMS & CONDITIONS SECTIONS */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-sm text-[#334155] leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#004AC6]" />
              1. Acceptance of Terms &amp; System Purpose
            </h3>
            <p>
              By accessing and using the <strong>PDRRMO Monitoring &amp; Logging System (MLS)</strong> and
              its optional Google Drive archival integration, you agree to be bound by these Terms and
              Conditions. The PDRRMO MLS is an operational telemetry, incident shift logging, and VHF
              station roll call monitoring platform operated for the{' '}
              <strong>Provincial Disaster Risk Reduction and Management Office (PDRRMO)</strong>.
            </p>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#004AC6]" />
              2. Scope of Google Drive API Usage
            </h3>
            <p>
              When an authorized user chooses to export or migrate archived operational logs to Google
              Drive, the application requests OAuth 2.0 authorization for Google Drive API scopes (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#1E293B] font-mono text-xs">
                https://www.googleapis.com/auth/drive.file
              </code>{' '}
              and/or{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#1E293B] font-mono text-xs">
                https://www.googleapis.com/auth/drive
              </code>
              ). This authorization is used exclusively to perform the following user-directed actions:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Direct Document Upload:</strong> Uploading compiled shift log reports and VHF
                  roll call archives (PDF, DOCX, XLSX) directly into the specific Google Drive folder ID or
                  web link designated by the user.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Folder Verification:</strong> Verifying write permissions on the target Google
                  Drive destination folder selected by the user prior to initiating bulk cloud-to-cloud
                  transfers.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No Unauthorized File Access:</strong> The application does <strong>not</strong>{' '}
                  scan, index, modify, or delete unrelated personal or organizational files stored in your
                  Google Drive account.
                </span>
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 3 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#004AC6]" />
              3. OAuth Token Security &amp; Data Protection
            </h3>
            <p>
              OAuth 2.0 access tokens issued by Google Identity Services are handled strictly in-memory
              within your active browser session for the duration of the file transfer operation.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                We do <strong>not</strong> store your Google account password or long-lived refresh tokens
                in any public database.
              </li>
              <li>
                We do <strong>not</strong> sell, rent, or transfer Google user data to third-party data
                brokers, advertisers, or external analytics networks.
              </li>
              <li>
                You may revoke PDRRMO MLS&apos;s access to your Google Account at any time through your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#004AC6] font-semibold underline hover:opacity-80"
                >
                  Google Account Security &amp; Permissions Settings
                </a>
                .
              </li>
            </ul>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 4 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#004AC6]" />
              4. User Responsibilities &amp; Acceptable Use
            </h3>
            <p>
              Users initiating Google Drive archive transfers must ensure that they have appropriate
              organizational clearance and folder permissions for the destination Google Drive directory.
              Users agree not to misuse the integration to upload unauthorized, malicious, or non-official
              files.
            </p>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 5 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#004AC6]" />
              5. Service Availability &amp; Limitation of Liability
            </h3>
            <p>
              The Google Drive transfer feature relies on the availability of Google Cloud and Google Drive
              API services. While PDRRMO MLS validates file integrity prior to purging or archiving local
              records, the system is provided &quot;as is&quot; without warranties of uninterrupted third-party API
              uptime.
            </p>
          </section>

          <hr className="border-[#E2E8F0]" />

          {/* Section 6 */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#004AC6]" />
              6. Governing Organization &amp; Contact Information
            </h3>
            <p>
              For questions regarding these Terms and Conditions, Google Drive API usage, or operational
              data governance, please contact:
            </p>
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
              <p className="font-bold text-[#1E293B]">
                Provincial Disaster Risk Reduction and Management Office (PDRRMO)
              </p>
              <p className="text-[#505F76]">
                Monitoring &amp; Logging System (MLS) Administration
              </p>
              <p className="text-[#757680]">
                Cebu Provincial Capitol Compound, Cebu City, Philippines
              </p>
            </div>
          </section>
        </div>

        {/* Footer Caption */}
        <p className="text-center text-xs text-[#757680]">
          &copy; {new Date().getFullYear()} Provincial Disaster Risk Reduction and Management Office (PDRRMO) — Monitoring &amp; Logging System. All rights reserved.
        </p>
      </div>
    </main>
  );
}
