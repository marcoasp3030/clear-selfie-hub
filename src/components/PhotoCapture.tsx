import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Upload, X } from "lucide-react";

interface PhotoCaptureProps {
  value: File | null;
  onChange: (file: File | null) => void;
}

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      setStream(s);
      setCameraOn(true);
      // attach after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e) {
      setError("Não foi possível acessar a câmera. Verifique as permissões ou envie um arquivo.");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOn(false);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        onChange(file);
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 8MB.");
      return;
    }
    setError(null);
    onChange(file);
  };

  const reset = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40">
        {previewUrl ? (
          <img src={previewUrl} alt="Pré-visualização" className="h-full w-full object-cover" />
        ) : cameraOn ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover [transform:scaleX(-1)]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <Camera className="h-10 w-10 opacity-60" />
            <p className="text-sm">Tire uma foto ou envie do dispositivo</p>
          </div>
        )}

        {previewUrl && (
          <button
            type="button"
            onClick={reset}
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow-md transition hover:bg-background"
            aria-label="Remover foto"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {previewUrl ? (
          <Button type="button" variant="outline" onClick={reset} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" /> Tirar outra
          </Button>
        ) : cameraOn ? (
          <>
            <Button type="button" onClick={capture} className="flex-1">
              <Camera className="mr-2 h-4 w-4" /> Capturar
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={startCamera} className="flex-1">
              <Camera className="mr-2 h-4 w-4" /> Abrir câmera
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" /> Enviar arquivo
            </Button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
