
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyImageProps {
  src: string;
  alt: string;
  className?: string;
}

const DEBUG = process.env.NODE_ENV === 'development';

export function PropertyImage({ src, alt, className }: PropertyImageProps) {
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
        className={cn("bg-muted rounded-md flex items-center justify-center border-2 border-dashed border-destructive/20", className)}
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
      className={cn("relative bg-muted rounded-md overflow-hidden", className)}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className={cn(
          "object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={handleLoad}
        onError={handleError}
        data-ai-hint="property house"
      />
    </div>
  );
};
