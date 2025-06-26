"use client";

import { useState, useTransition } from 'react';
import { type Property } from '@/lib/types';
import { deleteProperty, updateProperty, reEnhanceProperty } from '@/app/actions';
import { DatabaseTable } from '@/components/app/database-table';
import { EditDialog } from '@/components/app/edit-dialog';
import { useToast } from "@/hooks/use-toast";
import { Button } from '../ui/button';
import { downloadCsv, downloadJson, downloadExcel } from '@/lib/export';
import { Loader2 } from 'lucide-react';

interface DatabasePageProps {
  initialProperties: Property[];
}

export function DatabasePage({ initialProperties }: DatabasePageProps) {
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = (propertyId: string) => {
    startTransition(async () => {
      try {
        await deleteProperty(propertyId);
        setProperties(prev => prev.filter(p => p.id !== propertyId));
        toast({ title: "Success", description: "Property deleted." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete property." });
      }
    });
  };

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setIsEditDialogOpen(true);
  };
  
  const handleEnhance = (property: Property) => {
    startTransition(async () => {
        try {
            const enhancedProperty = await reEnhanceProperty(property);
            if(enhancedProperty) {
                 handleSave(enhancedProperty);
                 toast({ title: "Success", description: "Property content enhanced and updated." });
            } else {
                 toast({ variant: "destructive", title: "Error", description: "Failed to enhance property." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to enhance property." });
        }
    })
  }

  const handleSave = (updatedProperty: Property) => {
    startTransition(async () => {
      try {
        await updateProperty(updatedProperty);
        setProperties(prev => prev.map(p => p.id === updatedProperty.id ? updatedProperty : p));
        toast({ title: "Success", description: "Property updated." });
        setIsEditDialogOpen(false);
        setSelectedProperty(null);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update property." });
      }
    });
  };

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={() => downloadJson(properties, 'database_export')}>Export JSON</Button>
        <Button variant="outline" onClick={() => downloadCsv(properties, 'database_export')}>Export CSV</Button>
        <Button variant="outline" onClick={() => downloadExcel(properties, 'database_export')}>Export Excel</Button>
      </div>
      {isPending && <div className="flex justify-center items-center my-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      <DatabaseTable properties={properties} onDelete={handleDelete} onEdit={handleEdit} onEnhance={handleEnhance} />
      <EditDialog
        isOpen={isEditDialogOpen}
        property={selectedProperty}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
