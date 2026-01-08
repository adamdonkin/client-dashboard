'use client'

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Client } from "./types";
import { supabase } from "@/lib/supabaseClient";

interface ClientEditDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdate: (client: Client) => void;
}

export function ClientEditDialog({ client, open, onOpenChange, onClientUpdate }: ClientEditDialogProps) {
  const [notes, setNotes] = useState(client.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset notes when dialog opens with new client
  useEffect(() => {
    if (open) {
      setNotes(client.notes || '');
      setError(null);
    }
  }, [open, client.notes]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('clients')
        .update({ notes })
        .eq('id', client.id);

      if (updateError) {
        throw updateError;
      }

      // Update the client with new notes
      onClientUpdate({ ...client, notes });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down important themes, insights, patterns..."
            className="min-h-[300px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Tip: Use **bold**, *italic*, - lists, or # headers for formatting
          </p>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 