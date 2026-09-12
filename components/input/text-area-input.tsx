'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface TextAreaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export function TextAreaInput({
  label,
  error,
  helperText,
  id,
  className,
  containerClassName,
  disabled,
  rows = 4,
  ...props
}: TextAreaInputProps) {
  const areaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={twMerge('flex flex-col gap-1.5 w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={areaId}
          className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center gap-1.5"
        >
          {label}
        </label>
      )}

      <textarea
        id={areaId}
        rows={rows}
        disabled={disabled}
        className={twMerge(
          'w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#1E293B]',
          'placeholder:text-[#94A3B8] transition-all duration-200 outline-none resize-y',
          'focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15',
          'hover:border-[#CBD5E1]',
          'disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] disabled:cursor-not-allowed',
          error && 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15',
          className
        )}
        {...props}
      />

      {error && <p className="text-xs font-medium text-rose-600 mt-0.5">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#757680] mt-0.5">{helperText}</p>}
    </div>
  );
}

export default TextAreaInput;
