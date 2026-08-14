import { useRef, useState } from "react";
import { ImageIcon, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteQcPhoto, uploadQcPhoto } from "@/lib/api";

interface StockPhotoUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  maxPhotos?: number;
  disabled?: boolean;
}

export default function StockPhotoUploader({
  value,
  onChange,
  label = "รูปขวด (ไม่บังคับ)",
  maxPhotos = 5,
  disabled = false,
}: StockPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const canAdd = !disabled && !uploading && value.length < maxPhotos;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    const selected = Array.from(files).slice(0, Math.max(0, maxPhotos - value.length));
    if (selected.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const { url } = await uploadQcPhoto(file);
        uploaded.push(url);
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePhoto = async (url: string) => {
    if (disabled || deletingUrl) return;
    setDeletingUrl(url);
    try {
      await deleteQcPhoto(url);
      onChange(value.filter((item) => item !== url));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          {label}
        </div>
        {canAdd && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => inputRef.current?.click()}>
            <Plus className="mr-1 h-3.5 w-3.5" /> เพิ่มรูป
          </Button>
        )}
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
              <img src={url} alt="รูปขวด stock" className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  disabled={deletingUrl === url}
                  className={cn(
                    "absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100",
                    deletingUrl === url && "cursor-not-allowed opacity-60",
                  )}
                  aria-label="ลบรูป"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">ไม่จำเป็นต้องถ่ายรูป ถ้ามีรูปให้กดเพิ่มรูป</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
