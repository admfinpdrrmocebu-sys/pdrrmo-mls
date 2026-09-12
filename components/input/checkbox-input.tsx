'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface CheckboxInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  containerClassName?: string;
}

export function CheckboxInput({
  label,
  description,
  checked,
  disabled,
  containerClassName,
  className,
  id,
  ...props
}: CheckboxInputProps) {
  const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={checkboxId}
      className={twMerge(
        'inline-flex items-start gap-2.5 select-none cursor-pointer group',
        disabled && 'opacity-50 cursor-not-allowed',
        containerClassName
      )}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div
          className={twMerge(
            'w-4 h-4 rounded-md border transition-all duration-150 flex items-center justify-center',
            checked
              ? 'bg-[#004AC6] border-[#004AC6] text-white shadow-sm'
              : 'bg-white border-[#CBD5E1] group-hover:border-[#94A3B8]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[#004AC6]/30',
            className
          )}
        >
          {checked && <Check className="w-3 h-3 stroke-[3]" />}
        </div>
      </div>

      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-[#1E293B] leading-tight">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[#757680] mt-0.5 leading-normal">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}

export default CheckboxInput;
