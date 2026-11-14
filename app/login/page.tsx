import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { GeneralCard } from '@/components/card/general-card';
import logoAuthImg from '@/app/assets/image/logo-auth.png';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[480px] flex flex-col gap-4 my-auto">
        {/* Main Login Card */}
        <GeneralCard className="p-6 sm:p-8 shadow-xl shadow-[#004AC6]/5 border-[#E2E8F0]">
          {/* Header Section */}
          <div className="text-center flex flex-col items-center mb-6">
            {/* Official Logo (rendered immediately in SSR HTML for instant LCP) */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2.5 flex items-center justify-center">
              <Image
                src={logoAuthImg}
                alt="PDRRMO MLS Official Logo"
                width={80}
                height={80}
                sizes="(max-width: 640px) 64px, 80px"
                quality={80}
                className="w-full h-full object-contain drop-shadow-sm"
                priority
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B]">
              Monitoring Logging System (MLS)
            </h1>
            <p className="text-xs text-[#505F76] mt-1 font-medium">
              Provincial Disaster Risk Reduction and Management Office
            </p>
          </div>

          <LoginForm />

          {/* Security Compliance Note */}
          <div className="mt-5 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3 text-left">
            <ShieldCheck className="w-4 h-4 text-[#004AC6] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-[#757680]">
              Access restricted to authorized disaster risk response personnel. All system interactions are cryptographically signed and logged.
            </p>
          </div>
        </GeneralCard>

        {/* Public Compliance Links */}
        <div className="text-center text-xs text-[#757680] pt-1">
          <Link
            href="/terms-and-conditions"
            className="text-[#505F76] hover:text-[#004AC6] hover:underline font-medium transition-colors"
          >
            Privacy Policy &amp; Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
