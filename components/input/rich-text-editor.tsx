'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Bold, List } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (htmlContent: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  helperText?: string;
  error?: string;
}

// Helper to strip emoji icons and non-printable surrogate characters
export function stripEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{200D}\u{FE0E}\u{FE0F}\u{E0020}-\u{E007F}\u{E0001}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
}

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = 'Enter details...',
  minHeight = '120px',
  className,
  helperText,
  error,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isListActive, setIsListActive] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  // Sync value from prop to DOM whenever value changes externally
  useEffect(() => {
    if (editorRef.current) {
      const cleanVal = stripEmojis(value || '');
      if (editorRef.current.innerHTML !== cleanVal && document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = cleanVal;
        checkEmptyState();
      }
    }
  }, [value]);

  const checkEmptyState = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText.trim();
    setIsEmpty(text === '' && !editorRef.current.querySelector('img, ul, ol'));
  };

  const updateFormatState = () => {
    try {
      setIsBoldActive(document.queryCommandState('bold'));
      setIsListActive(document.queryCommandState('insertUnorderedList'));
    } catch {
      // ignore
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const cleanHtml = stripEmojis(html);
    if (cleanHtml !== html) {
      editorRef.current.innerHTML = cleanHtml;
    }
    onChange(cleanHtml);
    checkEmptyState();
    updateFormatState();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const cleaned = stripEmojis(text);
    document.execCommand('insertText', false, cleaned);
    handleInput();
  };

  const handleBoldClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('bold', false);
    updateFormatState();
    handleInput();
  };

  const handleListClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertUnorderedList', false);
    updateFormatState();
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Natural Ctrl+B / Cmd+B for bold
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      // Browser handles bold natively on contentEditable, but let's update states
      setTimeout(() => {
        updateFormatState();
        handleInput();
      }, 0);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Header with Label and Mini-Toolbar */}
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-xs font-semibold text-[#505F76] uppercase tracking-wider flex items-center gap-1.5">
            {label}
          </label>
        )}

        {/* Mini Document Formatting Toolbar: Bold & Bullet List Only */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-1 shadow-2xs">
          <button
            type="button"
            title="Bold (Ctrl+B)"
            onMouseDown={handleBoldClick}
            className={twMerge(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-all font-bold text-xs cursor-pointer select-none',
              isBoldActive
                ? 'bg-[#004AC6] text-white shadow-xs'
                : 'text-[#1E293B] hover:bg-slate-200/70 active:bg-slate-300'
            )}
          >
            <Bold className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <div className="w-px h-4 bg-slate-200" />

          <button
            type="button"
            title="Bullet List"
            onMouseDown={handleListClick}
            className={twMerge(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-all font-bold text-xs cursor-pointer select-none',
              isListActive
                ? 'bg-[#004AC6] text-white shadow-xs'
                : 'text-[#1E293B] hover:bg-slate-200/70 active:bg-slate-300'
            )}
          >
            <List className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* ContentEditable Visual Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyUp={updateFormatState}
          onMouseUp={updateFormatState}
          onKeyDown={handleKeyDown}
          style={{ minHeight }}
          className={twMerge(
            'w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 text-xs sm:text-sm text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all overflow-y-auto leading-relaxed max-h-56',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-1.5',
            '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-1.5',
            '[&_b]:font-bold [&_strong]:font-bold',
            error && 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15',
            className
          )}
        />

        {/* Floating placeholder when empty */}
        {isEmpty && (
          <div
            onClick={() => editorRef.current?.focus()}
            className="absolute top-3.5 left-3.5 text-xs sm:text-sm text-[#94A3B8] pointer-events-none select-none"
          >
            {placeholder}
          </div>
        )}
      </div>

      {/* Helper / Shortcuts bar */}
      <div className="flex items-center justify-between text-[11px] text-[#757680] px-1">
        <span>Shortcuts: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-[#1E293B]">Ctrl + B</kbd> to bold highlighted text</span>
        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-[#1E293B]">Enter</kbd> in list for next bullet</span>
      </div>

      {error && <p className="text-xs font-medium text-rose-600 mt-0.5">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#757680] mt-0.5">{helperText}</p>}
    </div>
  );
}

export default RichTextEditor;
