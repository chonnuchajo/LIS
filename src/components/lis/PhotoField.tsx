import { useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadQcPhoto, deleteQcPhoto, type ParameterValueField } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface PhotoFieldProps {
  field: ParameterValueField;
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function PhotoField({ field, value, onChange, disabled = false }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const maxPhotos = field.maxPhotos ?? 5;
  const canAdd = !disabled && value.length < maxPhotos;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    try {
      const { url } = await uploadQcPhoto(file);
      onChange([...value, url]);
    } catch (err: any) {
      toast.error(err.message || 'อัปโหลดล้มเหลว');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(url: string) {
    if (deletingUrl) return;
    setDeletingUrl(url);
    try {
      await deleteQcPhoto(url);
      onChange(value.filter((u) => u !== url));
    } catch (err: any) {
      toast.error(err.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeletingUrl(null);
    }
  }

  return (
    <div className="space-y-2">
      {/* Thumbnail grid */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="relative group">
              <button
                type="button"
                onClick={() => setLightbox(url)}
                className="block w-20 h-20 rounded-md overflow-hidden border border-grey-200 bg-grey-50 hover:border-pink-300 transition-colors"
              >
                <img
                  src={url}
                  alt="QC photo"
                  className="w-full h-full object-cover"
                />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  disabled={deletingUrl === url}
                  className={cn(
                    'absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5',
                    'flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
                    'hover:bg-red-600',
                    deletingUrl === url && 'opacity-50 cursor-not-allowed',
                  )}
                  title="ลบภาพ"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-dashed',
            'border-pink-300 text-pink-600 bg-pink-50 hover:bg-pink-100 transition-colors',
            uploading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {uploading ? 'กำลังอัปโหลด...' : 'เพิ่มภาพ'}
          {!uploading && (
            <span className="text-pink-400 text-xs">
              ({value.length}/{maxPhotos})
            </span>
          )}
        </button>
      )}

      {/* Count display when at max */}
      {!canAdd && !disabled && (
        <p className="text-xs text-grey-400">ครบ {maxPhotos} ภาพแล้ว</p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="sm:max-w-3xl p-2 bg-black/90 border-0">
          {lightbox && (
            <>
              <DialogTitle className="sr-only">ภาพ QC</DialogTitle>
              <img
                src={lightbox}
                alt="QC photo full"
                className="w-full max-h-[80vh] object-contain rounded"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
