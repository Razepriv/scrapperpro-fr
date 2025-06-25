
"use client";

import React, { useState, useEffect } from 'react';
import { PropertyImage } from './property-image';
import { cn } from '@/lib/utils';
import { Home } from 'lucide-react';

interface PropertyImageGalleryProps {
  propertyId: string;
  imageUrls: string[];
  title: string;
}

export const PropertyImageGallery: React.FC<PropertyImageGalleryProps> = ({ propertyId, imageUrls, title }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Reset index if the array of images changes to prevent out-of-bounds errors
    setCurrentImageIndex(0);
  }, [imageUrls]);

  if (!imageUrls || imageUrls.length === 0 || imageUrls[0].includes('placehold.co')) {
    return (
      <div className="no-images">
        <div className="placeholder-icon"><Home size={48} /></div>
        <p>No images available</p>
      </div>
    );
  }

  // Ensure currentImageIndex is valid.
  const safeIndex = Math.max(0, Math.min(currentImageIndex, imageUrls.length - 1));
  const currentImage = imageUrls[safeIndex];

  return (
    <div className="property-gallery">
      <div className="main-image">
        <PropertyImage
          key={currentImage} // Force re-render on src change to reset loading/error state
          src={currentImage}
          alt={`${title} - Image ${safeIndex + 1}`}
          className='w-full h-full'
        />
        {imageUrls.length > 1 && (
          <div className="image-counter">
            {safeIndex + 1} / {imageUrls.length}
          </div>
        )}
      </div>

      {imageUrls.length > 1 && (
        <div className="thumbnail-strip">
          {imageUrls.map((img, index) => (
            <div
              key={`${propertyId}-thumb-${index}`}
              className={cn('thumbnail w-[60px] h-[60px] flex-shrink-0 cursor-pointer', index === safeIndex ? 'active' : '')}
              onClick={() => setCurrentImageIndex(index)}
            >
              <PropertyImage
                src={img}
                alt={`Thumbnail ${index + 1}`}
                className='w-full h-full property-image-container rounded-md'
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
