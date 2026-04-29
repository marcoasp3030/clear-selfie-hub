import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  RefreshCw,
  X,
  Loader2,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Users,
  EyeOff,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { getFaceLandmarker, KEY_LANDMARKS } from "@/lib/faceDetector";

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
  | "move_up"
  | "move_down"
  | "move_left"
  | "move_right"
  | "covered"
  | "turned"
  | "look_down"
  | "look_up"
  | "tilted"
  | "eyes_closed"
  | "blurry"
  | "too_dark"
  | "too_bright"
  | "uneven_light"
  | "perfect";

const STATUS_COPY: Record<DetectionStatus, { msg: string; sub?: string }> = {
  loading: { msg: "Preparando a câmera...", sub: "Aguarde só um instante" },
  searching: { msg: "Procurando seu rosto", sub: "Olhe para a câmera" },
  multiple: { msg: "Apenas você na foto", sub: "Não pode ter outras pessoas" },
  too_small: { msg: "Aproxime-se", sub: "Chegue mais perto da câmera" },
  too_big: { msg: "Afaste-se", sub: "Distancie-se um pouco" },
  move_up: { msg: "Suba o celular", sub: "Coloque o rosto no oval" },
  move_down: { msg: "Abaixe o celular", sub: "Coloque o rosto no oval" },
  move_left: { msg: "Mova para a esquerda", sub: "Coloque o rosto no oval" },
  move_right: { msg: "Mova para a direita", sub: "Coloque o rosto no oval" },
  covered: { msg: "Mostre o rosto inteiro", sub: "Tire as mãos ou objetos do rosto" },
  turned: { msg: "Olhe para a câmera", sub: "Vire o rosto para frente" },
  look_down: { msg: "Levante o queixo", sub: "Olhe direto para a câmera" },
  look_up: { msg: "Abaixe o queixo", sub: "Olhe direto para a câmera" },
  tilted: { msg: "Endireite a cabeça", sub: "Mantenha o rosto na vertical" },
  eyes_closed: { msg: "Mantenha os olhos abertos", sub: "Olhe para a câmera" },
  blurry: { msg: "Imagem sem nitidez", sub: "Segure firme e limpe a lente" },
  too_dark: { msg: "Ambiente muito escuro", sub: "Procure um local mais iluminado" },
  too_bright: { msg: "Luz muito forte", sub: "Evite contraluz e luz direta no rosto" },
  uneven_light: { msg: "Iluminação irregular", sub: "Posicione-se em luz uniforme" },
  perfect: { msg: "Perfeito!", sub: "Mantenha-se assim" },
};

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<
    "denied" | "not_found" | "in_use" | "unsupported" | "generic" | null
  >(null);

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
    setErrorKind(null);
    setStarting(true);
    setPendingFile(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Seu navegador não suporta acesso à câmera. Use o Safari (iPhone) ou Chrome (Android) atualizado.",
      );
      setErrorKind("unsupported");
      setStarting(false);
      return;
    }

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
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          // iOS Safari requires these attributes set BEFORE play()
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");
          v.muted = true;
          v.play().catch(() => {
            // Some iOS versions need a tiny delay
            setTimeout(() => v.play().catch(() => {}), 100);
          });
        }
      }, 50);
    } catch (err) {
      const e = err as DOMException;
      let msg =
        "Não foi possível acessar a câmera. Verifique as permissões nas configurações do navegador.";
      let kind: "denied" | "not_found" | "in_use" | "generic" = "generic";
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        msg =
          "Permissão da câmera negada. Toque no ícone de cadeado/câmera na barra de endereço para permitir o acesso.";
        kind = "denied";
      } else if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
        msg = "Nenhuma câmera encontrada no dispositivo.";
        kind = "not_found";
      } else if (e?.name === "NotReadableError") {
        msg = "A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.";
        kind = "in_use";
      }
      setError(msg);
      setErrorKind(kind);
    } finally {
      setStarting(false);
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOn(false);
  };

  const handleCapture = (file: File) => {
    setPendingFile(file);
    // Keep camera open in background but show review overlay
  };

  const acceptPhoto = () => {
    if (pendingFile) {
      onChange(pendingFile);
      setPendingFile(null);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setPendingFile(null);
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
            <img src={previewUrl} alt="Pré-visualização" className="h-full w-full object-cover" />
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
                <p className="mt-1 text-xs">A foto será tirada automaticamente</p>
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
          <CameraPermissionHelp
            kind={errorKind}
            message={error}
            onRetry={startCamera}
            retrying={starting}
          />
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
          pendingFile={pendingFile}
          onCapture={handleCapture}
          onAccept={acceptPhoto}
          onRetake={retakePhoto}
          onCancel={stopCamera}
        />
      )}
    </>
  );
}

