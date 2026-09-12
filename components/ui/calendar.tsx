'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4 relative',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center h-8',
        caption_label: 'text-sm font-bold text-[#1E293B]',
        nav: 'flex items-center gap-1 absolute top-1 inset-x-0 justify-between px-1 pointer-events-none z-10',
        button_previous: cn(
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-lg border border-[#E2E8F0] hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer pointer-events-auto text-[#505F76]'
        ),
        button_next: cn(
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-lg border border-[#E2E8F0] hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer pointer-events-auto text-[#505F76]'
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-[#94A3B8] rounded-md w-9 font-semibold text-[0.8rem] text-center uppercase tracking-wider',
        week: 'flex w-full mt-2',
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[#004AC6]/10 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl'
        ),
        day_button: cn(
          'h-9 w-9 p-0 font-medium rounded-xl aria-selected:opacity-100 hover:bg-slate-100 hover:text-[#1E293B] focus:bg-[#004AC6] focus:text-white transition-all flex items-center justify-center cursor-pointer text-[#1E293B]'
        ),
        selected:
          'bg-[#004AC6] text-white hover:bg-[#004AC6] hover:text-white focus:bg-[#004AC6] focus:text-white font-bold shadow-sm rounded-xl',
        today: 'bg-slate-100 text-[#004AC6] font-bold border border-[#004AC6]/30',
        outside:
          'day-outside text-[#CBD5E1] aria-selected:bg-[#004AC6]/5 aria-selected:text-[#94A3B8]',
        disabled: 'text-[#CBD5E1] opacity-50 cursor-not-allowed hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...iconProps }) => {
          if (orientation === 'left') {
            return <ChevronLeft className="h-4 w-4" {...iconProps} />;
          }
          return <ChevronRight className="h-4 w-4" {...iconProps} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
