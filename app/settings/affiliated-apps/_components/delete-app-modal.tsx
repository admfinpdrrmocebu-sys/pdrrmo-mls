'use client';

import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SecondaryButton } from '@/components/button';
import { supabase } from '@/lib/supabase/client';
import { AffiliatedAppRecord, STORAGE_BUCKET, getErrorMessage } from './types';

interface DeleteAppModalProps {
  target: AffiliatedAppRecord;
  actorId: string | null;
  onClose: () => void;
  onDeleted: (deletedApp: AffiliatedAppRecord) => void;
  onError: (message: string) => void;
}

export default function DeleteAppModal({
  target,
  actorId,
  onClose,
  onDeleted,
  onError,
}: DeleteAppModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);

      const { error } = await supabase
        .from('affiliated_apps')
        .delete()
        .eq('id', target.id);

      if (error) throw error;

      if (target.storagePath) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([target.storagePath])
          .catch(() => {});
      }

      if (actorId) {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: actorId,
            action: 'DELETE_AFFILIATED_APP',
            entity_type: 'affiliated_apps',
            entity_id: target.id,
            details: { name: target.name, app_url: target.appUrl },
          })
          .then(() => {});
      }

      onDeleted(target);
    } catch (err: unknown) {
      onError(getErrorMessage(err, 'Failed to delete Affiliated App.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">
              Remove Affiliated App?
            </h3>
            <p className="text-xs sm:text-sm text-[#505F76] mt-1 leading-relaxed">
              Are you sure you want to delete <strong>{target.name}</strong>? Its saved preview picture will also be removed from storage.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <SecondaryButton
            type="button"
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </SecondaryButton>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Delete App</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
