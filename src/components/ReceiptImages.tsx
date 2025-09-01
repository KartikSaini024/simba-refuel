import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, Camera, ImagePlus } from 'lucide-react';

interface ReceiptImagesProps {
  images: string[];
  onAddImages: (images: string[]) => void;
  onRemoveImage: (index: number) => void;
}

export const ReceiptImages = ({ images, onAddImages, onRemoveImage }: ReceiptImagesProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const readers: Promise<string>[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      readers.push(new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));
    });

    try {
      const dataUrls = await Promise.all(readers);
      onAddImages(dataUrls);
    } catch {
      // ignore
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      setIsCapturing(true);
    } catch {
      // ignore
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setIsCapturing(false);
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const scale = 1;
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onAddImages([dataUrl]);
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <ImagePlus className="h-5 w-5" />
          Receipt Images (Session Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />
          <Button size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Camera className="h-4 w-4" />
            Add Receipts
          </Button>
          {!isCapturing ? (
            <Button size="sm" variant="secondary" className="gap-2" onClick={startCamera}>
              <Camera className="h-4 w-4" />
              Open Camera
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" className="gap-2" onClick={captureFrame}>
                Capture
              </Button>
              <Button size="sm" variant="ghost" onClick={stopCamera}>
                Close
              </Button>
            </div>
          )}
          <Label className="text-xs text-muted-foreground self-center">
            You can upload or take photos. Images clear on reset or page reload.
          </Label>
        </div>

        {isCapturing && (
          <div className="rounded border overflow-hidden bg-black">
            <video ref={videoRef} className="w-full max-h-64" playsInline muted />
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((src, idx) => (
              <div key={idx} className="relative rounded border overflow-hidden bg-card">
                <img src={src} alt={`Receipt ${idx + 1}`} className="w-full h-32 object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => onRemoveImage(idx)}
                  aria-label="Remove image"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


