'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { twMerge } from 'tailwind-merge';

export interface SecondaryCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
}

export function SecondaryCard({ children, className, ...props }: SecondaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={twMerge(
        'rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 text-[#1E293B]',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default SecondaryCard;
