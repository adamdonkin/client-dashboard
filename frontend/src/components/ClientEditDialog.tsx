import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Client } from "./types";

interface ClientEditDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdate: (client: Client) => void;
}

export function ClientEditDialog({ client, open, onOpenChange, onClientUpdate }: ClientEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p className="text-gray-600">Client editing form coming soon...</p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 