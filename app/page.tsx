'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Radio, FileText, HardDrive, Lock } from 'lucide-react';
import { PrimaryButton } from '@/components/button';
import { useAuth } from '@/lib/auth';
import logoImg from '@/app/assets/image/logo.png';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // If already authenticated, redirect straight to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <main className="min-h-screen w-full flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] text-[#1E293B]">
      {/* Top Navigation Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] p-1.5 flex items-center justify-center shadow-2xs">
            <Image
              src={logoImg}
              alt="PDRRMO MLS Official Logo"
              width={40}
              height={40}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-[#1E293B]">
              PDRRMO MLS
            </span>
            <span className="hidden sm:inline-block text-xs text-[#505F76] ml-2 font-medium">
              Monitoring &amp; Logging System
            </span>
          </div>
        </div>

        <Link href="/login">
          <PrimaryButton size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
            Sign In to Terminal
          </PrimaryButton>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl w-full mx-auto my-auto py-12 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Provincial Disaster Risk Reduction &amp; Management Office
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#1E293B] leading-tight sm:leading-tight">
          PDRRMO Monitoring &amp; Logging System
        </h1>

        <p className="text-base sm:text-lg text-[#505F76] max-w-2xl mx-auto font-medium leading-relaxed">
          The official operational platform for incident shift logging, VHF radio station roll call
          telemetry, and disaster response documentation for the Province of Cebu.
        </p>

        {/* Feature Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4 text-left">
          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004AC6] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-[#1E293B]">Shift Logging &amp; Archives</h2>
            <p className="text-xs text-[#757680] leading-relaxed">
              Standardized shift turnover logs, incident telemetry, and cryptographically verified officer records.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-[#1E293B]">VHF Roll Call Monitoring</h2>
            <p className="text-xs text-[#757680] leading-relaxed">
              Real-time radio station attendance tracking across municipal and operational disaster response areas.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-[#1E293B]">Cloud Archival Transfer</h2>
            <p className="text-xs text-[#757680] leading-relaxed">
              Secure, user-initiated cloud-to-cloud backup of compiled operational reports directly to designated Google Drive folders.
            </p>
          </div>
        </div>

        {/* Call to action */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/login" className="w-full sm:w-auto">
            <PrimaryButton size="lg" fullWidth rightIcon={<ArrowRight className="w-4 h-4" />}>
              Access Monitoring Terminal
            </PrimaryButton>
          </Link>
          <Link
            href="/terms-and-conditions"
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-sm font-semibold text-[#505F76] hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5 text-[#004AC6]" />
            Privacy Policy &amp; Terms
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-8 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#757680]">
        <p>
          &copy; {new Date().getFullYear()} Provincial Disaster Risk Reduction and Management Office (PDRRMO). All rights reserved.
        </p>

        <div className="flex items-center gap-5 font-medium">
          <Link
            href="/terms-and-conditions"
            className="text-[#004AC6] hover:underline"
          >
            Privacy Policy &amp; Terms of Service
          </Link>
          <span className="text-slate-300">•</span>
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Google API Limited Use Policy
          </a>
        </div>
      </footer>
    </main>
  );
}
