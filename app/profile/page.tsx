'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Save,
  RotateCcw,
  PenTool,
  Camera,
  Trash2,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { SignaturePad } from '@/components/input';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';

/**
 * Client-Side Image Compressor
 * ============================
 * Uses an off-screen HTML5 Canvas to resize and compress user avatar images
 * to a lightweight WebP format (max 512x512, ~0.82 quality), drastically
 * reducing upload bandwidth and file size.
 */
async function compressImage(
  file: File,
  maxWidth = 512,
  maxHeight = 512,
  quality = 0.82
): Promise<{ compressedFile: File; previewUrl: string; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Scale proportionally within maxWidth x maxHeight
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Image compression failed'));
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.webp`, {
            type: mimeType,
            lastModified: Date.now(),
          });

          const previewUrl = canvas.toDataURL(mimeType, quality);
          resolve({
            compressedFile,
            previewUrl,
            originalSize: file.size,
            compressedSize: blob.size,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

export default function ProfilePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { profile, user, refreshProfile, signOut } = useAuth();

  // Officer Profile State
  const [fullName, setFullName] = useState('Alex Thompson');
  const [email, setEmail] = useState('operator@pdrrmo.gov.ph');
  const [position, setPosition] = useState('Lead Dispatch Operations Officer');
  const [division, setDivision] = useState('Provincial Disaster Risk Reduction Management Office');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // Password Update State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Digital Signature State
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [newSignature, setNewSignature] = useState<string | null>(null);
  const [signatureImageError, setSignatureImageError] = useState(false);

  // Helper to resolve signature URL from storage path or full URL
  const getSignatureSrc = (sig: string | null): string | null => {
    if (!sig) return null;
    if (sig.startsWith('data:') || sig.startsWith('http://') || sig.startsWith('https://')) {
      return sig;
    }
    const cleanPath = sig.replace(/^signatures\//, '');
    const { data } = supabase.storage.from('signatures').getPublicUrl(cleanPath);
    return data?.publicUrl || sig;
  };

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    submessage?: string;
  } | null>(null);

  // Synchronize state when Supabase profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setPosition(profile.position_title || 'Monitoring Officer');
      setDivision(profile.division || 'Provincial Disaster Risk Reduction Management Office');
      if (profile.avatar_url) setProfileImage(profile.avatar_url);
      if (profile.signature_url) {
        setCurrentSignature(profile.signature_url);
        setSignatureImageError(false);
      }
    }
  }, [profile]);

  // Profile Image Upload Handler with Automatic Compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setToastNotification({
        message: 'File Too Large',
        submessage: 'Please select an image file under 15MB.',
      });
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }

    setIsCompressingImage(true);

    try {
      const { compressedFile, previewUrl, originalSize, compressedSize } = await compressImage(file, 512, 512, 0.82);

      setSelectedAvatarFile(compressedFile);
      setProfileImage(previewUrl);

      const originalKB = (originalSize / 1024).toFixed(0);
      const compressedKB = (compressedSize / 1024).toFixed(0);
      const savedPct = Math.round(((originalSize - compressedSize) / originalSize) * 100);

      setToastNotification({
        message: 'Photo Compressed & Ready',
        submessage: `Reduced from ${originalKB}KB to ${compressedKB}KB (${savedPct > 0 ? savedPct + '% smaller' : 'optimized'}). Save changes to apply.`,
      });
      setTimeout(() => setToastNotification(null), 4000);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      // Fallback to uncompressed file if canvas fails
      setSelectedAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProfileImage(reader.result);
          setToastNotification({
            message: 'Photo Selected',
            submessage: 'Remember to save changes to keep your new profile picture.',
          });
          setTimeout(() => setToastNotification(null), 3500);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressingImage(false);
    }
  };

  // Save profile changes handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (newPassword && newPassword !== confirmPassword) {
        setToastNotification({
          message: 'Password Mismatch',
          submessage: 'New password and confirmation password do not match.',
        });
        setIsSaving(false);
        return;
      }

      // 1. If new password provided, update Supabase Auth user password
      if (newPassword) {
        const { error: pwError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (pwError) {
          throw new Error(pwError.message);
        }
      }

      // 2. Upload avatar photo if newly selected
      let finalAvatarUrl = profileImage;
      if (selectedAvatarFile && user) {
        try {
          const fileExt = selectedAvatarFile.name.split('.').pop() || 'png';
          const avatarPath = `${user.id}-avatar-${Date.now()}.${fileExt}`;
          const { error: avatarUploadError } = await supabase.storage
            .from('avatars')
            .upload(avatarPath, selectedAvatarFile, { upsert: true });

          if (!avatarUploadError) {
            const { data: avatarData } = supabase.storage
              .from('avatars')
              .getPublicUrl(avatarPath);
            if (avatarData?.publicUrl) {
              finalAvatarUrl = avatarData.publicUrl;
              setProfileImage(finalAvatarUrl);
            }
          }
        } catch (avatarErr) {
          console.warn('Avatar upload error:', avatarErr);
        }
      }

      // 3. Upload new digital signature if drawn
      let finalSignatureUrl = currentSignature;
      if (newSignature && user) {
        try {
          const base64Data = newSignature.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });

          const filePath = `${user.id}-sig-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from('signatures')
            .upload(filePath, blob, { contentType: 'image/png', upsert: true });

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from('signatures')
              .getPublicUrl(filePath);
            if (publicData?.publicUrl) {
              finalSignatureUrl = publicData.publicUrl;
              setCurrentSignature(finalSignatureUrl);
              setSignatureImageError(false);
            }
          }
        } catch (uploadErr) {
          console.warn('Storage upload error:', uploadErr);
        }
      }

      // 4. Update public.profiles row
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            signature_url: finalSignatureUrl,
            avatar_url: finalAvatarUrl?.startsWith('data:') ? undefined : finalAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (profileError) {
          console.warn('Profile DB update error:', profileError.message);
        }

        await refreshProfile();
      }

      setSelectedAvatarFile(null);
      setNewSignature(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToastNotification({
        message: 'Profile Updated Successfully',
        submessage: 'Your officer credentials and digital signature have been saved.',
      });
      setTimeout(() => setToastNotification(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setToastNotification({
        message: 'Update Failed',
        submessage: message,
      });
      setTimeout(() => setToastNotification(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original values
  const handleReset = () => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setPosition(profile.position_title || 'Monitoring Officer');
      setDivision(profile.division || 'Provincial Disaster Risk Reduction Management Office');
      setProfileImage(profile.avatar_url || null);
      setCurrentSignature(profile.signature_url || null);
    }
    setNewSignature(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setToastNotification({
      message: 'Changes Reverted',
      submessage: 'Form fields have been reset to current profile values.',
    });
    setTimeout(() => setToastNotification(null), 3000);
  };

  return (
    <AppLayoutShell title="Officer Profile" subtitle="Account Credentials & Signature">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
        {/* ========================================================================= */}
        {/* 1. HEADER SECTION */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1E293B] tracking-tight">
              Profile & Account
            </h1>
            <p className="text-sm text-[#505F76] mt-1">
              Manage your personal credentials, security passwords, and official duty signature.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. PROFILE FORM */}
        {/* ========================================================================= */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Card 1: Officer Information */}
          <GeneralCard className="p-6 sm:p-8 border-[#E2E8F0] shadow-xs">
            {/* Header with Avatar & Photo Upload */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-[#E2E8F0]">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageChange}
                className="hidden"
                aria-label="Upload profile photo"
              />

              {/* Avatar Surface */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-[#004AC6] text-white flex items-center justify-center font-extrabold text-2xl shadow-md border-2 border-white overflow-hidden relative">
                  {isCompressingImage && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white z-20">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                  {profileImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profileImage}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'OP'
                  )}
                </div>

                {/* Upload Overlay Button on Avatar */}
                <button
                  type="button"
                  disabled={isCompressingImage}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload new profile picture"
                  className="absolute bottom-0 right-0 w-7 h-7 bg-[#004AC6] hover:bg-[#003594] text-white rounded-full border-2 border-white shadow-sm flex items-center justify-center transition-transform hover:scale-110 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Identity & Upload Trigger */}
              <div className="text-center sm:text-left flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">{fullName}</h2>
                    <p className="text-xs text-[#004AC6] font-semibold">{position}</p>
                    <p className="text-xs text-[#505F76] mt-0.5">{division}</p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={signOut}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-full border border-rose-200/80 shadow-2xs transition-all cursor-pointer group"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>

                  {/* Photo Actions */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#004AC6] bg-[#004AC6]/8 hover:bg-[#004AC6]/15 rounded-full border border-[#004AC6]/20 transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{profileImage ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>

                    {profileImage && (
                      <button
                        type="button"
                        onClick={() => setProfileImage(null)}
                        title="Remove profile picture"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-full border border-rose-200 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pt-6">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fullName" className="text-xs font-bold text-[#505F76]">
                  Full Name
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-3 pl-11 pr-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-bold text-[#505F76]">
                  Email Address
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-3 pl-11 pr-4 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                  />
                </div>
              </div>

              {/* Position / Role (Assigned by Admin - Disabled) */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="position" className="text-xs font-bold text-[#505F76]">
                  Position / Role
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#94A3B8] pointer-events-none">
                    <Briefcase className="w-4 h-4" />
                  </span>
                  <input
                    id="position"
                    type="text"
                    disabled
                    value={position}
                    className="w-full bg-slate-100/90 border border-[#E2E8F0] rounded-full py-3 pl-11 pr-4 text-sm text-[#505F76] font-medium cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>
          </GeneralCard>

          {/* Card 2: Password & Security */}
          <GeneralCard className="p-6 sm:p-8 border-[#E2E8F0] shadow-xs">
            <div className="mb-5">
              <h3 className="text-base font-bold text-[#1E293B]">Security & Password</h3>
              <p className="text-xs text-[#505F76] mt-0.5">
                Leave blank if you do not wish to change your current password.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Current Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="currentPassword" className="text-xs font-bold text-[#505F76]">
                  Current Password
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-3 pl-11 pr-11 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 flex items-center justify-center text-[#757680] hover:text-[#1E293B] transition-colors focus:outline-none cursor-pointer"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="newPassword" className="text-xs font-bold text-[#505F76]">
                  New Password
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-3 pl-11 pr-11 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 flex items-center justify-center text-[#757680] hover:text-[#1E293B] transition-colors focus:outline-none cursor-pointer"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-bold text-[#505F76]">
                  Confirm New Password
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute left-4 flex items-center justify-center text-[#757680] pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-full py-3 pl-11 pr-11 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 flex items-center justify-center text-[#757680] hover:text-[#1E293B] transition-colors focus:outline-none cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </GeneralCard>

          {/* Card 3: Digital Signature */}
          <GeneralCard className="p-6 sm:p-8 border-[#E2E8F0] shadow-xs">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <PenTool className="w-4 h-4 text-[#004AC6]" />
                <h3 className="text-base font-bold text-[#1E293B]">Official Duty Signature</h3>
              </div>
              <p className="text-xs text-[#505F76]">
                This signature is stamped on official shift logs, incident reports, and archived documents.
              </p>
            </div>

            {/* Signature Grid: Current Preview on Left, Redraw on Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
              {/* Current Signature Preview */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide">
                    Current Signature Preview
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active on Records
                  </span>
                </div>

                <div className="h-32 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                  {currentSignature && !signatureImageError ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={getSignatureSrc(currentSignature) || currentSignature}
                      alt="Current Duty Signature"
                      onError={() => setSignatureImageError(true)}
                      className="max-h-16 max-w-full object-contain filter drop-shadow-xs"
                    />
                  ) : (
                    /* Default Official Signature Vector */
                    <svg
                      viewBox="0 0 260 70"
                      className="w-44 h-14 text-[#004AC6]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M 20 50 Q 35 15 50 30 Q 65 45 55 60 Q 75 15 95 38 T 130 35 Q 150 25 170 48 Q 190 20 210 40 Q 225 30 245 45" />
                      <path d="M 45 42 Q 100 38 230 40" strokeWidth="1.4" />
                      <path d="M 195 55 C 210 65 235 60 225 50" strokeWidth="1.4" />
                    </svg>
                  )}
                  <div className="mt-2 text-center">
                    <p className="text-[11px] font-semibold text-[#1E293B]">{fullName}</p>
                    <p className="text-[10px] text-[#757680]">{position}</p>
                  </div>
                </div>
              </div>

              {/* Redraw / Update Signature Pad */}
              <div className="flex flex-col gap-1.5">
                <SignaturePad
                  label="Draw New Signature"
                  onSignatureChange={(data) => setNewSignature(data)}
                />
              </div>
            </div>
          </GeneralCard>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <SecondaryButton
              type="button"
              size="lg"
              pill
              leftIcon={<RotateCcw className="w-4 h-4" />}
              onClick={handleReset}
            >
              Reset
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              size="lg"
              pill
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </PrimaryButton>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 3. TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 print:hidden"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{toastNotification.message}</p>
              {toastNotification.submessage && (
                <p className="text-xs text-slate-300">{toastNotification.submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
