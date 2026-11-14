'use client';

import React, { useState } from 'react';
import { getInitials } from './types';

interface OfficerAvatarProps {
  officer?: {
    name?: string;
    avatarUrl?: string | null;
    avatarInitials?: string;
  } | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackBg?: string;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-14 h-14 text-base',
} as const;

export const OfficerAvatar = React.memo(function OfficerAvatar({
  officer,
  size = 'md',
  fallbackBg,
  className = '',
}: OfficerAvatarProps) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  const avatarUrl = officer?.avatarUrl ?? null;
  const imgError = Boolean(avatarUrl && failedAvatarUrl === avatarUrl);
  const hasImage = Boolean(avatarUrl && !imgError);
  const initials = officer?.avatarInitials || getInitials(officer?.name || 'OP');
  const defaultBg = fallbackBg || 'bg-[#004AC6] text-white';

  if (hasImage && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={officer?.name || 'Officer Avatar'}
        onError={() => setFailedAvatarUrl(avatarUrl)}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-[#E2E8F0] shadow-xs shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full font-bold flex items-center justify-center shadow-xs shrink-0 select-none ${defaultBg} ${className}`}
    >
      {initials}
    </div>
  );
});
