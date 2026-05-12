import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getUazapiLogs, clearUazapiLogs } from "@/server/uazapiDiagnostics.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  RefreshCw,
  ScrollText,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/whatsapp/logs")({
  head: () => ({
    meta: [{ title: "Logs uazapi · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: WhatsAppLogsPage,
});

type UazLog = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  action: string;
  method?: string;
  path?: string;
  url?: string;
  status?: number;
  ms?: number;
  ok?: boolean;
  requestBody?: unknown;
  responsePreview?: unknown;
  error?: string;
};

function LevelBadge({ level, ok }: { level: UazLog["level"]; ok?: boolean }) {
  const isError = level === "error" || ok === false;
  const isWarn = level === "warn";
  const cls = isError
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : isWarn
      ? "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  const Icon = isError ? XCircle : isWarn ? AlertTriangle : CheckCircle2;
  return (
    <Badge variant="outline" className={cls}>
      <Icon className="mr-1 h-3 w-3" />
      {level.toUpperCase()}
    </Badge>
  );
}

function WhatsAppLogsPage() {
  const fnGet = useServerFn(getUazapiLogs);
  const fnClear = useServerFn(clearUazapiLogs);
  const [logs, setLogs] = useState<UazLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [auto, setAuto] = useState(true);
  const [filter, setFilter] = useState<"all" | "errors" | "create" | "qr">("all");
  const [lastAt, setLastAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function reload(silent = false) {
    if (!silent) setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnGet({ data: { accessToken } });
      setLogs(res.logs as UazLog[]);
      setLastAt(res.at);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Erro ao carregar logs.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleClear() {
    if (!confirm("Limpar todos os logs em memória?")) return;
    setClearing(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await fnClear({ data: { accessToken } });
      toast.success("Logs limpos.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao limpar.");
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    void reload();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (auto) {
      timerRef.current = setInterval(() => void reload(true), 3000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const filtered = logs.filter((l) => {
    if (filter === "errors") return l.level === "error" || l.ok === false;
    if (filter === "create") return (l.path || "").includes("/instance/");
    if (filter === "qr")
      return /qr|connect|status/i.test(l.path || "") || /qrcode|paircode/i.test(JSON.stringify(l.responsePreview ?? ""));
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ScrollText className="h-6 w-6 text-primary" /> Logs uazapi
          </h1>
          <p className="text-sm text-muted-foreground">
            Cada chamada HTTP feita pelo backend à uazapi (URL, payload, status e corpo). Útil
            para depurar criação de instância e leitura do QR Code na VPS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
            <Switch id="auto" checked={auto} onCheckedChange={setAuto} />
            <Label htmlFor="auto" className="text-xs">
              Auto-refresh (3s)
            </Label>
          </div>
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleClear}
            disabled={clearing}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{filtered.length} chamadas</CardTitle>
              <CardDescription>
                Buffer em memória do processo (até 80 eventos, mais recentes primeiro).
                {lastAt && (
                  <> Atualizado em {new Date(lastAt).toLocaleTimeString("pt-BR")}.</>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "errors", label: "Erros" },
                  { id: "create", label: "Instância" },
                  { id: "qr", label: "QR/Status" },
                ] as const
              ).map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filter === f.id ? "default" : "outline"}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !logs.length ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum log para este filtro. Tente criar a instância ou gerar o QR Code em{" "}
              <code>/admin/whatsapp</code>.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={log.level} ok={log.ok} />
                    <span className="font-mono text-xs font-semibold">
                      {log.method ?? "—"} {log.path ?? log.action}
                    </span>
                    {typeof log.status === "number" && (
                      <Badge
                        variant="outline"
                        className={
                          log.status >= 200 && log.status < 300
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }
                      >
                        HTTP {log.status}
                      </Badge>
                    )}
                    {typeof log.ms === "number" && (
                      <span className="text-xs text-muted-foreground">{log.ms} ms</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(log.at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {log.url && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        URL
                      </p>
                      <code className="block break-all rounded bg-background p-2 text-xs">
                        {log.url}
                      </code>
                    </div>
                  )}
                  {log.error && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-destructive">
                        Erro
                      </p>
                      <pre className="overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        {log.error}
                      </pre>
                    </div>
                  )}
                  {log.requestBody !== undefined && log.requestBody !== null && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        Request body
                      </p>
                      <pre className="max-h-64 overflow-auto rounded bg-background p-2 text-xs">
                        {JSON.stringify(log.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.responsePreview !== undefined && log.responsePreview !== null && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        Response body
                      </p>
                      <pre className="max-h-64 overflow-auto rounded bg-background p-2 text-xs">
                        {typeof log.responsePreview === "string"
                          ? log.responsePreview
                          : JSON.stringify(log.responsePreview, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}