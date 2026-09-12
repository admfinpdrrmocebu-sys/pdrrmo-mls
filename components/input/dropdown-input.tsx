'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownInputProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: DropdownOption[];
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  containerClassName?: string;
}

export function DropdownInput({
  label,
  options,
  error,
  helperText,
  leftIcon,
  id,
  className,
  containerClassName,
  disabled,
  ...props
}: DropdownInputProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={twMerge('flex flex-col gap-1.5 w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={selectId}
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

        <select
          id={selectId}
          disabled={disabled}
          className={twMerge(
            'w-full appearance-none bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#1E293B]',
            'transition-all duration-200 outline-none cursor-pointer',
            'focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15',
            'hover:border-[#CBD5E1]',
            'disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] disabled:cursor-not-allowed',
            error && 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15',
            leftIcon ? 'pl-11' : 'pl-4',
            'pr-10',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="absolute right-3.5 flex items-center justify-center text-[#757680] pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error && <p className="text-xs font-medium text-rose-600 mt-0.5">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#757680] mt-0.5">{helperText}</p>}
    </div>
  );
}

export default DropdownInput;
