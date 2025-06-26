"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface EnhanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    original: string;
    enhanced: string;
  } | null;
}

export function EnhanceDialog({ isOpen, onClose, content }: EnhanceDialogProps) {
  if (!content) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI Content Enhancement</DialogTitle>
          <DialogDescription>
            Comparing the original description with the AI-enhanced version.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
          <div className="flex flex-col gap-2 overflow-hidden">
            <h3 className="font-semibold text-lg">Original Content</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground p-4 border rounded-md h-full overflow-y-auto whitespace-pre-wrap">
              {content.original}
            </div>
          </div>
          <div className="flex flex-col gap-2 overflow-hidden">
            <h3 className="font-semibold text-lg text-primary">Enhanced Content</h3>
            <div className="prose prose-sm max-w-none p-4 border rounded-md border-primary/50 bg-primary/5 h-full overflow-y-auto whitespace-pre-wrap">
              {content.enhanced}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
