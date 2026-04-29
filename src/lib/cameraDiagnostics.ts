/**
 * Camera diagnostics — runs a series of independent checks to figure out
 * why getUserMedia() failed (or might fail). Each check returns one of:
 *   - "ok"      → check passed
 *   - "warn"    → not blocking but suspicious
 *   - "fail"    → almost certainly the cause
 *   - "unknown" → could not determine (e.g. browser doesn't expose the API)
 *
 * The runner picks the FIRST failing check (in priority order) as the
 * "likely cause" so the UI can foreground a single fix.
 */

export type DiagnosticStatus = "ok" | "warn" | "fail" | "unknown";

export type DiagnosticId =
  | "secure_context"
  | "in_app_browser"
  | "iframe"
  | "api_available"
  | "device_present"
  | "permission_state"
  | "device_in_use";

export interface DiagnosticResult {
  id: DiagnosticId;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  /** What the user should do — only set when status is fail/warn. */
  fix?: string;
}

const IN_APP_UA =
  /Instagram|FBAN|FBAV|FB_IAB|Line|MicroMessenger|WhatsApp|TikTok|Snapchat|Pinterest/i;

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function getEnvironmentInfo() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      platform: null as null | "ios" | "android" | "desktop",
      browser: null as
        | null
        | "safari"
        | "chrome"
        | "firefox"
        | "edge"
        | "in_app"
        | "other",
      inAppBrowser: false,
      inIframe: false,
      isSecureContext: true,
      userAgent: null as string | null,
    };
  }
  const ua = navigator.userAgent || "";
  const inApp = IN_APP_UA.test(ua);
  let browser: "safari" | "chrome" | "firefox" | "edge" | "in_app" | "other" =
    "other";
  if (inApp) browser = "in_app";
  else if (/Edg\//i.test(ua)) browser = "edge";
  else if (/Firefox\//i.test(ua)) browser = "firefox";
  else if (/Chrome\//i.test(ua)) browser = "chrome";
  else if (/Safari\//i.test(ua)) browser = "safari";
  let inIframe = false;
  try {
    inIframe = window.top !== window.self;
  } catch {
    inIframe = true;
  }
  return {
    platform: detectPlatform(),
    browser,
    inAppBrowser: inApp,
    inIframe,
    isSecureContext:
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1",
    userAgent: ua.slice(0, 500),
  };
}

async function checkPermission(): Promise<DiagnosticResult> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return {
      id: "permission_state",
      label: "Permissão da câmera",
      status: "unknown",
      detail:
        "Seu navegador não expõe o estado da permissão (comum no Safari/iOS). O prompt aparecerá ao tentar abrir a câmera.",
    };
  }
  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    if (status.state === "granted") {
      return {
        id: "permission_state",
        label: "Permissão da câmera",
        status: "ok",
        detail: "Já liberada para este site.",
      };
    }
    if (status.state === "denied") {
      const platform = detectPlatform();
      return {
        id: "permission_state",
        label: "Permissão da câmera",
        status: "fail",
        detail: "Você (ou o navegador) bloqueou o acesso à câmera neste site.",
        fix:
          platform === "ios"
            ? "Toque no “aA” na barra de endereço do Safari → Ajustes do site → Câmera → Permitir."
            : platform === "android"
              ? "Toque no cadeado 🔒 na barra de endereço → Permissões → ative Câmera."
              : "Clique no cadeado 🔒 na barra de endereço → libere Câmera → recarregue a página.",
      };
    }
    return {
      id: "permission_state",
      label: "Permissão da câmera",
      status: "warn",
      detail: "Ainda não decidida. O prompt aparecerá ao abrir a câmera.",
    };
  } catch {
    return {
      id: "permission_state",
      label: "Permissão da câmera",
      status: "unknown",
      detail: "Não foi possível consultar o estado da permissão.",
    };
  }
}

async function checkDevices(): Promise<DiagnosticResult> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return {
      id: "device_present",
      label: "Câmera detectada",
      status: "unknown",
      detail: "Não foi possível listar dispositivos neste navegador.",
    };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    if (cams.length === 0) {
      return {
        id: "device_present",
        label: "Câmera detectada",
        status: "fail",
        detail: "Nenhuma câmera de vídeo encontrada no dispositivo.",
        fix:
          "Confirme que o aparelho tem câmera frontal funcionando. Em desktop, conecte uma webcam e recarregue.",
      };
    }
    return {
      id: "device_present",
      label: "Câmera detectada",
      status: "ok",
      detail: `${cams.length} câmera${cams.length > 1 ? "s" : ""} encontrada${cams.length > 1 ? "s" : ""}.`,
    };
  } catch {
    return {
      id: "device_present",
      label: "Câmera detectada",
      status: "unknown",
      detail: "Falha ao listar dispositivos.",
    };
  }
}

/**
 * Probe whether the camera is currently grabbed by another app/tab.
 * We only run this when the permission is "granted" — otherwise the
 * NotAllowedError would be a false positive for "in use".
 */
