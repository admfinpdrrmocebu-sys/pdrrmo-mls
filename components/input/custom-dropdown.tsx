'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface CustomDropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  dotColor?: string;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  options: CustomDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  leftIcon?: React.ReactNode;
  pill?: boolean;
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down' | 'auto';
}

export function CustomDropdown({
  label,
  labelRight,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  leftIcon,
  pill = true,
  size = 'md',
  error,
  helperText,
  disabled = false,
  className,
  containerClassName,
  menuClassName,
  align = 'left',
  direction = 'auto',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Compute flip direction when opening
  useEffect(() => {
    if (isOpen) {
      if (direction === 'up') {
        setOpenDirection('up');
      } else if (direction === 'down') {
        setOpenDirection('down');
      } else if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 250 && spaceAbove > spaceBelow) {
          setOpenDirection('up');
        } else {
          setOpenDirection('down');
        }
      }
    }
  }, [isOpen, direction]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2.5 px-4 text-sm',
    lg: 'py-3.5 px-5 text-base',
  };

  return (
    <div ref={containerRef} className={twMerge('flex flex-col gap-1.5 relative w-full', containerClassName)}>
      {(label || labelRight) && (
        <div className="flex items-center justify-between w-full">
          {label && (
            <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wide flex items-center gap-1.5">
              {label}
            </label>
          )}
          {labelRight}
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={twMerge(
          'w-full flex items-center justify-between gap-2.5 bg-white border border-[#E2E8F0] text-left transition-all duration-200 cursor-pointer select-none',
          pill ? 'rounded-full' : 'rounded-xl',
          sizeClasses[size],
          'hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
          isOpen && 'border-[#004AC6] ring-2 ring-[#004AC6]/15 bg-white shadow-sm',
          disabled && 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60',
          error && 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15',
          className
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          {leftIcon && <span className="text-[#505F76] shrink-0">{leftIcon}</span>}
          {selectedOption?.dotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span
            className={twMerge(
              'truncate font-medium',
              selectedOption ? 'text-[#1E293B]' : 'text-[#94A3B8]'
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={twMerge(
                'ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                selectedOption.badgeColor || 'bg-[#004AC6]/10 text-[#004AC6]'
              )}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#757680] shrink-0 ml-2"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* Floating Choices Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openDirection === 'up' ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openDirection === 'up' ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={twMerge(
              'absolute z-50 w-full min-w-[220px] bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl p-1.5 space-y-1 max-h-56 overflow-y-auto overscroll-contain',
              openDirection === 'up'
                ? 'bottom-[calc(100%+6px)] top-auto'
                : 'top-[calc(100%+6px)]',
              align === 'right' ? 'right-0' : 'left-0',
              menuClassName
            )}
          >
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={twMerge(
                    'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer',
                    isSelected
                      ? 'bg-[#004AC6]/10 text-[#004AC6] font-semibold'
                      : 'text-[#1E293B] hover:bg-[#F8FAFC]',
                    option.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    {option.dotColor && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: option.dotColor }}
                      />
                    )}
                    {option.icon && (
                      <span className={twMerge('shrink-0', isSelected ? 'text-[#004AC6]' : 'text-[#505F76]')}>
                        {option.icon}
                      </span>
                    )}
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm truncate">
                          {option.label}
                        </span>
                        {option.badge && (
                          <span
                            className={twMerge(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                              option.badgeColor || 'bg-slate-100 text-[#505F76]'
                            )}
                          >
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {option.description && (
                        <span className="text-[11px] text-[#757680] font-normal leading-tight mt-0.5">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[#004AC6] shrink-0 ml-2">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-xs font-medium text-rose-600 mt-0.5">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#757680] mt-0.5">{helperText}</p>}
    </div>
  );
}

export default CustomDropdown;
