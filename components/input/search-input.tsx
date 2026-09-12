'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  containerClassName?: string;
}

export function SearchInput({
  value,
  onClear,
  placeholder = 'Search records, logs, areas...',
  className,
  containerClassName,
  disabled,
  ...props
}: SearchInputProps) {
  return (
    <div className={twMerge('relative flex items-center w-full', containerClassName)}>
      <div className="absolute left-3.5 flex items-center justify-center text-[#757680] pointer-events-none">
        <Search className="w-4 h-4" />
      </div>

      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={twMerge(
          'w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-9 py-2.5 text-sm text-[#1E293B]',
          'placeholder:text-[#94A3B8] transition-all duration-200 outline-none',
          'focus:border-[#004AC6] focus:ring-2 focus:ring-[#004AC6]/15',
          'hover:border-[#CBD5E1]',
          'disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]',
          className
        )}
        {...props}
      />

      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-3 flex items-center justify-center text-[#757680] hover:text-[#1E293B] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
