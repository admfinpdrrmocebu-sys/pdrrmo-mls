'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface GeneralInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  containerClassName?: string;
}

/**
 * GeneralInput Component
 * ======================
 * Modern Fintech input with rounded corners, subtle border (#E2E8F0),
 * focused primary ring, and optional password visibility toggling.
 */
export function GeneralInput({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  isPassword = false,
  type = 'text',
  id,
  className,
  containerClassName,
  disabled,
  ...props
}: GeneralInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={twMerge('flex flex-col gap-1.5 w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center gap-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3.5 flex items-center justify-center text-[#757680] pointer-events-none">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          type={inputType}
          disabled={disabled}
          className={twMerge(
            'w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#1E293B]',
            'placeholder:text-[#94A3B8] transition-all duration-200 outline-none',
            'focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15 focus:bg-white',
            'hover:border-[#CBD5E1]',
            'disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] disabled:cursor-not-allowed',
            error && 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15',
            leftIcon ? 'pl-11' : 'pl-4',
            (isPassword || rightIcon) ? 'pr-11' : 'pr-4',
            className
          )}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPassword(!showPassword);
            }}
            tabIndex={0}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3.5 z-10 p-1 rounded-lg text-[#757680] hover:text-[#1E293B] hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : (
          rightIcon && (
            <div className="absolute right-3.5 flex items-center justify-center text-[#757680]">
              {rightIcon}
            </div>
          )
        )}
      </div>

      {error && (
        <p className="text-xs font-medium text-rose-600 mt-0.5">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-xs text-[#757680] mt-0.5">{helperText}</p>
      )}
    </div>
  );
}

export default GeneralInput;
