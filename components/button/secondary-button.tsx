'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface SecondaryButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'ghost' | 'soft';
  fullWidth?: boolean;
  pill?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

export function SecondaryButton({
  children,
  size = 'md',
  variant = 'outline',
  fullWidth = false,
  pill = true,
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}: SecondaryButtonProps) {
  const sizeStyles = {
    sm: 'px-3.5 py-2 text-xs font-medium gap-1.5',
    md: 'px-5 py-3 text-sm font-semibold gap-2',
    lg: 'px-6 py-3.5 text-base font-semibold gap-2.5',
  };

  const variantStyles = {
    outline: 'border border-[#E2E8F0] bg-white text-[#505F76] hover:bg-[#F8FAFC] hover:text-[#1E293B] hover:border-[#CBD5E1]',
    ghost: 'border-transparent bg-transparent text-[#505F76] hover:bg-[#F1F5F9] hover:text-[#1E293B]',
    soft: 'border-transparent bg-[#F1F5F9] text-[#505F76] hover:bg-[#E2E8F0] hover:text-[#1E293B]',
  };

  return (
    <motion.button
      whileHover={disabled || isLoading ? undefined : { scale: 1.01 }}
      whileTap={disabled || isLoading ? undefined : { scale: 0.98 }}
      disabled={disabled || isLoading}
      className={twMerge(
        'group inline-flex items-center justify-center transition-all duration-200 select-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#505F76]/30 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        pill ? 'rounded-full' : 'rounded-xl',
        fullWidth ? 'w-full' : 'w-auto',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </motion.button>
  );
}

export default SecondaryButton;
