'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { PrimaryButton } from '@/components/button/primary-button';
import { GeneralInput } from '@/components/input/general-input';
import { CheckboxInput } from '@/components/input/checkbox-input';
import { useAuth } from '@/lib/auth';

function resolveDestination(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const params = new URLSearchParams(window.location.search);
  const redirectedFrom = params.get('redirectedFrom');
  return redirectedFrom && !redirectedFrom.startsWith('/login')
    ? redirectedFrom
    : '/dashboard';
}

/**
 * Interactive login form wired directly to AuthContext so authenticated sessions
 * are persisted on the device and never auto-signout unless Sign Out is pressed.
 */
export function LoginForm() {
  const router = useRouter();
  const {
    signInWithPassword,
    isAuthenticated,
    isLoading: isAuthLoading,
    rememberTerminal,
    setRememberTerminal,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigateAfterAuth = useCallback(() => {
    const destination = resolveDestination();
    router.replace(destination);
    router.refresh();
  }, [router]);

  // If the device already remembers an active authenticated session, redirect immediately
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && !isSubmitting) {
      navigateAfterAuth();
    }
  }, [isAuthLoading, isAuthenticated, isSubmitting, navigateAfterAuth]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signInWithPassword(
        email.trim(),
        password,
        rememberTerminal
      );

      if (error) {
        setErrorMessage(error);
        setIsSubmitting(false);
        return;
      }

      navigateAfterAuth();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during sign in.';
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium transition-opacity duration-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        <GeneralInput
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. clarion.ivan.dale@gmail.com"
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
              Password
            </span>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[#004AC6] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <GeneralInput
            isPassword
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <CheckboxInput
            label="Remember this terminal"
            checked={rememberTerminal}
            onChange={(e) => setRememberTerminal(e.target.checked)}
          />
        </div>

        <PrimaryButton
          type="submit"
          fullWidth
          size="lg"
          isLoading={isSubmitting}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="mt-1.5"
        >
          Sign In
        </PrimaryButton>
      </form>
    </>
  );
}
