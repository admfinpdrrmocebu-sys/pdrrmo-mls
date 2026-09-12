'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PrimaryButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  pill?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

export function PrimaryButton({
  children,
  size = 'md',
  fullWidth = false,
  pill = true,
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}: PrimaryButtonProps) {
  const sizeStyles = {
    sm: 'px-3.5 py-2 text-xs font-medium gap-1.5',
    md: 'px-5 py-3 text-sm font-semibold gap-2',
    lg: 'px-6 py-3.5 text-base font-semibold gap-2.5',
  };

  return (
    <motion.button
      whileHover={disabled || isLoading ? undefined : { scale: 1.01, filter: 'brightness(1.05)' }}
      whileTap={disabled || isLoading ? undefined : { scale: 0.98 }}
      disabled={disabled || isLoading}
      className={twMerge(
        'group inline-flex items-center justify-center transition-all duration-200 select-none cursor-pointer',
        'bg-[#004AC6] hover:bg-[#003EA8] active:bg-[#002F82] text-white',
        'shadow-sm shadow-[#004AC6]/25 hover:shadow-md hover:shadow-[#004AC6]/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004AC6] focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        pill ? 'rounded-full' : 'rounded-xl',
        fullWidth ? 'w-full' : 'w-auto',
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
          {rightIcon}
        </span>
      )}
    </motion.button>
  );
}

export default PrimaryButton;
