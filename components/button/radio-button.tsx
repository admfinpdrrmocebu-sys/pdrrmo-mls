'use client';

import React from 'react';
import { motion } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface RadioButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  className?: string;
}

export function RadioButton({
  label,
  description,
  checked,
  disabled,
  className,
  ...props
}: RadioButtonProps) {
  return (
    <label
      className={twMerge(
        'inline-flex items-start gap-3 select-none cursor-pointer group',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="radio"
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          className={twMerge(
            'w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center',
            checked
              ? 'border-[#004AC6] bg-[#004AC6]'
              : 'border-[#CBD5E1] bg-white group-hover:border-[#94A3B8]'
          )}
        >
          {checked && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-2 h-2 rounded-full bg-white"
            />
          )}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-[#1E293B] group-hover:text-[#004AC6] transition-colors">
              {label}
            </span>
          )}
          {description && <span className="text-xs text-[#757680]">{description}</span>}
        </div>
      )}
    </label>
  );
}

export default RadioButton;
