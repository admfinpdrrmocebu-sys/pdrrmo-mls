'use client';

import React from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import { isOptimizableSupabaseImageUrl } from './types';

interface AppPreviewImageProps {
  src: string;
  alt: string;
  host: string;
  isBroken: boolean;
  priority?: boolean;
  sizes?: string;
  onError: () => void;
}

export const AppPreviewImage = React.memo(function AppPreviewImage({
  src,
  alt,
  host,
  isBroken,
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  onError,
}: AppPreviewImageProps) {
  if (!src || isBroken) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#757680] p-4 text-center">
        <Globe className="w-8 h-8 text-[#004AC6]/60" />
        <span className="text-xs font-semibold text-[#505F76] truncate max-w-full">
          {host}
        </span>
      </div>
    );
  }

  if (isOptimizableSupabaseImageUrl(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        onError={onError}
        className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={onError}
      className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
    />
  );
});
