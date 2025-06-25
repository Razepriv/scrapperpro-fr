
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

const DEBUG = process.env.NODE_ENV === 'development';

export function PropertyImage({ src, alt, className, width = 200, height = 150 }: PropertyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (DEBUG) {
    console.log(`🖼️ [Frontend] Rendering image: ${src}`);
  }

  const handleError = () => {
    if (DEBUG) {
      console.error(`❌ [Frontend] Failed to load image: ${src}`);
    }
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    if (DEBUG) {
      console.log(`✅ [Frontend] Successfully loaded image: ${src}`);
    }
    setIsLoading(false);
  };
  
  if (hasError) {
    return (
      <div 
        className={cn("flex-shrink-0 bg-muted rounded-md flex items-center justify-center border-2 border-dashed border-destructive/20", className)}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <div className="text-center p-2 overflow-hidden">
          <AlertCircle className="h-6 w-6 text-destructive/80 mx-auto mb-1" />
          <p className="text-xs text-destructive">Failed to load</p>
          <p className="text-[10px] text-muted-foreground/70 break-all mt-1 truncate" title={src}>{src}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("flex-shrink-0 relative bg-muted rounded-md overflow-hidden", className)}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "object-cover h-full w-full transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={handleLoad}
        onError={handleError}
        data-ai-hint="property house"
      />
    </div>
  );
};
