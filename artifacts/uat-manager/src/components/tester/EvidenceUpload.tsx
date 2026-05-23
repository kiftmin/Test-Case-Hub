import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Check, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface LocalPreview {
  id: string;
  file: File;
  objectUrl: string;
  failed: boolean;
}

export function EvidenceUpload({ entityId, entityType, attachments = [], onUpdate, camera }: EvidenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([]);
  const createAttachment = useCreateAttachment();
  const deleteAttachment = useDeleteAttachment();

  const uploadFile = async (file: File, previewId: string) => {
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
      setLocalPreviews((prev) => prev.filter((p) => p.id !== previewId));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      if (onUpdate) onUpdate();
    } catch (err) {
      setLocalPreviews((prev) =>
        prev.map((p) => (p.id === previewId ? { ...p, failed: true } : p))
      );
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewId = crypto.randomUUID();
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviews((prev) => [...prev, { id: previewId, file, objectUrl, failed: false }]);
    await uploadFile(file, previewId);
    URL.revokeObjectURL(objectUrl);
    e.target.value = "";
  };

  const handleDelete = async (id: number) => {
    await deleteAttachment.mutateAsync({ attachmentId: id });
    if (onUpdate) onUpdate();
  };

  const fileInputId = `file-upload-${entityId}`;
  const cameraInputId = `camera-upload-${entityId}`;

  const allPreviews = [
    ...attachments.map((f: any) => ({ id: `att-${f.id}`, type: "server" as const, file: f })),
    ...localPreviews.map((p) => ({ id: p.id, type: "local" as const, preview: p })),
  ];

  return (
    <div className="space-y-3">
      {allPreviews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {allPreviews.map((item) => {
            if (item.type === "server") {
              const file = item.file;
              return (
                <div key={item.id} className="group relative">
                  {file.fileType?.startsWith("image/") ? (
                    <div className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted">
                      <img src={resolveUploadUrl(file.fileUrl)} alt={file.fileName} className="w-full h-full object-cover" />
                      <button onClick={() => handleDelete(file.id)} className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border text-xs font-medium">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <a href={resolveUploadUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[120px]">{file.fileName}</a>
                      <button onClick={() => handleDelete(file.id)} className="ml-auto p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            const preview = item.preview;
            return (
              <div key={item.id} className="group relative">
                <div className={cn("relative aspect-square rounded-md overflow-hidden border", preview.failed ? "border-destructive/50" : "border-border bg-muted")}>
                  {preview.file.type.startsWith("image/") ? (
                    <img src={preview.objectUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-xs px-2 text-center">
                      <Paperclip className="w-5 h-5 mb-1" />
                      <span className="truncate">{preview.file.name}</span>
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                  {preview.failed && (
                    <div className="absolute bottom-1 left-1 right-1 bg-destructive/80 text-destructive-foreground text-[10px] font-medium text-center py-0.5 rounded">
                      Upload failed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
