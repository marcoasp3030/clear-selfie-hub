import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Stethoscope,
  RefreshCw,
  Send,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  runCameraDiagnostics,
  pickLikelyCause,
  getEnvironmentInfo,
  type DiagnosticResult,
  type DiagnosticStatus,
} from "@/lib/cameraDiagnostics";
import { useServerFn } from "@tanstack/react-start";
import { submitDiagnosticsReport } from "@/server/diagnostics.functions";
import { toast } from "sonner";

interface CameraDiagnosticsProps {
  /** When true, the in-use probe runs (briefly opens the camera). */
  probeInUse?: boolean;
  /** Auto-run on mount. Defaults to true. */
  autoRun?: boolean;
  /** Optional device id from the route, included in the opt-in report. */
  deviceId?: string | null;
}

const STATUS_META: Record<
  DiagnosticStatus,
  { Icon: typeof CheckCircle2; color: string; bg: string }
> = {
  ok: {
    Icon: CheckCircle2,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  fail: {
    Icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  warn: {
    Icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  unknown: {
    Icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

export function CameraDiagnostics({
  probeInUse = false,
  autoRun = true,
  deviceId = null,
}: CameraDiagnosticsProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = useServerFn(submitDiagnosticsReport);

  const run = async () => {
    setRunning(true);
    try {
      const r = await runCameraDiagnostics({ skipInUseProbe: !probeInUse });
      setResults(r);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoRun) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cause = results ? pickLikelyCause(results) : null;

  const sendReport = async () => {
    if (!results || !consent || sent) return;
    setSending(true);
    try {
      const env = getEnvironmentInfo();
      const res = await submit({
        data: {
          likelyCause: (cause?.id ?? null) as null,
          results: results.map((r) => ({ id: r.id, status: r.status })),
          platform: env.platform,
          browser: env.browser,
          inAppBrowser: env.inAppBrowser,
          inIframe: env.inIframe,
          isSecureContext: env.isSecureContext,
          deviceId: deviceId,
          userAgent: env.userAgent,
        },
      });
      if (res.success) {
        setSent(true);
        toast.success("Obrigado! Diagnóstico enviado.");
      } else {
        toast.error("Não foi possível enviar agora.");
      }
    } catch {
      toast.error("Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Diagnóstico da câmera
            </p>
            <p className="text-[11px] text-muted-foreground">
              Verificamos cada item para encontrar o problema.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={run}
          disabled={running}
          className="h-8 px-2"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Likely cause banner */}
      {cause && (
        <div
          className={`mb-3 rounded-xl border p-3 ${
            cause.status === "fail"
              ? "border-destructive/30 bg-destructive/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Causa mais provável
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {cause.label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{cause.detail}</p>
          {cause.fix && (
            <p className="mt-2 rounded-lg bg-background/70 px-2 py-1.5 text-xs leading-snug text-foreground">
              <strong>Como resolver: </strong>
              {cause.fix}
            </p>
          )}
        </div>
      )}

      {/* All checks */}
      {results && !cause && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
          ✓ Tudo certo no diagnóstico — se ainda houver erro, tente recarregar a
          página.
        </div>
      )}

      <ul className="space-y-1.5">
        {(results ?? []).map((r) => {
          const meta = STATUS_META[r.status];
          const Icon = meta.Icon;
          return (
            <li key={r.id} className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{r.label}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {r.detail}
                </p>
              </div>
            </li>
          );
        })}
        {!results && running && (
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Executando verificações...
          </li>
        )}
      </ul>

      {/* Opt-in report */}
      {results && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background/40 p-3">
          {sent ? (
            <div className="flex items-center gap-2 text-xs text-primary">
              <Heart className="h-4 w-4" />
              <span>Obrigado por nos ajudar a melhorar!</span>
            </div>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ajude a melhorar (opcional)
              </p>
              <p className="mb-2 text-xs leading-snug text-muted-foreground">
                Podemos receber este resultado para identificar problemas comuns
                e corrigi-los. Enviamos apenas dados técnicos (sistema,
                navegador, status de cada verificação) — <strong>sem fotos,
                nome, telefone ou CPF</strong>.
              </p>
              <label className="mb-2 flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span className="leading-snug">
                  Concordo em enviar este diagnóstico anônimo para a equipe
                  Nutricar.
                </span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!consent || sending}
                onClick={sendReport}
                className="h-9 w-full"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar diagnóstico
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}