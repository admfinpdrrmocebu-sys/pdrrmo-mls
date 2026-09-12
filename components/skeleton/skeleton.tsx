'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded' | 'pill';
  width?: string | number;
  height?: string | number;
  shimmer?: boolean;
}

export function Skeleton({
  variant = 'rounded',
  width,
  height,
  shimmer = true,
  className,
  style,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded-md',
    circular: 'rounded-full aspect-square',
    rectangular: 'rounded-none',
    rounded: 'rounded-2xl',
    pill: 'rounded-full',
  };

  const styleObj: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      style={styleObj}
      className={twMerge(
        'relative overflow-hidden bg-slate-200/80 select-none pointer-events-none',
        variantClasses[variant],
        shimmer
          ? 'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent'
          : 'animate-pulse',
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;
