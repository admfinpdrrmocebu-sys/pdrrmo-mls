'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface RoundedIconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  className?: string;
}

export function RoundedIconButton({
  icon,
  'aria-label': ariaLabel,
  size = 'md',
  variant = 'secondary',
  className,
  disabled,
  ...props
}: RoundedIconButtonProps) {
  const sizeStyles = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  const variantStyles = {
    primary: 'bg-[#004AC6] text-white hover:bg-[#003EA8] shadow-sm',
    secondary: 'bg-white border border-[#E2E8F0] text-[#505F76] hover:bg-[#F8FAFC] hover:text-[#1E293B] shadow-sm',
    ghost: 'bg-transparent text-[#505F76] hover:bg-[#F1F5F9] hover:text-[#1E293B]',
    outline: 'border border-[#E2E8F0] bg-transparent text-[#505F76] hover:bg-[#F8FAFC] hover:text-[#1E293B]',
  };

  return (
    <motion.button
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      disabled={disabled}
      className={twMerge(
        'inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004AC6] focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

export default RoundedIconButton;
