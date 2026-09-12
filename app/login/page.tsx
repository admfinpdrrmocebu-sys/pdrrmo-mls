'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PrimaryButton } from '@/components/button';
import { GeneralInput, CheckboxInput } from '@/components/input';
import { GeneralCard } from '@/components/card';
import { supabase } from '@/lib/supabase/client';
import logoImg from '@/app/assets/image/logo.png';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid login credentials. Please try again.');
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        const redirectedFrom = searchParams?.get('redirectedFrom');
        const destination = redirectedFrom && !redirectedFrom.startsWith('/login') ? redirectedFrom : '/dashboard';
        router.push(destination);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[480px] flex flex-col gap-4 my-auto">
        {/* Main Login Card */}
        <GeneralCard
          className="p-6 sm:p-8 shadow-xl shadow-[#004AC6]/5 border-[#E2E8F0]"
        >
          {/* Header Section */}
          <div className="text-center flex flex-col items-center mb-6">
            {/* Official Logo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2.5 flex items-center justify-center"
            >
              <Image
                src={logoImg}
                alt="PDRRMO MLS Official Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain drop-shadow-sm"
                priority
              />
            </motion.div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B]">
              Monitoring Logging System (MLS)
            </h1>
            <p className="text-xs text-[#505F76] mt-1 font-medium">
              Provincial Disaster Risk Reduction and Management Office
            </p>
          </div>

          {/* Error Message Alert */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            {/* Email Field */}
            <GeneralInput
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. clarion.ivan.dale@gmail.com"
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            {/* Password Field */}
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

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-0.5">
              <CheckboxInput
                label="Remember this terminal"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
            </div>

            {/* Submit Button */}
            <PrimaryButton
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="mt-1.5"
            >
              Sign In
            </PrimaryButton>
          </form>

          {/* Security Compliance Note */}
          <div className="mt-5 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3 text-left">
            <ShieldCheck className="w-4 h-4 text-[#004AC6] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-[#757680]">
              Access restricted to authorized disaster risk response personnel. All system interactions are cryptographically signed and logged.
            </p>
          </div>
        </GeneralCard>
      </div>
    </main>
  );
}


