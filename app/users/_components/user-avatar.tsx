'use client';

import React, { useState } from 'react';
import { getAvatarColor, getInitials } from './types';

export interface UserAvatarProps {
  user: {
    name?: string;
    email?: string;
    avatarUrl?: string | null;
    avatarColor?: string;
    initials?: string;
    id?: string;
    status?: 'Active' | 'Inactive';
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-lg',
};

const statusDotSizes = {
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-[1.5px]',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
};

function AvatarImage({
  src,
  alt,
  sizeClass,
  fallback,
}: {
  src: string;
  alt: string;
  sizeClass: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover border border-[#E2E8F0] shadow-xs`}
    />
  );
}

export const UserAvatar = React.memo(function UserAvatar({
  user,
  size = 'md',
  showStatus = false,
  className = '',
}: UserAvatarProps) {
  const initials = user.initials || getInitials(user.name || user.email || 'Personnel');
  const bgColor = user.avatarColor || getAvatarColor(user.id || user.email || user.name || 'avatar');

  const initialsFallback = (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-xs select-none`}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  );

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {user.avatarUrl ? (
        <AvatarImage
          key={user.avatarUrl}
          src={user.avatarUrl}
          alt={user.name || 'User Avatar'}
          sizeClass={sizeClasses[size]}
          fallback={initialsFallback}
        />
      ) : (
        initialsFallback
      )}

      {showStatus && user.status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-white ${
            statusDotSizes[size]
          } ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
          title={user.status}
        />
      )}
    </div>
  );
});
