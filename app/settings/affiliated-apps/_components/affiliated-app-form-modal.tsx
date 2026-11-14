'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutGrid,
  RefreshCw,
  X,
  Camera,
  Upload,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { supabase } from '@/lib/supabase/client';
import {
  AffiliatedAppRecord,
  STORAGE_BUCKET,
  getErrorMessage,
  isLikelySnapReadyUrl,
  normalizeDisplayHost,
  normalizeFullUrl,
} from './types';

interface AffiliatedAppFormModalProps {
  editingApp: AffiliatedAppRecord | null;
  nextSortOrder: number;
  actorId: string | null;
  onClose: () => void;
  onSaved: (savedRecord: AffiliatedAppRecord | null, toastMessage: string, editingId?: string) => void;
}

export default function AffiliatedAppFormModal({
  editingApp,
  nextSortOrder,
  actorId,
  onClose,
  onSaved,
}: AffiliatedAppFormModalProps) {
  const [appName, setAppName] = useState(() => editingApp?.name ?? '');
  const [appLink, setAppLink] = useState(() => editingApp?.appUrl ?? '');
  const [imageUrl, setImageUrl] = useState(() => editingApp?.imageUrl ?? '');
  const [storagePath, setStoragePath] = useState<string | null>(
    () => editingApp?.storagePath ?? null
  );
  const [isActive, setIsActive] = useState(() => editingApp?.isActive ?? true);

  const [isSnapping, setIsSnapping] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [snapSuccessHint, setSnapSuccessHint] = useState<string | null>(null);

  const lastAutoSnappedUrlRef = useRef<string>(
    editingApp ? normalizeFullUrl(editingApp.appUrl) : ''
  );
  const unsavedTempPathsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cleanupUnsavedTempFiles = useCallback(async () => {
    const paths = Array.from(unsavedTempPathsRef.current);
    unsavedTempPathsRef.current.clear();
    if (paths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(paths).catch(() => {});
    }
  }, []);

  const captureLinkSnapshot = useCallback(
    async (rawUrl: string, currentUnsavedPath?: string | null) => {
      const normalized = normalizeFullUrl(rawUrl);
      if (!normalized) return;

      try {
        setIsSnapping(true);
        setSnapError(null);
        setSnapSuccessHint(null);

        const res = await fetch('/api/affiliated-apps/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: normalized,
            previousStoragePath:
              currentUnsavedPath && unsavedTempPathsRef.current.has(currentUnsavedPath)
                ? currentUnsavedPath
                : null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSnapError(
            data?.error ||
              'Could not automatically snap preview. You can upload a picture manually.'
          );
          return;
        }

        if (currentUnsavedPath && unsavedTempPathsRef.current.has(currentUnsavedPath)) {
          unsavedTempPathsRef.current.delete(currentUnsavedPath);
        }

        if (data.storagePath) {
          unsavedTempPathsRef.current.add(data.storagePath);
        }

        setImageUrl(data.imageUrl);
        setStoragePath(data.storagePath || null);
        lastAutoSnappedUrlRef.current = normalized;
        setSnapSuccessHint('Webpage snapped & saved as picture');

        setAppName((prev) => {
          if (prev.trim()) return prev;
          if (typeof data.suggestedTitle === 'string' && data.suggestedTitle.trim()) {
            return data.suggestedTitle.trim().slice(0, 80);
          }
          return prev;
        });
      } catch (err: unknown) {
        setSnapError(getErrorMessage(err, 'Network error while snapping webpage preview.'));
      } finally {
        setIsSnapping(false);
      }
    },
    []
  );

  // Automatic debounced snap (800ms) when user enters or pastes a valid App Link
  useEffect(() => {
    if (!isLikelySnapReadyUrl(appLink)) return;

    const normalized = normalizeFullUrl(appLink);
    if (normalized === lastAutoSnappedUrlRef.current) return;

    const timer = setTimeout(() => {
      captureLinkSnapshot(normalized, storagePath);
    }, 800);

    return () => clearTimeout(timer);
  }, [appLink, captureLinkSnapshot, storagePath]);

  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSnapError('Please select a PNG, JPG, or WEBP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSnapError('Image size must be 10MB or smaller.');
      return;
    }

    try {
      setIsUploadingFile(true);
      setSnapError(null);
      setSnapSuccessHint(null);

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeBase =
        file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-z0-9-]/gi, '-')
          .toLowerCase()
          .slice(0, 32) || 'app-preview';

      const newPath = `uploads/${Date.now()}-${safeBase}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(newPath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      if (storagePath && unsavedTempPathsRef.current.has(storagePath)) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
        unsavedTempPathsRef.current.delete(storagePath);
      }

      unsavedTempPathsRef.current.add(newPath);

      const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(newPath);
      setImageUrl(pubData.publicUrl);
      setStoragePath(newPath);
      setSnapSuccessHint('Custom picture uploaded & ready');
    } catch (err: unknown) {
      setSnapError(
        `Upload failed: ${getErrorMessage(err, 'Ensure the affiliated-apps storage bucket is created.')}`
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleClose = async () => {
    if (isSaving) return;
    onClose();
    await cleanupUnsavedTempFiles();
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = appName.trim();
    const normalizedUrl = normalizeFullUrl(appLink);

    if (!trimmedName) {
      setSnapError('App Name is required.');
      return;
    }
    if (!normalizedUrl) {
      setSnapError('App Link is required.');
      return;
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setSnapError('App Link must start with http:// or https://.');
        return;
      }
    } catch {
      setSnapError('Please enter a valid App Link URL.');
      return;
    }

    if (!imageUrl) {
      setSnapError('Please wait for the link picture to snap or upload a custom image.');
      return;
    }

    try {
      setIsSaving(true);
      setSnapError(null);

      let savedRecord: AffiliatedAppRecord | null = null;
      let toastMessage = '';

      if (editingApp) {
        const previousCommittedPath = editingApp.storagePath;

        const { data: updatedRow, error } = await supabase
          .from('affiliated_apps')
          .update({
            name: trimmedName,
            app_url: normalizedUrl,
            image_url: imageUrl,
            storage_path: storagePath,
            is_active: isActive,
            updated_by: actorId,
          })
          .eq('id', editingApp.id)
          .select('id, name, app_url, image_url, storage_path, sort_order, is_active, created_at, updated_at')
          .maybeSingle();

        if (error) throw error;

        if (storagePath) {
          unsavedTempPathsRef.current.delete(storagePath);
        }
        if (previousCommittedPath && previousCommittedPath !== storagePath) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([previousCommittedPath])
            .catch(() => {});
        }

        if (actorId) {
          await supabase
            .from('audit_logs')
            .insert({
              user_id: actorId,
              action: 'UPDATE_AFFILIATED_APP',
              entity_type: 'affiliated_apps',
              entity_id: editingApp.id,
              details: { name: trimmedName, app_url: normalizedUrl },
            })
            .then(() => {});
        }

        if (updatedRow) {
          savedRecord = {
            id: updatedRow.id,
            name: updatedRow.name,
            appUrl: updatedRow.app_url,
            imageUrl: updatedRow.image_url,
            storagePath: updatedRow.storage_path || null,
            sortOrder: updatedRow.sort_order ?? editingApp.sortOrder,
            isActive: updatedRow.is_active ?? isActive,
            createdAt: updatedRow.created_at,
            updatedAt: updatedRow.updated_at,
          };
        }
        toastMessage = `Updated "${trimmedName}" successfully.`;
      } else {
        const { data: inserted, error } = await supabase
          .from('affiliated_apps')
          .insert({
            name: trimmedName,
            app_url: normalizedUrl,
            image_url: imageUrl,
            storage_path: storagePath,
            sort_order: nextSortOrder,
            is_active: isActive,
            created_by: actorId,
            updated_by: actorId,
          })
          .select('id, name, app_url, image_url, storage_path, sort_order, is_active, created_at, updated_at')
          .maybeSingle();

        if (error) throw error;

        if (storagePath) {
          unsavedTempPathsRef.current.delete(storagePath);
        }

        if (actorId) {
          await supabase
            .from('audit_logs')
            .insert({
              user_id: actorId,
              action: 'CREATE_AFFILIATED_APP',
              entity_type: 'affiliated_apps',
              entity_id: inserted?.id || null,
              details: { name: trimmedName, app_url: normalizedUrl },
            })
            .then(() => {});
        }

        if (inserted) {
          savedRecord = {
            id: inserted.id,
            name: inserted.name,
            appUrl: inserted.app_url,
            imageUrl: inserted.image_url,
            storagePath: inserted.storage_path || null,
            sortOrder: inserted.sort_order ?? nextSortOrder,
            isActive: inserted.is_active ?? isActive,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at,
          };
        }
        toastMessage = `Added "${trimmedName}" to Affiliated Apps.`;
      }

      await cleanupUnsavedTempFiles();
      onSaved(savedRecord, toastMessage, editingApp?.id);
    } catch (err: unknown) {
      setSnapError(getErrorMessage(err, 'Failed to save Affiliated App.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 flex items-center justify-center shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                {editingApp ? 'Edit Affiliated Web App' : 'Add Affiliated Web App'}
              </h2>
              <p className="text-xs text-[#505F76]">
                Provide the App Link to automatically snap &amp; save its preview picture.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form
          onSubmit={handleSaveApp}
          className="p-6 space-y-5 overflow-y-auto custom-scrollbar"
        >
          {/* Field 1: App Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide block">
              App Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g., PDRRMO Weather Telemetry Portal"
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all placeholder:text-[#94A3B8]"
            />
          </div>

          {/* Field 2: App Link (Triggers Automatic Snapshot) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide">
                App Link <span className="text-rose-600">*</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#004AC6]">
                <Sparkles className="w-3 h-3" />
                Auto-snaps on valid URL
              </span>
            </div>

            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-[#757680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={appLink}
                  onChange={(e) => setAppLink(e.target.value)}
                  placeholder="https://example.pdrrmo.gov.ph"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all placeholder:text-[#94A3B8]"
                />
              </div>

              <button
                type="button"
                disabled={!isLikelySnapReadyUrl(appLink) || isSnapping || isUploadingFile}
                onClick={() => captureLinkSnapshot(appLink, storagePath)}
                className="px-3.5 py-2.5 rounded-xl bg-blue-50 text-[#004AC6] border border-blue-200/80 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                title="Capture live screenshot from App Link"
              >
                {isSnapping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <span>{imageUrl ? 'Re-snap' : 'Snap Link'}</span>
              </button>
            </div>
          </div>

          {/* Field 3: Image (Auto-Snapped Preview & Saved Picture) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wide">
                Image Preview <span className="text-rose-600">*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleManualImageUpload}
                className="hidden"
              />

              <button
                type="button"
                disabled={isSnapping || isUploadingFile}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#505F76] hover:text-[#004AC6] transition-colors cursor-pointer disabled:opacity-45"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Picture</span>
              </button>
            </div>

            {/* 16:10 Browser Frame Container */}
            <div className="rounded-2xl border border-[#CBD5E1] overflow-hidden bg-[#F8FAFC] shadow-2xs">
              {/* Browser Chrome Bar */}
              <div className="h-7 bg-white border-b border-[#E2E8F0] px-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-[10px] font-mono text-[#757680] truncate">
                    {appLink.trim() ? normalizeDisplayHost(appLink) : 'preview.pdrrmo.local'}
                  </span>
                </div>
                {snapSuccessHint && !isSnapping && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Saved as Picture
                  </span>
                )}
              </div>

              {/* Preview Viewport */}
              <div className="relative w-full aspect-[16/10] bg-[#F1F5F9] flex items-center justify-center overflow-hidden">
                {isSnapping || isUploadingFile ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 p-6 text-center">
                    <div className="w-11 h-11 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1E293B]">
                        {isUploadingFile
                          ? 'Uploading custom picture...'
                          : 'Snapping live webpage preview...'}
                      </p>
                      <p className="text-[11px] text-[#505F76] mt-0.5">
                        Capturing &amp; saving image to Supabase Storage
                      </p>
                    </div>
                  </div>
                ) : imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Snapped App Preview"
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      {isLikelySnapReadyUrl(appLink) && (
                        <button
                          type="button"
                          onClick={() => captureLinkSnapshot(appLink, storagePath)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Re-snap</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Replace</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-center max-w-xs">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-[#E2E8F0] text-[#505F76] flex items-center justify-center shadow-2xs">
                      <Camera className="w-5 h-5 text-[#004AC6]" />
                    </div>
                    <p className="text-xs font-bold text-[#1E293B]">
                      Automatic Link Picture Capture
                    </p>
                    <p className="text-[11px] text-[#505F76] leading-relaxed">
                      Enter an <strong>App Link</strong> above to snap its live landing page automatically, or click <strong>Upload Custom Picture</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div>
              <p className="text-xs font-bold text-[#1E293B]">
                Show in Affiliated Apps Navbar
              </p>
              <p className="text-[11px] text-[#505F76]">
                Make this web app visible on the Affiliated Apps directory screen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer shrink-0 ${
                isActive ? 'bg-[#004AC6] justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {/* Error Notice */}
          {snapError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{snapError}</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E2E8F0]">
            <SecondaryButton
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              size="sm"
              isLoading={isSaving}
              disabled={
                isSaving ||
                isSnapping ||
                isUploadingFile ||
                !appName.trim() ||
                !appLink.trim() ||
                !imageUrl
              }
            >
              {editingApp ? 'Save Changes' : 'Save Affiliated App'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
