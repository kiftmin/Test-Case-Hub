import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Image as ImageIcon } from "lucide-react";
import { useCreateAttachment, useDeleteAttachment } from "@workspace/api-client-react";

interface EvidenceUploadProps {
  entityId: number;
  entityType: "step_result" | "test_step";
  attachments?: any[];
  onUpdate?: () => void;
}

export function EvidenceUpload({ entityId, entityType, attachments = [], onUpdate }: EvidenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const createAttachment = useCreateAttachment();
  const deleteAttachment = useDeleteAttachment();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const fileData = await res.json();
        await createAttachment.mutateAsync({
          data: {
            entityId,
            entityType,
            field: "evidence",
            fileName: fileData.originalName,
            fileUrl: fileData.url,
            fileType: fileData.mimetype,
          }
        });
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteAttachment.mutateAsync({ attachmentId: id });
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file) => (
            <div 
              key={file.id} 
              className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border text-xs font-medium pr-8"
            >
              {file.fileType.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
              <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[150px]">
                {file.fileName}
              </a>
              <button 
                onClick={() => handleDelete(file.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="file"
          id={`file-upload-${entityId}`}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-[11px] font-bold uppercase tracking-wider"
          disabled={isUploading}
          asChild
        >
          <label htmlFor={`file-upload-${entityId}`} className="cursor-pointer">
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Paperclip className="w-3.5 h-3.5 mr-2" />
            )}
            {isUploading ? "Uploading..." : "Attach Evidence"}
          </label>
        </Button>
      </div>
    </div>
  );
}
