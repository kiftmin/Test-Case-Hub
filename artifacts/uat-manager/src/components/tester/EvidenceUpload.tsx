import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Image as ImageIcon, Check, Camera } from "lucide-react";
import { useCreateAttachment, useDeleteAttachment } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/auth";
import { resolveUploadUrl } from "@/lib/upload-url";
import { toast } from "sonner";

interface EvidenceUploadProps {
  entityId: number;
  entityType: "step_result" | "test_step";
  attachments?: any[];
  onUpdate?: () => void;
  camera?: boolean;
}

export function EvidenceUpload({ entityId, entityType, attachments = [], onUpdate, camera }: EvidenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const createAttachment = useCreateAttachment();
  const deleteAttachment = useDeleteAttachment();

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setSuccess(false);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error ?? "Upload failed");
      }
      const fileData = await res.json();
      await createAttachment.mutateAsync({
        data: {
          entityId,
          entityType,
          field: "evidence",
          fileName: fileData.originalName,
          fileUrl: fileData.url,
          fileType: fileData.mimetype,
        },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  };

  const handleDelete = async (id: number) => {
    await deleteAttachment.mutateAsync({ attachmentId: id });
    if (onUpdate) onUpdate();
  };

  const fileInputId = `file-upload-${entityId}`;
  const cameraInputId = `camera-upload-${entityId}`;

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((file) => (
            <div key={file.id} className="group relative">
              {file.fileType?.startsWith("image/") ? (
                <div className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted">
                  <img
                    src={resolveUploadUrl(file.fileUrl)}
                    alt={file.fileName}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border text-xs font-medium">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <a href={resolveUploadUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[120px]">
                    {file.fileName}
                  </a>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="ml-auto p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="file"
          id={fileInputId}
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
          <label htmlFor={fileInputId} className="cursor-pointer">
            {success ? (
              <>
                <Check className="w-3.5 h-3.5 mr-2 text-green-600" />
                Uploaded!
              </>
            ) : isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Paperclip className="w-3.5 h-3.5 mr-2" />
                Attach
              </>
            )}
          </label>
        </Button>

        {camera && (
          <>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id={cameraInputId}
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
              <label htmlFor={cameraInputId} className="cursor-pointer">
                <Camera className="w-3.5 h-3.5 mr-2" />
                Photo
              </label>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