async function checkInUse(): Promise<DiagnosticResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      id: "device_in_use",
      label: "Câmera disponível",
      status: "unknown",
      detail: "API de mídia indisponível.",
    };
  }
  // Only probe if permission is already granted
  try {
    const perm = await navigator.permissions?.query?.({
      name: "camera" as PermissionName,
    });
    if (perm && perm.state !== "granted") {
      return {
        id: "device_in_use",
        label: "Câmera disponível",
        status: "unknown",
        detail: "Só pode ser verificado depois da permissão ser concedida.",
      };
    }
  } catch {
    /* fall through and try */
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    // Immediately release — we only wanted to know if we *could* grab it.
    stream.getTracks().forEach((t) => t.stop());
    return {
      id: "device_in_use",
      label: "Câmera disponível",
      status: "ok",
      detail: "Nenhum outro app está usando a câmera.",
    };
  } catch (err) {
    const e = err as DOMException;
    if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
      return {
        id: "device_in_use",
        label: "Câmera disponível",
        status: "fail",
        detail: "A câmera está sendo usada por outro aplicativo ou aba.",
        fix:
          "Feche apps de vídeo (Zoom, Meet, WhatsApp, FaceTime) e outras abas com câmera. Depois toque em Tentar novamente.",
      };
    }
    return {
      id: "device_in_use",
      label: "Câmera disponível",
      status: "unknown",
      detail: `Não foi possível confirmar (${e?.name || "erro"}).`,
    };
  }
}

export async function runCameraDiagnostics(options?: {
  /** Skip the in-use probe (it actually opens the camera briefly). */
  skipInUseProbe?: boolean;
}): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // 1. Secure context (HTTPS or localhost)
  if (typeof window === "undefined") {
    results.push({
      id: "secure_context",
      label: "Conexão segura (HTTPS)",
      status: "unknown",
      detail: "Ambiente não-navegador.",
    });
  } else {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const secure = window.isSecureContext || isLocal;
    results.push({
      id: "secure_context",
      label: "Conexão segura (HTTPS)",
      status: secure ? "ok" : "fail",
      detail: secure
        ? `Servido via ${window.location.protocol}.`
        : "A câmera só funciona em https:// (ou localhost).",
      fix: secure
        ? undefined
        : "Acesse esta página por uma URL que comece com https://.",
    });
  }

  // 2. In-app browser detection (Instagram/WhatsApp/etc.)
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const inAppBrowser = IN_APP_UA.test(ua);
  results.push({
    id: "in_app_browser",
    label: "Navegador padrão",
    status: inAppBrowser ? "fail" : "ok",
    detail: inAppBrowser
      ? "Você está usando o navegador interno de um app (Instagram/WhatsApp/Facebook/TikTok). Esses navegadores bloqueiam a câmera."
      : "Navegador padrão detectado.",
    fix: inAppBrowser
      ? "Toque nos 3 pontinhos no canto da tela e escolha “Abrir no navegador” (Safari/Chrome)."
      : undefined,
  });

  // 3. Iframe check
  let inIframe = false;
  try {
    inIframe = typeof window !== "undefined" && window.top !== window.self;
  } catch {
    inIframe = true;
  }
  results.push({
    id: "iframe",
    label: "Página em primeiro plano",
    status: inIframe ? "warn" : "ok",
    detail: inIframe
      ? "Esta página está rodando dentro de outra (iframe), o que pode bloquear a câmera."
      : "A página está sendo exibida diretamente.",
    fix: inIframe ? "Abra esta página em uma aba nova do navegador." : undefined,
  });

  // 4. API available
  const hasApi =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  results.push({
    id: "api_available",
    label: "API de câmera disponível",
    status: hasApi ? "ok" : "fail",
    detail: hasApi
      ? "navigator.mediaDevices.getUserMedia presente."
      : "Seu navegador não oferece a API de câmera.",
    fix: hasApi
      ? undefined
      : "Use o Safari (iPhone) ou Chrome (Android) atualizado.",
  });

  // 5. Devices enumerated
  results.push(await checkDevices());

  // 6. Permission state
  results.push(await checkPermission());

  // 7. In-use probe (optional, runs only if permission is granted)
  if (!options?.skipInUseProbe) {
    results.push(await checkInUse());
  }

  return results;
}

/**
 * Pick the most likely root cause from a diagnostics run.
 * Priority follows the order failures should be addressed.
 */
export function pickLikelyCause(
  results: DiagnosticResult[],
): DiagnosticResult | null {
  const priority: DiagnosticId[] = [
    "secure_context",
    "in_app_browser",
    "api_available",
    "device_present",
    "permission_state",
    "device_in_use",
    "iframe",
  ];
  for (const id of priority) {
    const r = results.find((x) => x.id === id);
    if (r && r.status === "fail") return r;
  }
  for (const id of priority) {
    const r = results.find((x) => x.id === id);
    if (r && r.status === "warn") return r;
  }
  return null;
}