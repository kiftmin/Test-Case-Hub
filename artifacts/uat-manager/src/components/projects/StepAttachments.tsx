import { useState } from "react";
import { 
  useCreateAttachment, 
  useDeleteAttachment,
  Attachment,
  getListTestStepsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Paperclip, Trash2, FileIcon, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepAttachmentsProps {
  stepId: number;
  testCaseId: number;
  attachments: Attachment[];
}

export function StepAttachments({ stepId, testCaseId, attachments }: StepAttachmentsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const createAttachment = useCreateAttachment();
  const deleteAttachment = useDeleteAttachment();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File selected:", e.target.files?.[0]);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Upload to server
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const uploadData = await response.json();

      // 2. Create attachment record
      await createAttachment.mutateAsync({
        data: {
          entityType: "step",
          entityId: stepId,
          field: "reference",
          fileName: uploadData.originalName,
          fileUrl: uploadData.url,
          fileType: uploadData.mimetype,
        }
      });

      toast({ title: "Success", description: "File attached successfully" });
      await queryClient.invalidateQueries({ queryKey: getListTestStepsQueryKey(testCaseId) });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to upload file" });
    } finally {
      setIsUploading(false);
      // Clear input
      e.target.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAttachment.mutateAsync({ attachmentId: id });
      toast({ title: "Success", description: "Attachment removed" });
      await queryClient.invalidateQueries({ queryKey: getListTestStepsQueryKey(testCaseId) });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete attachment" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-foreground">
          <Paperclip className="w-4 h-4" />
          {attachments.length > 0 && <span className="text-xs">{attachments.length}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Step Attachments</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Files</h4>
            <div className="relative">
              <input 
                type="file" 
                className="hidden" 
                id={`file-upload-${stepId}`}
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label 
                htmlFor={`file-upload-${stepId}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary/90 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Upload Reference
              </label>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {attachments.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                No attachments yet.
              </div>
            ) : (
              attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30 group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <a 
                      href={file.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm truncate hover:underline text-foreground"
                    >
                      {file.fileName}
                    </a>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(file.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Minimal Input component since we don't want to import everything
function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
