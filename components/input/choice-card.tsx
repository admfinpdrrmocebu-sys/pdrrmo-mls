'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  dotColor?: string;
  disabled?: boolean;
}

export interface ChoiceCardGroupProps {
  label?: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: 1 | 2 | 3 | 4;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
}

export function ChoiceCardGroup({
  label,
  options,
  value,
  onChange,
  columns = 2,
  disabled = false,
  className,
  containerClassName,
}: ChoiceCardGroupProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={twMerge('flex flex-col gap-2 w-full', containerClassName)}>
      {label && (
        <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
          {label}
        </label>
      )}

      <div className={twMerge('grid gap-3', gridCols[columns], className)}>
        {options.map((option) => {
          const isSelected = option.value === value;
          const isDisabled = disabled || option.disabled;

          return (
            <motion.button
              key={option.value}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(option.value)}
              whileHover={!isDisabled ? { y: -1 } : {}}
              whileTap={!isDisabled ? { scale: 0.99 } : {}}
              className={twMerge(
                'relative flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer select-none',
                isSelected
                  ? 'bg-[#004AC6]/5 border-[#004AC6] shadow-sm ring-1 ring-[#004AC6]/20'
                  : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
                isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-slate-50'
              )}
            >
              {/* Left Indicator or Icon */}
              {option.icon ? (
                <div
                  className={twMerge(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-[#004AC6] text-white shadow-2xs'
                      : 'bg-slate-100 text-[#505F76] group-hover:bg-slate-200'
                  )}
                >
                  {option.icon}
                </div>
              ) : option.dotColor ? (
                <span
                  className="w-3 h-3 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: option.dotColor }}
                />
              ) : null}

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={twMerge(
                      'text-sm font-bold leading-tight',
                      isSelected ? 'text-[#004AC6]' : 'text-[#1E293B]'
                    )}
                  >
                    {option.label}
                  </span>
                  {option.badge && (
                    <span
                      className={twMerge(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        option.badgeColor || 'bg-[#004AC6]/10 text-[#004AC6]'
                      )}
                    >
                      {option.badge}
                    </span>
                  )}
                </div>

                {option.description && (
                  <p className="text-xs text-[#757680] mt-1 font-normal leading-relaxed">
                    {option.description}
                  </p>
                )}
              </div>

              {/* Selection Radio / Check Indicator */}
              <div
                className={twMerge(
                  'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors mt-0.5',
                  isSelected
                    ? 'bg-[#004AC6] border-[#004AC6] text-white shadow-xs'
                    : 'border-[#CBD5E1] bg-white'
                )}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default ChoiceCardGroup;
