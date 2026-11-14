'use client';

import React, { useMemo } from 'react';
import { Mail, Monitor, Smartphone, X, ShieldCheck, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton } from '@/components/button';
import { generateInvitationEmailHtml } from '@/lib/email/invitation-email';
import { normalizeEnumRole } from './types';

export interface EmailPreviewModalProps {
  isOpen: boolean;
  emailPreviewMode: 'desktop' | 'mobile';
  sampleEmail: string;
  invitePosition: string;
  invitePositionTitle: string;
  inviteShift: string;
  inviterName: string;
  onChangeMode: (mode: 'desktop' | 'mobile') => void;
  onClose: () => void;
  onUseTemplate: () => void;
}

export default function EmailPreviewModal({
  isOpen,
  emailPreviewMode,
  sampleEmail,
  invitePosition,
  invitePositionTitle,
  inviteShift,
  inviterName,
  onChangeMode,
  onClose,
  onUseTemplate,
}: EmailPreviewModalProps) {
  const previewEmailHtml = useMemo(() => {
    if (!isOpen) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://mls.pdrrmo.gov.ph';

    return generateInvitationEmailHtml({
      email: sampleEmail,
      role: normalizeEnumRole(invitePosition),
      positionTitle:
        invitePositionTitle ||
        (invitePosition.toLowerCase().includes('admin')
          ? 'Administrator'
          : 'Monitoring Officer'),
      shift: inviteShift,
      inviteUrl: `${origin}/register?token=sec-token-preview-8f92a1&email=${encodeURIComponent(
        sampleEmail
      )}`,
      invitedBy: inviterName,
      expiresAt: 'Valid until registered',
      logoSrc: `${origin}/assets/logo.png`,
    });
  }, [isOpen, sampleEmail, invitePosition, invitePositionTitle, inviteShift, inviterName]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden z-10"
          >
            <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/15">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                    Invitation Email UI/UX Preview
                  </h2>
                  <p className="text-xs text-[#757680]">
                    Responsive HTML template delivered to invited personnel via SMTP
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="flex bg-[#E2E8F0]/70 p-1 rounded-full text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => onChangeMode('desktop')}
                    className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                      emailPreviewMode === 'desktop'
                        ? 'bg-white text-[#004AC6] shadow-2xs font-bold'
                        : 'text-[#505F76] hover:text-[#1E293B]'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMode('mobile')}
                    className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                      emailPreviewMode === 'mobile'
                        ? 'bg-white text-[#004AC6] shadow-2xs font-bold'
                        : 'text-[#505F76] hover:text-[#1E293B]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#EAEEF4] p-4 sm:p-8 overflow-y-auto custom-scrollbar flex items-start justify-center">
              <div
                className={`bg-white shadow-xl transition-all duration-300 overflow-hidden ${
                  emailPreviewMode === 'mobile'
                    ? 'w-[390px] rounded-[32px] border-[6px] border-slate-800'
                    : 'w-full max-w-[640px] rounded-2xl border border-slate-300'
                }`}
              >
                <iframe
                  title="Email Template Live Preview"
                  srcDoc={previewEmailHtml}
                  className={`w-full border-none ${
                    emailPreviewMode === 'mobile' ? 'h-[620px]' : 'h-[680px]'
                  }`}
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#505F76]">
                <ShieldCheck className="w-4 h-4 text-[#004AC6]" />
                <span>Cross-client compatible (Gmail, Apple Mail, Outlook, Android)</span>
              </div>

              <PrimaryButton
                size="sm"
                pill
                onClick={onUseTemplate}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Use This Template
              </PrimaryButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