interface CameraFullscreenProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  pendingFile: File | null;
  onCapture: (file: File) => void;
  onAccept: () => void;
  onRetake: () => void;
  onCancel: () => void;
}

const TARGET = { cx: 0.5, cy: 0.52, rx: 0.3, ry: 0.4 };

function CameraFullscreen({
  videoRef,
  pendingFile,
  onCapture,
  onAccept,
  onRetake,
  onCancel,
}: CameraFullscreenProps) {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [status, setStatus] = useState<DetectionStatus>("loading");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Quality bars — UI state, throttled updates from the detection loop
  const [qualityUI, setQualityUI] = useState<{
    sharpness: number;
    brightness: number;
    lightUneven: number;
  } | null>(null);
  // Distance gauge — face width vs ideal (1.0 = perfect)
  // <0.7 too far, >1.25 too close
  const [distanceRatioUI, setDistanceRatioUI] = useState<number | null>(null);
  const lastDistanceUITsRef = useRef(0);

  const statusRef = useRef<DetectionStatus>("loading");
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(-1);
  const perfectSinceRef = useRef<number | null>(null);
  const countdownStartedRef = useRef(false);
  const captureTakenRef = useRef(false);
  const detectingRef = useRef(false);
  // Stability buffers — avoid rapid green/red flicker.
  // We track recent raw detections and only commit a status change
  // once the candidate has been stable for a short window.
  const candidateRef = useRef<{ status: DetectionStatus; since: number } | null>(null);
  const blinkHistoryRef = useRef<number[]>([]); // recent blink scores (max eye)
  const eyesClosedConfirmedRef = useRef(false);
  // Image quality (sharpness + lighting) sampled at low frequency
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastQualityTsRef = useRef(0);
  const qualityRef = useRef<{
    sharpness: number; // higher = sharper (Sobel mean magnitude)
    brightness: number; // 0..255 mean luma over face region
    lightUneven: number; // 0..1, |left_mean - right_mean| / 255
  } | null>(null);
  // Smoothed geometry (EMA) to absorb landmark jitter
  const smoothRef = useRef<{
    faceWidthRatio: number;
    distance: number;
    yawDeg: number;
    pitchDeg: number;
    rollDeg: number;
  } | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Keep detection running during countdown so we can abort if the face
  // leaves the frame. Only pause for onboarding/preview screens.
  useEffect(() => {
    detectingRef.current = !showOnboarding && !pendingFile;
  }, [showOnboarding, pendingFile]);

  // Build preview URL for pending file
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  // iOS Safari: replay video when tab regains focus or video gets paused
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const replay = () => {
      if (v.paused && v.srcObject) {
        v.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", replay);
    v.addEventListener("pause", replay);
    return () => {
      document.removeEventListener("visibilitychange", replay);
      v.removeEventListener("pause", replay);
    };
  }, [videoRef]);

  // Capture function reads current frame.
  // We mirror the saved image to match what the user saw on screen
  // (the video is displayed mirrored like a selfie/mirror).
  const doCapture = () => {
    if (captureTakenRef.current) return;
    captureTakenRef.current = true;
    countdownStartedRef.current = false;
    perfectSinceRef.current = null;
    const video = videoRef.current;
    if (!video) {
      captureTakenRef.current = false;
      return;
    }
    const canvas = document.createElement("canvas");
    const rawSize = Math.min(video.videoWidth, video.videoHeight);
    // Engine spec: min 160x160, max area 1920*1080 = 2_073_600 px.
    // Square output: clamp side between 480 (safety margin) and 1080.
    const size = Math.max(480, Math.min(1080, rawSize));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      captureTakenRef.current = false;
      return;
    }
    const sx = (video.videoWidth - rawSize) / 2;
    const sy = (video.videoHeight - rawSize) / 2;
    // Mirror horizontally so output matches the on-screen preview
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, rawSize, rawSize, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          captureTakenRef.current = false;
          return;
        }
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        // Flash + vibration feedback
        setFlash(true);
        setTimeout(() => setFlash(false), 220);
        if ("vibrate" in navigator) {
          try {
            navigator.vibrate(80);
          } catch {
            /* noop */
          }
        }
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  // Countdown effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      // Final safety check: only capture if the face is still perfectly framed.
      if (statusRef.current === "perfect") {
        doCapture();
      }
      setCountdown(null);
      countdownStartedRef.current = false;
      perfectSinceRef.current = null;
      return;
    }
    // light vibration tick
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        /* noop */
      }
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Detection loop
  useEffect(() => {
    let cancelled = false;
    let detector: Awaited<ReturnType<typeof getFaceLandmarker>> | null = null;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Pause detection while onboarding/countdown/preview shown
      if (!detectingRef.current) {
        perfectSinceRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ts = performance.now();
      if (ts === lastTsRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTsRef.current = ts;

      try {
        const result = detector.detectForVideo(video, ts);
        const faces = result.faceLandmarks ?? [];
        const blendshapes = result.faceBlendshapes ?? [];
        const matrices = result.facialTransformationMatrixes ?? [];

        let next: DetectionStatus = "searching";

        if (faces.length > 1) {
          next = "multiple";
        } else if (faces.length === 1) {
          const landmarks = faces[0];
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const side = Math.min(vw, vh);
          const offsetX = (vw - side) / 2;
          const offsetY = (vh - side) / 2;

          // Compute face bounding box from face oval landmarks
          let minX = 1,
            maxX = 0,
            minY = 1,
            maxY = 0;
          for (const i of KEY_LANDMARKS.faceOval) {
            const p = landmarks[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          // Normalized landmarks are in 0-1 of full video frame
          const faceW = (maxX - minX) * vw;
          const faceH = (maxY - minY) * vh;
          const fcx = ((minX + maxX) / 2) * vw;
          const fcy = ((minY + maxY) / 2) * vh;

          const ncx = (fcx - offsetX) / side;
          const ncy = (fcy - offsetY) / side;
          const faceWidthRatio = faceW / side;

          // Mirror X because video is displayed mirrored
          const dxScreen = (TARGET.cx - ncx) / TARGET.rx;
          const dyNorm = (ncy - TARGET.cy) / TARGET.ry;
          const distance = Math.sqrt(dxScreen * dxScreen + dyNorm * dyNorm);

          const idealWidth = TARGET.rx * 2 * 0.95;
          // Tighter so face occupies a healthy share of the frame
          // (engine recommends face well-centered with margins).
          const minWidth = idealWidth * 0.7;
          const maxWidth = idealWidth * 1.25;

          // ---- Anti-fraud / quality checks ----
          // 1. Head pose from transformation matrix (column-major 4x4)
          //    Extract yaw/pitch/roll from rotation part.
          let yawDeg = 0,
            pitchDeg = 0,
            rollDeg = 0;
          if (matrices[0]) {
            const m = matrices[0].data;
            // Standard rotation extraction (Y-X-Z order)
            // m[0..2]=col0, m[4..6]=col1, m[8..10]=col2
            const r00 = m[0],
              r10 = m[1],
              r20 = m[2];
            const r21 = m[6];
            const r22 = m[10];
            yawDeg = Math.atan2(-r20, Math.sqrt(r21 * r21 + r22 * r22)) * (180 / Math.PI);
            pitchDeg = Math.atan2(r21, r22) * (180 / Math.PI);
            rollDeg = Math.atan2(r10, r00) * (180 / Math.PI);
          }

          // 2. Occlusion check: count face landmarks far from face center.
          //    If many key landmarks (eyes/nose/mouth/cheeks) collapse together,
          //    a hand or object is likely covering them.
          //    More robust: compare face-oval area vs eye-to-mouth area ratio.
          const lEye = avgPoint(landmarks, KEY_LANDMARKS.leftEye);
          const rEye = avgPoint(landmarks, KEY_LANDMARKS.rightEye);
          const noseTip = landmarks[KEY_LANDMARKS.nose[0]];
          const mouthCenter = avgPoint(landmarks, KEY_LANDMARKS.mouth);
          const lCheek = avgPoint(landmarks, KEY_LANDMARKS.leftCheek);
          const rCheek = avgPoint(landmarks, KEY_LANDMARKS.rightCheek);

          // Distances normalized by face width
          const eyeDist = dist(lEye, rEye) / (maxX - minX);
          const eyeToMouth = dist(midPoint(lEye, rEye), mouthCenter) / (maxY - minY);
          const cheekDist = dist(lCheek, rCheek) / (maxX - minX);

          // Healthy frontal face: eyeDist ~0.35-0.5, eyeToMouth ~0.4-0.6, cheekDist ~0.55-0.8
          const occluded =
            eyeDist < 0.22 ||
            eyeToMouth < 0.25 ||
            cheekDist < 0.4 ||
            // sanity: nose tip should be roughly between eyes vertically
            noseTip.y < Math.min(lEye.y, rEye.y) - 0.05 ||
            noseTip.y > mouthCenter.y + 0.05;

          // 3. Eyes closed via blendshapes — needs SUSTAINED closure.
          //    A blink lasts ~100-300ms; we require the closed signal to
          //    persist across recent frames (~500ms window) before we
          //    flag the user as having eyes closed. This filters out
          //    natural blinks and reflex glints that briefly spike scores.
          let eyesClosed = eyesClosedConfirmedRef.current;
          if (blendshapes[0]) {
            const cats = blendshapes[0].categories;
            const blinkL = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
            const blinkR = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
            // Use the MAX so a wink doesn't trigger; both eyes must close.
            const minBlink = Math.min(blinkL, blinkR);
            const hist = blinkHistoryRef.current;
            hist.push(minBlink);
            // Keep ~15 samples (~500ms at 30fps)
            if (hist.length > 15) hist.shift();
            // Confirm "closed" only if MAJORITY of recent frames are above threshold
            const closedFrames = hist.filter((s) => s > 0.55).length;
            const ratio = hist.length > 0 ? closedFrames / hist.length : 0;
            if (ratio >= 0.7 && hist.length >= 8) {
              eyesClosed = true;
              eyesClosedConfirmedRef.current = true;
            } else if (ratio <= 0.2) {
              eyesClosed = false;
              eyesClosedConfirmedRef.current = false;
            }
          }

          // ---- Smooth geometry with EMA to reduce jitter ----
          const alpha = 0.35; // higher = more responsive, lower = smoother
          const prev = smoothRef.current;
          if (!prev) {
            smoothRef.current = {
              faceWidthRatio,
              distance,
              yawDeg,
              pitchDeg,
              rollDeg,
            };
          } else {
            prev.faceWidthRatio = prev.faceWidthRatio * (1 - alpha) + faceWidthRatio * alpha;
            prev.distance = prev.distance * (1 - alpha) + distance * alpha;
            prev.yawDeg = prev.yawDeg * (1 - alpha) + yawDeg * alpha;
            prev.pitchDeg = prev.pitchDeg * (1 - alpha) + pitchDeg * alpha;
            prev.rollDeg = prev.rollDeg * (1 - alpha) + rollDeg * alpha;
          }
          const sm = smoothRef.current!;

          // Push distance ratio to UI (throttled ~6fps)
          if (ts - lastDistanceUITsRef.current > 160) {
            lastDistanceUITsRef.current = ts;
            setDistanceRatioUI(sm.faceWidthRatio / idealWidth);
          }

          // ---- Sample image quality every ~250ms over the face bbox ----
          if (ts - lastQualityTsRef.current > 250) {
            lastQualityTsRef.current = ts;
            try {
              const q = analyzeFaceQuality(video, minX, minY, maxX, maxY, qualityCanvasRef);
              if (q) {
                qualityRef.current = q;
                setQualityUI(q);
              }
            } catch {
              /* noop */
            }
          }
          const q = qualityRef.current;

          // ---- Status priority ----
          if (sm.faceWidthRatio < minWidth) next = "too_small";
          else if (sm.faceWidthRatio > maxWidth) next = "too_big";
          else if (sm.distance > 0.4) {
            if (Math.abs(dyNorm) > Math.abs(dxScreen)) {
              next = dyNorm > 0 ? "move_up" : "move_down";
            } else {
              next = dxScreen > 0 ? "move_right" : "move_left";
            }
          } else if (occluded) {
            next = "covered";
          } else if (Math.abs(sm.yawDeg) > 12 || Math.abs(sm.pitchDeg) > 12) {
            next = "turned";
          } else if (Math.abs(sm.rollDeg) > 10) {
            next = "tilted";
          } else if (eyesClosed) {
            next = "eyes_closed";
          } else if (q && q.brightness < 55) {
            next = "too_dark";
          } else if (q && q.brightness > 220) {
            next = "too_bright";
          } else if (q && q.lightUneven > 0.28) {
            next = "uneven_light";
          } else if (q && q.sharpness < 6) {
            next = "blurry";
          } else {
            next = "perfect";
          }
        } else {
          // No face detected — clear smoothing/blink state
          smoothRef.current = null;
          blinkHistoryRef.current = [];
          eyesClosedConfirmedRef.current = false;
          qualityRef.current = null;
          if (qualityUI !== null) setQualityUI(null);
          if (distanceRatioUI !== null) setDistanceRatioUI(null);
        }

        // ---- Status hysteresis: require the candidate status to persist
        //      for a short window before committing it. This prevents
        //      the oval flicking red↔green between frames.
        //      Going INTO "perfect" requires longer confirmation than
        //      leaving it (we want to abort capture quickly if the user
        //      genuinely moves, but ignore single-frame glitches).
        const HOLD_TO_PERFECT_MS = 250;
        const HOLD_FROM_PERFECT_MS = 180;
        const HOLD_DEFAULT_MS = 150;

        const current = statusRef.current;
        let committed = current;
        if (next === current) {
          candidateRef.current = null;
        } else {
          if (!candidateRef.current || candidateRef.current.status !== next) {
            candidateRef.current = { status: next, since: ts };
          }
          const elapsed = ts - candidateRef.current.since;
          const required =
            next === "perfect"
              ? HOLD_TO_PERFECT_MS
              : current === "perfect"
                ? HOLD_FROM_PERFECT_MS
                : HOLD_DEFAULT_MS;
          // Critical errors (no face / multiple faces) commit immediately
          const immediate = next === "searching" || next === "multiple";
          if (immediate || elapsed >= required) {
            committed = next;
            candidateRef.current = null;
          }
        }

        if (committed !== statusRef.current) setStatus(committed);

        // Auto-capture: trigger countdown after staying "perfect" for ~700ms.
        // If the face stops being "perfect" at any moment (including during
        // the countdown), abort and require a fresh perfect hold.
        const now = performance.now();
        if (captureTakenRef.current) {
          perfectSinceRef.current = null;
          countdownStartedRef.current = false;
          setCountdown(null);
        } else if (committed === "perfect") {
          if (perfectSinceRef.current === null) perfectSinceRef.current = now;
          if (!countdownStartedRef.current && now - perfectSinceRef.current > 700) {
            countdownStartedRef.current = true;
            setCountdown(3);
          }
        } else {
          perfectSinceRef.current = null;
          if (countdownStartedRef.current) {
            countdownStartedRef.current = false;
            setCountdown(null);
          }
        }
      } catch {
        // ignore
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    getFaceLandmarker()
      .then((d) => {
        if (cancelled) return;
        detector = d;
        setStatus("searching");
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (cancelled) return;
        // Detector failed: allow manual capture mode
        setStatus("perfect");
      });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  const isPerfect = status === "perfect";
  const showReview = !!pendingFile && !!previewUrl;

  const handleRetake = () => {
    captureTakenRef.current = false;
    countdownStartedRef.current = false;
    perfectSinceRef.current = null;
    setCountdown(null);
    onRetake();
  };

  // 3-level severity:
  // - "neutral": loading / searching (white)
  // - "warning": minor adjust (yellow) — face detected but needs small fix
  // - "error": critical (red) — no face, multiple faces, way off
  // - "ok": perfect (green)
  const severity: "neutral" | "warning" | "error" | "ok" = showReview
    ? "ok"
    : isPerfect
      ? "ok"
      : status === "loading" || status === "searching"
        ? "neutral"
        : status === "multiple" || status === "too_small" || status === "too_big"
          ? "error"
          : "warning";

  const ovalColorClass =
    severity === "ok"
      ? "border-primary shadow-[0_0_0_2px_rgba(0,0,0,0.25),0_0_30px_6px_rgba(146,182,27,0.65)]"
      : severity === "warning"
        ? "border-warning shadow-[0_0_0_2px_rgba(0,0,0,0.25),0_0_24px_4px_rgba(230,180,40,0.55)]"
        : severity === "error"
          ? "border-destructive shadow-[0_0_0_2px_rgba(0,0,0,0.25),0_0_24px_4px_rgba(220,60,60,0.5)]"
          : "border-white/70";

  const directionIcon =
    status === "move_up"
      ? ArrowUp
      : status === "move_down"
        ? ArrowDown
        : status === "move_left"
          ? ArrowLeft
          : status === "move_right"
            ? ArrowRight
            : status === "too_small"
              ? ZoomIn
              : status === "too_big"
                ? ZoomOut
                : status === "multiple"
                  ? Users
                  : status === "covered"
                    ? AlertTriangle
                    : status === "turned" || status === "tilted"
                      ? AlertTriangle
                      : status === "eyes_closed"
                        ? EyeOff
                        : null;

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
        <p className="text-sm font-medium text-white">
          {showReview ? "Confira sua foto" : "Centralize seu rosto"}
        </p>
        <div className="h-10 w-10" />
      </div>

      {/* Video + guides */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          {...({ "webkit-playsinline": "true" } as Record<string, string>)}
          className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]"
        />

        {/* Pending preview overlay (image is already mirrored at capture time) */}
        {showReview && (
          <img
            src={previewUrl!}
            alt="Foto capturada"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Dark overlay with oval cutout */}
        {!showReview && (
          <FaceMaskOverlay />
        )}

        {/* Oval border */}
        {!showReview && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`relative rounded-[50%] border-[3px] transition-all duration-200 ${ovalColorClass} ${
                isPerfect || countdown !== null ? "" : "animate-pulse"
              }`}
              style={{ width: "60vw", maxWidth: "340px", aspectRatio: "0.75 / 1" }}
            >
              {/* Direction icon arrow inside oval */}
              {directionIcon &&
                countdown === null &&
                (() => {
                  const Icon = directionIcon;
                  const badgeClass =
                    severity === "warning"
                      ? "bg-warning/95 text-warning-foreground"
                      : "bg-destructive/90 text-destructive-foreground";
                  return (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-full ${badgeClass} shadow-lg animate-bounce`}
                      >
                        <Icon className="h-8 w-8" strokeWidth={3} />
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        )}

        {/* Countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              key={countdown}
              className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/95 text-primary-foreground shadow-[0_10px_40px_rgba(0,0,0,0.4)] [animation:scale-in_0.4s_ease-out]"
              style={{
                animation: "countdown-pop 1s ease-out",
              }}
            >
              <span className="text-7xl font-bold tabular-nums">{countdown}</span>
            </div>
          </div>
        )}

        {/* Status hint */}
        {!showReview && countdown === null && (
          <div className="absolute bottom-6 left-4 right-4 flex justify-center">
            <div
              className={`flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-xl backdrop-blur transition-colors ${
                severity === "ok"
                  ? "bg-primary text-primary-foreground"
                  : severity === "warning"
                    ? "bg-warning text-warning-foreground"
                    : severity === "error"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-black/70 text-white"
              }`}
            >
              {status === "loading" && <Loader2 className="h-5 w-5 shrink-0 animate-spin" />}
              {isPerfect && <Check className="h-5 w-5 shrink-0" strokeWidth={3} />}
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight">{STATUS_COPY[status].msg}</p>
                {STATUS_COPY[status].sub && (
                  <p className="text-xs opacity-90">{STATUS_COPY[status].sub}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Flash effect */}
        {flash && (
          <div
            className="pointer-events-none absolute inset-0 bg-white"
            style={{ opacity: 0.85 }}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-center gap-4 bg-gradient-to-t from-black/85 to-transparent px-4 pb-[max(env(safe-area-inset-bottom,1.5rem),1.5rem)] pt-8">
        {showReview ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="h-14 flex-1 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className="mr-2 h-5 w-5" /> Tirar outra
            </Button>
            <Button type="button" size="lg" onClick={onAccept} className="h-14 flex-1">
              <Check className="mr-2 h-5 w-5" /> Usar esta foto
            </Button>
          </>
        ) : (
          <p className="text-center text-xs text-white/70">
            {countdown !== null
              ? "Mantenha-se firme..."
              : "Quando o rosto estiver enquadrado, a foto será tirada automaticamente"}
          </p>
        )}
      </div>

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 px-6 text-center text-white">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Camera className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold">Vamos tirar sua foto</h2>
          <p className="mt-3 max-w-xs text-sm text-white/80">
            Encaixe seu rosto no oval. Quando ficar verde, a foto será tirada automaticamente em 3
            segundos.
          </p>

          <div className="mt-8 grid w-full max-w-xs gap-3 text-left text-sm">
            <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-bold">
                !
              </span>
              <span>
                Oval <strong>vermelho</strong>: ajuste a posição
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">
                ~
              </span>
              <span>
                Oval <strong>amarelo</strong>: quase lá, pequenos ajustes
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span>
                Oval <strong>verde</strong>: pronto, segure firme
              </span>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={() => setShowOnboarding(false)}
            className="mt-10 h-14 w-full max-w-xs text-base"
          >
            Entendi, vamos lá
          </Button>
        </div>
      )}

      <style>{`
        @keyframes countdown-pop {
          0% { transform: scale(0.4); opacity: 0; }
          30% { transform: scale(1.1); opacity: 1; }
          60% { transform: scale(1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ---- Geometry helpers ----
type Pt = { x: number; y: number; z?: number };

function avgPoint(landmarks: Pt[], indices: number[]): Pt {
  let sx = 0,
    sy = 0;
  for (const i of indices) {
    sx += landmarks[i].x;
    sy += landmarks[i].y;
  }
  return { x: sx / indices.length, y: sy / indices.length };
}

function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midPoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Sample the face region into a small canvas, then compute
// brightness, light-uniformity (left vs right) and a Sobel-based
// sharpness estimate. All cheap enough to run a few times per second.
function analyzeFaceQuality(
  video: HTMLVideoElement,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
): { sharpness: number; brightness: number; lightUneven: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sx = Math.max(0, Math.floor(minX * vw));
  const sy = Math.max(0, Math.floor(minY * vh));
  const sw = Math.min(vw - sx, Math.floor((maxX - minX) * vw));
  const sh = Math.min(vh - sy, Math.floor((maxY - minY) * vh));
  if (sw < 20 || sh < 20) return null;

  // Downsample face to ~64px on the long side
  const target = 64;
  const scale = target / Math.max(sw, sh);
  const dw = Math.max(16, Math.round(sw * scale));
  const dh = Math.max(16, Math.round(sh * scale));

  if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
  const c = canvasRef.current;
  c.width = dw;
  c.height = dh;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  const img = ctx.getImageData(0, 0, dw, dh);
  const data = img.data;

  // Convert to luma (Rec.601)
  const luma = new Float32Array(dw * dh);
  let sum = 0;
  let leftSum = 0,
    leftCount = 0,
    rightSum = 0,
    rightCount = 0;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const i = (y * dw + x) * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luma[y * dw + x] = l;
      sum += l;
      if (x < dw / 2) {
        leftSum += l;
        leftCount++;
      } else {
        rightSum += l;
        rightCount++;
      }
    }
  }
  const brightness = sum / (dw * dh);
  const leftMean = leftSum / Math.max(1, leftCount);
  const rightMean = rightSum / Math.max(1, rightCount);
  const lightUneven = Math.abs(leftMean - rightMean) / 255;

  // Sobel magnitude (interior pixels only)
  let sobelSum = 0;
  let sobelCount = 0;
  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      const gx =
        -luma[(y - 1) * dw + (x - 1)] +
        luma[(y - 1) * dw + (x + 1)] +
        -2 * luma[y * dw + (x - 1)] +
        2 * luma[y * dw + (x + 1)] +
        -luma[(y + 1) * dw + (x - 1)] +
        luma[(y + 1) * dw + (x + 1)];
      const gy =
        -luma[(y - 1) * dw + (x - 1)] -
        2 * luma[(y - 1) * dw + x] -
        luma[(y - 1) * dw + (x + 1)] +
        luma[(y + 1) * dw + (x - 1)] +
        2 * luma[(y + 1) * dw + x] +
        luma[(y + 1) * dw + (x + 1)];
      sobelSum += Math.sqrt(gx * gx + gy * gy);
      sobelCount++;
    }
  }
  const sharpness = sobelCount > 0 ? sobelSum / sobelCount / 10 : 0;

  return { sharpness, brightness, lightUneven };
}

// ---- Camera permission helper UI ----

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

interface CameraPermissionHelpProps {
  kind: "denied" | "not_found" | "in_use" | "unsupported" | "generic" | null;
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

function CameraPermissionHelp({ kind, message, onRetry, retrying }: CameraPermissionHelpProps) {
  const platform = detectPlatform();
  const isDenied = kind === "denied";
  const isInUse = kind === "in_use";
  const isNotFound = kind === "not_found";
  const isUnsupported = kind === "unsupported";

  const title = isDenied
    ? "Permita o acesso à câmera"
    : isInUse
      ? "Câmera em uso"
      : isNotFound
        ? "Câmera não encontrada"
        : isUnsupported
          ? "Navegador não suportado"
          : "Não foi possível abrir a câmera";

  const steps: string[] = isDenied
    ? platform === "ios"
      ? [
          "Toque no ícone “aA” na barra de endereço do Safari",
          "Selecione “Ajustes do site”",
          "Em “Câmera”, escolha Permitir",
          "Volte aqui e toque em Ativar câmera",
        ]
      : platform === "android"
        ? [
            "Toque no ícone de cadeado 🔒 na barra de endereço",
            "Toque em Permissões",
            "Ative a Câmera",
            "Volte aqui e toque em Ativar câmera",
          ]
        : [
            "Clique no ícone de cadeado 🔒 na barra de endereço",
            "Em Câmera, selecione Permitir",
            "Recarregue a página, se necessário",
            "Clique em Ativar câmera",
          ]
    : isInUse
      ? [
          "Feche outros aplicativos que estejam usando a câmera",
          "Feche outras abas do navegador com chamadas de vídeo",
          "Toque em Ativar câmera novamente",
        ]
      : isNotFound
        ? [
            "Verifique se o dispositivo tem uma câmera frontal",
            "Conecte uma webcam, se estiver no computador",
            "Toque em Ativar câmera novamente",
          ]
        : isUnsupported
          ? [
              "Use o Safari (iPhone) ou o Chrome (Android) atualizado",
              "Evite navegadores embutidos do Instagram, Facebook ou TikTok",
              "Abra o link em outro navegador",
            ]
          : [
              "Verifique sua conexão e permissões",
              "Toque em Ativar câmera para tentar novamente",
            ];

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
      </div>

      <ol className="mt-3 space-y-1.5 pl-1 text-xs text-foreground/80">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="leading-tight">{s}</span>
          </li>
        ))}
      </ol>

      {!isUnsupported && !isNotFound && (
        <Button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 h-12 w-full text-base"
          size="lg"
        >
          {retrying ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo câmera...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-5 w-5" /> Ativar câmera
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ---- Minimal face mask: single dark overlay with an oval cutout ----
function FaceMaskOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <defs>
        <mask id="face-mask">
          <rect width="100" height="100" fill="white" />
          <ellipse cx="50" cy="52" rx="30" ry="40" fill="black" />
        </mask>
      </defs>
      <rect width="100" height="100" fill="rgba(0,0,0,0.55)" mask="url(#face-mask)" />
    </svg>
  );
}
