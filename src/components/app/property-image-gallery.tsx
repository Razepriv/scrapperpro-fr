
"use client";

import React, { useState } from 'react';
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

  const validImages = imageUrls.filter(url => url && !url.includes('placehold.co'));

  if (validImages.length === 0) {
    return (
      <div className="no-images">
        <div className="placeholder-icon"><Home size={48} /></div>
        <p>No images available</p>
      </div>
    );
  }

  const currentImage = validImages[currentImageIndex];

  return (
    <div className="property-gallery">
      <div className="main-image">
        <PropertyImage
          key={currentImage} // Force re-render on change
          src={currentImage}
          alt={`${title} - Image ${currentImageIndex + 1}`}
          className='w-full h-full'
        />
        {validImages.length > 1 && (
          <div className="image-counter">
            {currentImageIndex + 1} / {validImages.length}
          </div>
        )}
      </div>

      {validImages.length > 1 && (
        <div className="thumbnail-strip">
          {validImages.map((img, index) => (
            <div
              key={index}
              className={cn('thumbnail', index === currentImageIndex ? 'active' : '')}
              onClick={() => setCurrentImageIndex(index)}
            >
              <PropertyImage
                src={img}
                alt={`Thumbnail ${index + 1}`}
                className='w-full h-full'
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
