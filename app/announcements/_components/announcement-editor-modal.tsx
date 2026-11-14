'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Eye,
  FileText,
  List,
  ListOrdered,
  Loader2,
  Megaphone,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { getPlainText, sanitizeHtml } from './types';

export interface AnnouncementEditorModalProps {
  editingId: string | null;
  initialTitle: string;
  initialDescription: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    editingId: string | null;
    title: string;
    description: string;
  }) => Promise<void>;
}

export function AnnouncementEditorModal({
  editingId,
  initialTitle,
  initialDescription,
  isSubmitting,
  onClose,
  onSubmit,
}: AnnouncementEditorModalProps) {
  const [formTitle, setFormTitle] = useState(initialTitle);
  const [formDescription, setFormDescription] = useState(initialDescription);
  const [activeModalTab, setActiveModalTab] = useState<'write' | 'preview'>('write');

  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isBulletActive, setIsBulletActive] = useState(false);
  const [isNumberedActive, setIsNumberedActive] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  const checkActiveCommands = useCallback(() => {
    if (typeof document !== 'undefined') {
      try {
        setIsBoldActive(document.queryCommandState('bold'));
        setIsBulletActive(document.queryCommandState('insertUnorderedList'));
        setIsNumberedActive(document.queryCommandState('insertOrderedList'));
      } catch {
        // Ignore in environments where queryCommandState is restricted
      }
    }
  }, []);

  // Sync ContentEditable DOM when switching back to Write mode or mounting
  useEffect(() => {
    if (activeModalTab === 'write' && editorRef.current) {
      if (editorRef.current.innerHTML !== formDescription) {
        editorRef.current.innerHTML = formDescription || '';
      }
    }
  }, [activeModalTab, formDescription]);

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (typeof document !== 'undefined') {
      if (editorRef.current) {
        editorRef.current.focus();
      }
      document.execCommand(command, false, value);
      if (editorRef.current) {
        setFormDescription(editorRef.current.innerHTML);
        checkActiveCommands();
      }
    }
  };

  const isEditorEmpty =
    !formDescription ||
    formDescription === '<br>' ||
    formDescription === '<p><br></p>' ||
    getPlainText(formDescription) === '';

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      editingId,
      title: formTitle,
      description: formDescription,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#004AC6]" />
            <h3 className="text-base font-bold text-[#1E293B]">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#757680] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="anc-title" className="text-xs font-bold text-[#505F76]">
              Announcement Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="anc-title"
              type="text"
              required
              disabled={isSubmitting}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Typhoon Advisory or Station Protocol Update"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl py-2.5 px-3.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 hover:border-[#CBD5E1] transition-all disabled:opacity-60"
            />
          </div>

          {/* Rich WYSIWYG Description & Toolbar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#505F76]">
                Description & Content <span className="text-rose-500">*</span>
              </label>

              {/* Write / Preview Tab Switcher */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('write')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    activeModalTab === 'write'
                      ? 'bg-white text-[#004AC6] shadow-2xs font-semibold'
                      : 'text-[#757680] hover:text-[#1E293B]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    activeModalTab === 'preview'
                      ? 'bg-white text-[#004AC6] shadow-2xs font-semibold'
                      : 'text-[#757680] hover:text-[#1E293B]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              </div>
            </div>

            {activeModalTab === 'write' ? (
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden focus-within:border-[#004AC6] focus-within:ring-2 focus-within:ring-[#004AC6]/15 transition-all bg-[#F8FAFC]">
                {/* Document Formatting Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-100/70 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeCommand('bold');
                      }}
                      title="Make selection bold (Ctrl+B)"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        isBoldActive
                          ? 'bg-[#004AC6] text-white shadow-xs'
                          : 'text-[#334155] hover:bg-white hover:text-[#004AC6] hover:shadow-2xs'
                      }`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                      <span>Bold</span>
                    </button>

                    <div className="w-px h-4 bg-[#CBD5E1] mx-1" />

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeCommand('insertUnorderedList');
                      }}
                      title="Insert Bullet List"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        isBulletActive
                          ? 'bg-[#004AC6] text-white shadow-xs font-semibold'
                          : 'text-[#334155] hover:bg-white hover:text-[#004AC6] hover:shadow-2xs'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Bullet List</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeCommand('insertOrderedList');
                      }}
                      title="Insert Numbered List"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        isNumberedActive
                          ? 'bg-[#004AC6] text-white shadow-xs font-semibold'
                          : 'text-[#334155] hover:bg-white hover:text-[#004AC6] hover:shadow-2xs'
                      }`}
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Numbered List</span>
                    </button>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#004AC6] font-medium bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    <Sparkles className="w-3 h-3" />
                    <span>Live Rich Text</span>
                  </span>
                </div>

                {/* ContentEditable WYSIWYG Editor Area */}
                <div className="relative">
                  {isEditorEmpty && (
                    <div className="absolute top-3.5 left-3.5 text-sm text-[#94A3B8] pointer-events-none select-none">
                      Type announcement details here... Highlight text and click Bold to format directly.
                    </div>
                  )}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      setFormDescription(e.currentTarget.innerHTML);
                      checkActiveCommands();
                    }}
                    onSelect={checkActiveCommands}
                    onKeyUp={checkActiveCommands}
                    onClick={checkActiveCommands}
                    className="w-full min-h-[160px] max-h-[260px] overflow-y-auto p-3.5 text-sm text-[#1E293B] focus:outline-none leading-relaxed [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-1 [&_p]:my-1"
                  />
                </div>
              </div>
            ) : (
              <div className="border border-[#E2E8F0] rounded-xl p-4 min-h-[200px] bg-[#F8FAFC]">
                {formTitle && (
                  <h4 className="text-base font-bold text-[#1E293B] pb-2 mb-3 border-b border-[#E2E8F0]/70">
                    {formTitle}
                  </h4>
                )}
                {!isEditorEmpty ? (
                  <div
                    className="text-sm text-[#334155] leading-relaxed space-y-2 [&_strong]:font-bold [&_b]:font-bold [&_strong]:text-[#0F172A] [&_b]:text-[#0F172A] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-1 [&_p]:my-1"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(formDescription) }}
                  />
                ) : (
                  <p className="text-xs text-[#94A3B8] italic">
                    No content written yet. Switch to Write mode to type and format content.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-[#757680] pt-1 px-1">
              <span>Formatting:</span>
              <span className="text-[#1E293B] font-semibold">Highlighted text bolds directly in place</span>
              <span>·</span>
              <span>Lists render active bullets in the editor</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F5F9]">
            <SecondaryButton
              type="button"
              size="md"
              pill
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              size="md"
              pill
              disabled={isSubmitting}
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )
              }
            >
              {isSubmitting
                ? 'Saving...'
                : editingId
                ? 'Save Changes'
                : 'Publish'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default AnnouncementEditorModal;
