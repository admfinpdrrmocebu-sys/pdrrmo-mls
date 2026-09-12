'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { supabase } from '@/lib/supabase/client';
import logoImg from '@/app/assets/image/logo.png';

type Step = 'email' | 'code' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Current Step Flow: email -> code -> password -> success
  const [step, setStep] = useState<Step>('email');

  // Step 1: Email Form State
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2: 6-Digit OTP Code State (Standard Supabase Recovery Token)
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  // Step 3: New Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // STEP 1 HANDLER: Send Password Recovery Email via Supabase Auth
  // ---------------------------------------------------------------------------
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailError(null);
    setIsSendingEmail(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        setEmailError(error.message || 'Failed to dispatch password recovery email.');
        setIsSendingEmail(false);
        return;
      }

      setStep('code');
      setCode(['', '', '', '', '', '']);
      setResendCountdown(60);
      const timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error sending reset code.';
      setEmailError(message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ---------------------------------------------------------------------------
  // STEP 2 HANDLERS: 6-Digit OTP Code Inputs
  // ---------------------------------------------------------------------------
  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCodeError(null);

    const updated = [...code];
    if (sanitized.length <= 1) {
      updated[index] = sanitized;
      setCode(updated);
      if (sanitized && index < 5) {
        inputRefs[index + 1].current?.focus();
      }
    } else {
      // Handle paste of full 6-digit code
      const digits = sanitized.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setCode(updated);
      const nextFocus = Math.min(digits.length, 5);
      inputRefs[nextFocus].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('').trim();
    if (fullCode.length < 6) {
      setCodeError('Please enter all 6 digits of the verification code.');
      return;
    }

    setCodeError(null);
    setIsVerifyingCode(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: fullCode,
        type: 'recovery',
      });

      if (error) {
        setCodeError(error.message || 'Invalid or expired verification code.');
        setIsVerifyingCode(false);
        return;
      }

      if (data?.session || data?.user) {
        setStep('password');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error verifying OTP code.';
      setCodeError(message);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    setCodeError(null);
    setCode(['', '', '', '', '', '']);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setCodeError(error.message);
        return;
      }

      setResendCountdown(60);
      const timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      inputRefs[0].current?.focus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend code.';
      setCodeError(message);
    }
  };

  // ---------------------------------------------------------------------------
  // STEP 3 HANDLER: Update New Password
  // ---------------------------------------------------------------------------
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message || 'Failed to update password.');
        setIsUpdatingPassword(false);
        return;
      }

      setStep('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating password.';
      setPasswordError(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[460px] flex flex-col gap-3 my-auto">
        {/* Main Card */}
        <GeneralCard className="p-6 sm:p-7 shadow-xl shadow-[#004AC6]/5 border-[#E2E8F0] flex flex-col items-center w-full">
          {/* Official Emblem & Header */}
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
              Account Password Recovery
            </p>
          </div>

          {/* ================================================================= */}
          {/* STEP 1: EMAIL CONFIRMATION */}
          {/* ================================================================= */}
          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.div
                key="step-email"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <div className="mb-4 text-center">
                  <h2 className="text-sm font-bold text-[#1E293B]">Confirm Account Email</h2>
                  <p className="text-xs text-[#505F76] mt-0.5">
                    Enter your registered email address to receive a 6-digit recovery code.
                  </p>
                </div>

                {emailError && (
                  <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{emailError}</span>
                  </div>
                )}

                <form onSubmit={handleSendEmail} className="w-full flex flex-col gap-3">
                  {/* Email Field */}
                  <div className="relative flex items-center w-full">
                    <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. clarion.ivan.dale@gmail.com"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                    />
                  </div>

                  {/* Submit Button */}
                  <PrimaryButton
                    type="submit"
                    fullWidth
                    size="lg"
                    isLoading={isSendingEmail}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    className="mt-1"
                  >
                    Send Verification Code
                  </PrimaryButton>
                </form>
              </motion.div>
            )}

            {/* ================================================================= */}
            {/* STEP 2: 6-DIGIT VERIFICATION CODE */}
            {/* ================================================================= */}
            {step === 'code' && (
              <motion.div
                key="step-code"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <div className="mb-4 text-center">
                  <h2 className="text-sm font-bold text-[#1E293B]">Enter 6-Digit Code</h2>
                  <p className="text-xs text-[#505F76] mt-0.5">
                    Security recovery code dispatched to{' '}
                    <span className="font-semibold text-[#1E293B]">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyCode} className="w-full flex flex-col gap-4">
                  {/* 6 Digit Boxes */}
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-1">
                    {code.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={inputRefs[idx]}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className={`w-10 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-[#F8FAFC] border rounded-xl focus:outline-none focus:bg-white transition-all font-mono ${
                          codeError
                            ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                            : 'border-[#E2E8F0] focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15'
                        }`}
                      />
                    ))}
                  </div>

                  {codeError && (
                    <p className="text-xs text-rose-500 text-center font-medium">
                      {codeError}
                    </p>
                  )}

                  {/* Resend Action */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCountdown > 0}
                      className="text-xs font-semibold text-[#004AC6] hover:text-[#003594] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {resendCountdown > 0
                        ? `Resend code in ${resendCountdown}s`
                        : 'Resend 6-digit code'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-1">
                    <SecondaryButton
                      type="button"
                      size="lg"
                      pill
                      leftIcon={<ArrowLeft className="w-4 h-4" />}
                      onClick={() => setStep('email')}
                    >
                      Back
                    </SecondaryButton>

                    <PrimaryButton
                      type="submit"
                      fullWidth
                      size="lg"
                      isLoading={isVerifyingCode}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Verify Code
                    </PrimaryButton>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ================================================================= */}
            {/* STEP 3: CREATE NEW PASSWORD */}
            {/* ================================================================= */}
            {step === 'password' && (
              <motion.div
                key="step-password"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <div className="mb-4 text-center">
                  <h2 className="text-sm font-bold text-[#1E293B]">Set New Password</h2>
                  <p className="text-xs text-[#505F76] mt-0.5">
                    Enter your new password to regain terminal access.
                  </p>
                </div>

                <form onSubmit={handleUpdatePassword} className="w-full flex flex-col gap-3">
                  {/* New Password */}
                  <div className="relative flex items-center w-full">
                    <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New Password (min. 6 chars)"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-11 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 flex items-center justify-center text-[#757680] hover:text-[#1E293B] transition-colors focus:outline-none cursor-pointer"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Confirm New Password */}
                  <div className="relative flex items-center w-full">
                    <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm New Password"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-2.5 sm:py-3 pl-11 pr-11 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 flex items-center justify-center text-[#757680] hover:text-[#1E293B] transition-colors focus:outline-none cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {passwordError && (
                    <p className="text-xs text-rose-500 text-center font-medium">
                      {passwordError}
                    </p>
                  )}

                  {/* Submit Button */}
                  <PrimaryButton
                    type="submit"
                    fullWidth
                    size="lg"
                    isLoading={isUpdatingPassword}
                    rightIcon={<CheckCircle2 className="w-4 h-4" />}
                    className="mt-1"
                  >
                    Update Password
                  </PrimaryButton>
                </form>
              </motion.div>
            )}

            {/* ================================================================= */}
            {/* STEP 4: SUCCESS CONFIRMATION */}
            {/* ================================================================= */}
            {step === 'success' && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="w-full text-center flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-200">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <h2 className="text-base font-bold text-[#1E293B]">Password Updated</h2>
                <p className="text-xs text-[#505F76] mt-1 max-w-xs leading-relaxed">
                  Your credentials have been successfully updated. You can now sign in with your new password.
                </p>

                <PrimaryButton
                  fullWidth
                  size="lg"
                  onClick={() => router.push('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="mt-5"
                >
                  Return to Sign In
                </PrimaryButton>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Link to Sign In */}
          {step !== 'success' && (
            <div className="mt-4 text-center w-full pt-3.5 border-t border-[#E2E8F0]">
              <Link
                href="/login"
                className="text-xs font-semibold text-[#004AC6] hover:text-[#003594] transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          )}
        </GeneralCard>
      </div>
    </main>
  );
}

