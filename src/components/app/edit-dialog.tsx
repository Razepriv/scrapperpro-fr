"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Property } from '@/lib/types';

interface EditDialogProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProperty: Property) => void;
}

export function EditDialog({ property, isOpen, onClose, onSave }: EditDialogProps) {
  const [editedProperty, setEditedProperty] = useState<Property | null>(property);

  useEffect(() => {
    setEditedProperty(property);
  }, [property]);

  if (!isOpen || !editedProperty) return null;

  const handleChange = (field: keyof Property, value: string | number | string[]) => {
    setEditedProperty(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...(editedProperty.featuresAndAmenities || [])];
    newFeatures[index] = value;
    handleChange('featuresAndAmenities', newFeatures);
  };
  
  const addFeature = () => {
     const newFeatures = [...(editedProperty.featuresAndAmenities || []), ''];
     handleChange('featuresAndAmenities', newFeatures);
  }

  const removeFeature = (index: number) => {
    const newFeatures = [...(editedProperty.featuresAndAmenities || [])];
    newFeatures.splice(index, 1);
    handleChange('featuresAndAmenities', newFeatures);
  }


  const handleSave = () => {
    if (editedProperty) {
      onSave(editedProperty);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Property Details</DialogTitle>
          <DialogDescription>
            Make changes to the scraped property information. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
            
            {Object.entries(editedProperty).map(([key, value]) => {
                if (key === 'id' || key === 'scraped_at' || key === 'original_url' || key === 'image_url') return null;

                if (key === 'image_urls' && Array.isArray(value)) {
                    return (
                        <div key={key} className="space-y-2">
                            <Label>Image URLs</Label>
                            {value.map((url, index) => (
                                <div key={index} className="flex items-center gap-2">
                                <Input
                                    value={url}
                                    readOnly
                                    className="text-muted-foreground"
                                />
                                </div>
                            ))}
                             <p className="text-xs text-muted-foreground">Image URLs are read-only.</p>
                        </div>
                    )
                }
                
                if (key === 'featuresAndAmenities' && Array.isArray(value)) {
                    return (
                        <div key={key} className="space-y-2">
                            <Label>Features & Amenities</Label>
                            {value.map((feature, index) => (
                                <div key={index} className="flex items-center gap-2">
                                <Input
                                    value={feature}
                                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                                />
                                <Button variant="outline" size="sm" onClick={() => removeFeature(index)}>Remove</Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addFeature}>Add Feature</Button>
                        </div>
                    )
                }

                const isTextArea = ['description', 'enhanced_description', 'original_description', 'terms_and_condition', 'building_information'].includes(key);
                
                return (
                    <div key={key} className="space-y-2">
                        <Label htmlFor={key} className="capitalize">{key.replace(/_/g, ' ')}</Label>
                        {isTextArea ? (
                             <Textarea
                                id={key}
                                value={String(value)}
                                onChange={(e) => handleChange(key as keyof Property, e.target.value)}
                                className="min-h-[100px]"
                            />
                        ) : (
                            <Input
                                id={key}
                                type={typeof value === 'number' ? 'number' : 'text'}
                                value={String(value)}
                                onChange={(e) => handleChange(key as keyof Property, e.target.value)}
                            />
                        )}
                    </div>
                );
            })}
            </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
