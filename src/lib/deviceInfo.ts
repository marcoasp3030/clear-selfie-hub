// Collects browser-side device information for registration auditing.
// IP and geolocation are captured server-side; this file only handles
// what the browser exposes safely.

export interface ClientDeviceInfo {
  userAgent: string;
  screenResolution: string;
  language: string;
  timezone: string;
  platform: string;
}

export function collectClientDeviceInfo(): ClientDeviceInfo {
  if (typeof window === "undefined") {
    return {
      userAgent: "",
      screenResolution: "",
      language: "",
      timezone: "",
      platform: "",
    };
  }

  const screen = window.screen;
  const dpr = window.devicePixelRatio || 1;

  return {
    userAgent: navigator.userAgent || "",
    screenResolution: screen
      ? `${screen.width}x${screen.height}@${dpr}x`
      : "",
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    platform:
      // navigator.platform is deprecated but still useful as a hint
      // Modern browsers expose userAgentData; fall back gracefully.
      (navigator as unknown as { userAgentData?: { platform?: string } })
        .userAgentData?.platform ||
      navigator.platform ||
      "",
  };
}
