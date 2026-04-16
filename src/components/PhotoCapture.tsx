import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, X, Loader2 } from "lucide-react";
import { getFaceDetector } from "@/lib/faceDetector";

interface PhotoCaptureProps {
  value: File | null;
  onChange: (file: File | null) => void;
}

type DetectionStatus =
  | "loading"
  | "searching"
  | "multiple"
  | "too_small"
  | "too_big"
  | "off_center"
  | "perfect";

const STATUS_MESSAGES: Record<DetectionStatus, string> = {
  loading: "Carregando detector...",
  searching: "Procurando seu rosto...",
  multiple: "Apenas uma pessoa por foto",
  too_small: "Aproxime-se um pouco",
  too_big: "Afaste-se um pouco",
  off_center: "Centralize seu rosto no oval",
  perfect: "Perfeito! Pode capturar",
};

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
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

  useEffect(() => {
    if (cameraOn) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [cameraOn]);

  const startCamera = async () => {
    setError(null);
    setStarting(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      setStream(s);
      setCameraOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e) {
      setError(
        "Não foi possível acessar a câmera. Verifique as permissões nas configurações do navegador.",
      );
    } finally {
      setStarting(false);
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

  const reset = () => {
    onChange(null);
    setError(null);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Pré-visualização"
              className="h-full w-full object-cover"
            />
          ) : (
            <button
              type="button"
              onClick={startCamera}
              disabled={starting}
              className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground transition hover:bg-muted/60 active:bg-muted"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                {starting ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <Camera className="h-7 w-7" />
                )}
              </div>
              <div>
                <p className="text-base font-medium text-foreground">
                  {starting ? "Abrindo câmera..." : "Toque para abrir a câmera"}
                </p>
                <p className="mt-1 text-xs">Tire uma foto do seu rosto agora</p>
              </div>
            </button>
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

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {previewUrl && (
          <Button type="button" variant="outline" onClick={startCamera} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" /> Tirar outra foto
          </Button>
        )}
      </div>

      {cameraOn && (
        <CameraFullscreen
          videoRef={videoRef}
          onCancel={stopCamera}
          onCapture={capture}
        />
      )}
    </>
  );
}

interface CameraFullscreenProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCancel: () => void;
  onCapture: () => void;
}

// Oval target in normalized coords (0-1) of the video frame.
// Matches the visual oval: roughly centered, ~56% width / 72% height of square area.
const TARGET = {
  cx: 0.5,
  cy: 0.48,
  rx: 0.28,
  ry: 0.36,
};

function CameraFullscreen({ videoRef, onCancel, onCapture }: CameraFullscreenProps) {
  const [status, setStatus] = useState<DetectionStatus>("loading");
  const statusRef = useRef<DetectionStatus>("loading");
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(-1);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    let detector: Awaited<ReturnType<typeof getFaceDetector>> | null = null;

    const tick = () => {
      const video = videoRef.current;
      if (cancelled) return;
      if (!detector || !video || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ts = performance.now();
      if (ts === lastTimestampRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTimestampRef.current = ts;

      try {
        const result = detector.detectForVideo(video, ts);
        const detections = result.detections ?? [];

        let next: DetectionStatus = "searching";
        if (detections.length > 1) {
          next = "multiple";
        } else if (detections.length === 1) {
          const box = detections[0].boundingBox;
          if (box) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            // Use the shortest side to derive the on-screen square area
            const side = Math.min(vw, vh);
            const offsetX = (vw - side) / 2;
            const offsetY = (vh - side) / 2;

            // Face center in video pixel coords
            const fcx = box.originX + box.width / 2;
            const fcy = box.originY + box.height / 2;
            // Normalize relative to the visible square area
            const ncx = (fcx - offsetX) / side;
            const ncy = (fcy - offsetY) / side;
            const faceWidthRatio = box.width / side;

            const dx = (ncx - TARGET.cx) / TARGET.rx;
            const dy = (ncy - TARGET.cy) / TARGET.ry;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const idealWidth = TARGET.rx * 2 * 0.95;
            const minWidth = idealWidth * 0.7;
            const maxWidth = idealWidth * 1.35;

            if (faceWidthRatio < minWidth) next = "too_small";
            else if (faceWidthRatio > maxWidth) next = "too_big";
            else if (distance > 0.55) next = "off_center";
            else next = "perfect";
          }
        }

        if (next !== statusRef.current) setStatus(next);
      } catch {
        // ignore single-frame errors
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    getFaceDetector()
      .then((d) => {
        if (cancelled) return;
        detector = d;
        setStatus("searching");
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (cancelled) return;
        // If detector fails, allow capture anyway
        setStatus("perfect");
      });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  const isPerfect = status === "perfect";
  const ovalColorClass = isPerfect
    ? "border-primary shadow-[0_0_0_2px_rgba(0,0,0,0.25),0_0_24px_4px_rgba(146,182,27,0.55)]"
    : status === "loading" || status === "searching"
      ? "border-white/70"
      : "border-destructive shadow-[0_0_0_2px_rgba(0,0,0,0.25),0_0_24px_4px_rgba(220,60,60,0.45)]";

  const hintBg = isPerfect
    ? "bg-primary text-primary-foreground"
    : status === "loading" || status === "searching"
      ? "bg-black/60 text-white"
      : "bg-destructive text-destructive-foreground";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 pb-6 pt-[env(safe-area-inset-top,1rem)]">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          aria-label="Fechar câmera"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-sm font-medium text-white">Centralize seu rosto</p>
        <div className="h-10 w-10" />
      </div>

      {/* Video + oval guide */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]"
        />

        {/* Dark overlay with oval cutout */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <mask id="face-mask">
              <rect width="100" height="100" fill="white" />
              <ellipse cx="50" cy="48" rx="28" ry="36" fill="black" />
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.55)" mask="url(#face-mask)" />
        </svg>

        {/* Animated oval border (color reflects detection) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`rounded-[50%] border-[3px] transition-all duration-200 ${ovalColorClass} ${
              isPerfect ? "" : "animate-pulse"
            }`}
            style={{ width: "56vw", maxWidth: "320px", aspectRatio: "0.78 / 1" }}
          />
        </div>

        {/* Hint */}
        <div
          className={`absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-center text-xs font-medium backdrop-blur transition-colors ${hintBg}`}
        >
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {STATUS_MESSAGES[status]}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center bg-gradient-to-t from-black/85 to-transparent px-4 pb-[max(env(safe-area-inset-bottom,1.5rem),1.5rem)] pt-8">
        <button
          type="button"
          onClick={onCapture}
          disabled={!isPerfect}
          className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur transition active:scale-95 disabled:opacity-40"
          aria-label="Capturar foto"
        >
          <span
            className={`absolute inset-1 rounded-full border-[3px] transition-colors ${
              isPerfect ? "border-primary" : "border-white"
            }`}
          />
          <span
            className={`block h-14 w-14 rounded-full transition ${
              isPerfect ? "bg-primary group-active:bg-primary/80" : "bg-white group-active:bg-white/80"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
