'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  User,
  Briefcase,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  LogIn,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { SignaturePad } from '@/components/input';
import { supabase } from '@/lib/supabase/client';
import logoImg from '@/app/assets/image/logo.png';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');
  const emailParam = searchParams.get('email');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('Monitoring Officer');
  const [shift, setShift] = useState('Day Shift (Alpha)');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Invitation Token Verification State
  const [invitationStatus, setInvitationStatus] = useState<{
    isValid: boolean;
    checked: boolean;
    role?: string;
    positionTitle?: string;
    shift?: string;
    errorReason?: 'no_token' | 'not_found' | 'already_used' | 'expired' | 'revoked' | 'general';
  }>({ isValid: false, checked: false });

  // Auto redirect to dashboard once registration is successful
  useEffect(() => {
    if (registeredSuccess) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [registeredSuccess, router]);

  // Check and validate invitation token on mount
  useEffect(() => {
    async function checkToken() {
      if (!tokenParam) {
        setInvitationStatus({ isValid: false, checked: true, errorReason: 'no_token' });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', tokenParam)
          .maybeSingle();

        if (error || !data) {
          setInvitationStatus({ isValid: false, checked: true, errorReason: 'not_found' });
          return;
        }

        if (data.status === 'accepted') {
          setInvitationStatus({ isValid: false, checked: true, errorReason: 'already_used' });
          return;
        }

        if (data.status === 'revoked') {
          setInvitationStatus({ isValid: false, checked: true, errorReason: 'revoked' });
          return;
        }

        if (data.status === 'expired') {
          setInvitationStatus({ isValid: false, checked: true, errorReason: 'expired' });
          return;
        }

        if (data.status === 'pending') {
          setEmail(data.email || emailParam || '');
          if (data.position_title) setPosition(data.position_title);
          if (data.default_shift) setShift(data.default_shift);

          setInvitationStatus({
            isValid: true,
            checked: true,
            role: data.role,
            positionTitle: data.position_title,
            shift: data.default_shift,
          });
        } else {
          setInvitationStatus({ isValid: false, checked: true, errorReason: 'general' });
        }
      } catch (err) {
        console.error('Error validating invitation token:', err);
        setInvitationStatus({ isValid: false, checked: true, errorReason: 'general' });
      }
    }

    checkToken();
  }, [tokenParam, emailParam]);

  // Helper to upload signature data URL to Supabase Storage
  const uploadSignatureIfPresent = async (userId: string, dataUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `${userId}/signature_${Date.now()}.png`;

      const { error } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (error) {
        console.warn('Signature upload warning:', error.message);
        return null;
      }

      const { data: publicData } = supabase.storage
        .from('signatures')
        .getPublicUrl(fileName);

      return publicData?.publicUrl || fileName;
    } catch (e) {
      console.warn('Failed to upload signature:', e);
      return null;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!invitationStatus.isValid || !tokenParam) {
      setErrorMessage('Registration is restricted. A valid invitation token is required.');
      return;
    }

    setIsLoading(true);

    try {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        setIsLoading(false);
        return;
      }

      // Step 1: Sign up user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            position: position || 'Monitoring Officer',
            role: invitationStatus.role || 'monitoring',
            default_shift: shift || 'Day Shift (Alpha)',
          },
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('confirmation email') ||
          error.message.toLowerCase().includes('sending confirmation')
        ) {
          setErrorMessage(
            'Supabase Email Confirmation is currently enabled in project settings. Please disable "Confirm email" in Supabase Authentication settings for instant onboarding.'
          );
        } else {
          setErrorMessage(error.message || 'Registration failed. Please verify your details.');
        }
        setIsLoading(false);
        return;
      }

      // Step 2: Auto sign-in to establish immediate session
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      const userId = data?.user?.id;

      // Step 3: Upload signature if captured
      if (userId && signature) {
        const sigPath = await uploadSignatureIfPresent(userId, signature);
        if (sigPath) {
          await supabase
            .from('profiles')
            .update({ signature_url: sigPath })
            .eq('id', userId);
        }
      }

      // Step 4: Mark the invitation as accepted
      await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', tokenParam);

      setRegisteredSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during registration.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[460px] flex flex-col gap-3 my-auto">
        {/* Main Registration Card */}
        <GeneralCard className="p-6 sm:p-7 shadow-xl shadow-[#004AC6]/5 border-[#E2E8F0] flex flex-col items-center w-full">
          {/* Logo Header */}
          <div className="text-center flex flex-col items-center mb-4 w-full">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative w-14 h-14 sm:w-16 sm:h-16 mb-2 flex items-center justify-center"
            >
              <Image
                src={logoImg}
                alt="PDRRMO MLS Official Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain drop-shadow-sm"
                priority
              />
            </motion.div>

            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1E293B]">
              Monitoring Logging System
            </h1>
            <p className="text-xs text-[#505F76] font-medium mt-0.5">
              Provincial Disaster Risk Reduction and Management Office
            </p>
          </div>

          {/* 1. Loading State while checking token */}
          {!invitationStatus.checked ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <Loader2 className="w-8 h-8 text-[#004AC6] animate-spin" />
              <p className="text-xs font-semibold text-[#505F76]">
                Verifying official invitation token...
              </p>
            </div>
          ) : !invitationStatus.isValid ? (
            /* 2. Invitation Guard: Access Denied / Invalid Token */
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center flex flex-col items-center py-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-200">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <h2 className="text-base font-bold text-[#1E293B]">
                {invitationStatus.errorReason === 'already_used'
                  ? 'Invitation Already Used'
                  : invitationStatus.errorReason === 'expired'
                  ? 'Invitation Expired'
                  : invitationStatus.errorReason === 'revoked'
                  ? 'Invitation Revoked'
                  : invitationStatus.errorReason === 'not_found'
                  ? 'Invalid Invitation Link'
                  : 'Invitation Required'}
              </h2>

              <p className="text-xs text-[#505F76] mt-2 leading-relaxed max-w-sm">
                {invitationStatus.errorReason === 'already_used'
                  ? 'This invitation link has already been accepted and completed. Please sign in to your operational terminal.'
                  : invitationStatus.errorReason === 'expired' || invitationStatus.errorReason === 'revoked'
                  ? 'This invitation is no longer active. Please request a new invitation from your system administrator.'
                  : invitationStatus.errorReason === 'not_found'
                  ? 'The provided invitation token is not recognized. Please check the link in your invitation email.'
                  : 'Terminal registration is strictly by invitation only. You must follow the unique link sent to your official email by a System Administrator.'}
              </p>

              <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-left text-xs text-[#64748B] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#757680] shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  If you need an operational account, please contact the PDRRMO Operations Center Administrator to issue an official invitation.
                </p>
              </div>

              <div className="w-full mt-6 flex flex-col gap-2">
                <Link href="/login" className="w-full">
                  <PrimaryButton fullWidth size="lg" leftIcon={<LogIn className="w-4 h-4" />}>
                    Return to Sign In
                  </PrimaryButton>
                </Link>
              </div>
            </motion.div>
          ) : registeredSuccess ? (
            /* 3. Onboarding Success State */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center flex flex-col items-center py-3"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <h2 className="text-base font-bold text-[#1E293B]">Onboarding Complete!</h2>
              <p className="text-xs text-[#505F76] mt-1.5 leading-relaxed">
                Welcome, <strong className="text-[#1E293B] font-semibold">{fullName || email}</strong>. Your operational account has been activated with immediate access.
              </p>

              <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl w-full flex flex-col gap-1.5 text-left text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Terminal Email:</span>
                  <span className="font-semibold text-[#1E293B]">{email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Designation:</span>
                  <span className="font-semibold text-[#1E293B]">{position}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Assigned Shift:</span>
                  <span className="font-semibold text-[#1E293B]">{shift}</span>
                </div>
              </div>

              <div className="w-full mt-5 flex flex-col gap-2">
                <Link href="/dashboard" className="w-full">
                  <PrimaryButton fullWidth size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Enter Operations Dashboard
                  </PrimaryButton>
                </Link>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Redirecting automatically to dashboard...
                </p>
              </div>
            </motion.div>
          ) : (
            /* 4. Valid Invitation Registration Form */
            <div className="w-full">
              {/* Invitation Verified Badge */}
              <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#004AC6]">
                    Official Invitation Verified
                  </span>
                  <span className="text-[11px] text-[#505F76]">
                    Assigned: {invitationStatus.positionTitle || position} · {invitationStatus.shift || shift}
                  </span>
                </div>
              </div>

              {/* Error Alert */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleRegister} className="w-full flex flex-col gap-3">
                {/* Email Field (Locked to Invitation) */}
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    disabled
                    value={email}
                    placeholder="Email Address"
                    className="w-full bg-slate-100/90 border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-4 text-sm text-[#505F76] font-medium cursor-not-allowed select-none"
                  />
                </div>

                {/* Full Name Field */}
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="fullName"
                    type="text"
                    required
                    disabled={isLoading}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name (e.g. Officer Juan Dela Cruz)"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all disabled:opacity-60"
                  />
                </div>

                {/* Position / Role Field (Assigned by Admin) */}
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#94A3B8] pointer-events-none">
                    <Briefcase className="w-4 h-4" />
                  </span>
                  <input
                    id="position"
                    type="text"
                    disabled
                    value={position}
                    className="w-full bg-slate-100/90 border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-4 text-sm text-[#505F76] font-medium cursor-not-allowed select-none"
                  />
                </div>

                {/* Shift Field (Assigned by Admin) */}
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#94A3B8] pointer-events-none">
                    <Clock className="w-4 h-4" />
                  </span>
                  <input
                    id="shift"
                    type="text"
                    disabled
                    value={shift}
                    className="w-full bg-slate-100/90 border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-4 text-sm text-[#505F76] font-medium cursor-not-allowed select-none"
                  />
                </div>

                {/* Password Field */}
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min. 6 characters)"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-11 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 flex items-center justify-center text-[#757680] hover:text-[#1E293B] transition-colors focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Digital Signature Pad */}
                <div>
                  <SignaturePad
                    label="Digital Sign-off Signature (Optional)"
                    onSignatureChange={(data) => setSignature(data)}
                  />
                </div>

                {/* Submit Button */}
                <PrimaryButton
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="mt-1"
                >
                  Complete Onboarding
                </PrimaryButton>
              </form>

              {/* Footer Back Link */}
              <div className="mt-4 text-center w-full pt-3.5 border-t border-[#E2E8F0]">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-[#004AC6] hover:text-[#003594] transition-colors"
                >
                  Already have an account? Sign In
                </Link>
              </div>
            </div>
          )}
        </GeneralCard>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="w-8 h-8 rounded-full border-2 border-[#004AC6] border-t-transparent animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
