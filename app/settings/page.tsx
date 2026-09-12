'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, MapPin, Terminal, ArrowRight, CalendarDays } from 'lucide-react';
import { motion } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { SecondaryButton } from '@/components/button';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';

export default function SettingsPage() {
  const { isViewOnly } = useAuth();
  const settingsModules = [
    {
      id: 'access-control',
      title: 'User Role Based Access Control',
      description: 'Manage permissions, user groups, and security policies.',
      icon: ShieldCheck,
      iconBg: 'bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15',
      ambientBg: 'bg-[#004AC6]/5',
      actionLabel: 'Manage Access',
      href: '/settings/access',
    },
    {
      id: 'area-seeding',
      title: 'Area Seeding and Roll Call',
      description: 'Configure regional data seeding and roll call monitoring statuses.',
      icon: MapPin,
      iconBg: 'bg-slate-100 text-[#505F76] border border-slate-200',
      ambientBg: 'bg-[#505F76]/5',
      actionLabel: 'Configure Areas',
      href: '/settings/areas',
    },
    {
      id: 'report-types',
      title: 'Report Types',
      description: 'Define system log report classifications and advisory categories.',
      icon: Terminal,
      iconBg: 'bg-[#004AC6] text-white shadow-sm',
      ambientBg: 'bg-[#004AC6]/5',
      actionLabel: 'Manage Types',
      href: '/settings/logs',
    },
    {
      id: 'shift-schedules',
      title: 'Shift Schedule Calendar',
      description: 'View operational shift rotations, officer duty rosters, and station staffing schedules.',
      icon: CalendarDays,
      iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      ambientBg: 'bg-emerald-500/5',
      actionLabel: 'View Calendar',
      href: '/settings/shifts',
    },
  ];

  return (
    <AppLayoutShell
      title="Settings"
      subtitle="System Configuration & Administrative Controls"
    >
      <div className="space-y-8">
        {/* ========================================================================= */}
        {/* 1. HEADER SECTION */}
        {/* ========================================================================= */}
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
            Settings
          </h2>
          <p className="text-sm sm:text-base text-[#505F76] mt-1 font-medium">
            Configure system-wide parameters, user roles, telemetry areas, and administrative controls.
          </p>
        </div>

        {/* View-Only Banner */}
        <ViewOnlyNotice
          screen="Settings"
          message="Administrative system configurations and permission controls are presented in read-only audit mode."
        />

        {/* ========================================================================= */}
        {/* 2. BENTO SETTINGS MODULES GRID */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settingsModules.map((item, idx) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
                whileHover={{ y: -4 }}
                className="relative bg-white rounded-[1.75rem] p-7 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all duration-200 flex flex-col justify-between h-full overflow-hidden group"
              >
                {/* Ambient Corner Shape */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-8 -mt-8 transition-transform duration-300 group-hover:scale-110 pointer-events-none ${item.ambientBg}`}
                />

                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon Badge */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mb-6 transition-transform duration-200 group-hover:scale-105 ${item.iconBg}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-[#1E293B] mb-2 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#505F76] leading-relaxed mb-8 flex-1">
                    {item.description}
                  </p>

                  {/* Action Button */}
                  <div className="mt-auto pt-2">
                    <Link href={item.href}>
                      <SecondaryButton
                        size="md"
                        variant="soft"
                        pill
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        className="bg-slate-100 hover:bg-[#004AC6] hover:text-white text-[#1E293B] border border-transparent font-medium"
                      >
                        {item.actionLabel}
                      </SecondaryButton>
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayoutShell>
  );
}
