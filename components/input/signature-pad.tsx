'use client';

import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface SignaturePadProps {
  label?: string;
  onSignatureChange?: (dataUrl: string | null) => void;
  className?: string;
}

export function SignaturePad({
  label = 'Digital Signature',
  onSignatureChange,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution for canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#004AC6';
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current && onSignatureChange) {
      onSignatureChange(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (onSignatureChange) {
      onSignatureChange(null);
    }
  };

  return (
    <div className={twMerge('flex flex-col gap-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 w-full', className)}>
      <div className="flex items-center justify-between mb-1 px-1">
        <label className="flex items-center gap-2 text-xs font-semibold text-[#505F76] uppercase tracking-wide">
          <PenTool className="w-3.5 h-3.5 text-[#505F76]" />
          <span>{label}</span>
        </label>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs font-semibold text-[#004AC6] hover:text-[#003594] transition-colors cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="relative w-full h-24 bg-white rounded-lg border border-[#E2E8F0] flex items-center justify-center overflow-hidden cursor-crosshair">
        {!hasSignature && (
          <span className="pointer-events-none absolute text-[#94A3B8] text-xs font-medium select-none">
            Sign here
          </span>
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full touch-none"
        />
      </div>
    </div>
  );
}

export default SignaturePad;
