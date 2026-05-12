import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getUazapiDiagnostics,
  pingUazapi,
  sendTestWhatsApp,
} from "@/server/uazapiDiagnostics.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Plug,
  Send,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/whatsapp/diagnostics")({
  head: () => ({
    meta: [{ title: "Diagnóstico WhatsApp · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: WhatsAppDiagnosticsPage,
});

type ProbeResult = {
  ok: boolean;
  status: number;
  ms: number;
  url: string | null;
  bodyPreview?: string | null;
  error?: string | null;
};

type UazLog = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  action: string;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  ok?: boolean;
  requestBody?: unknown;
  responsePreview?: unknown;
  error?: string;
};

type Diagnostics = {
  env: Record<string, string | boolean | null> & { data_backend: string };
  instance: Record<string, unknown> | null;
  instanceError: string | null;
  probe: ProbeResult | null;
  logs: UazLog[];
  checkedAt: string;
};
type PingResult = ProbeResult;
type TestResult = Awaited<ReturnType<typeof sendTestWhatsApp>>;

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={
        ok
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }
    >
      {ok ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
}

function WhatsAppDiagnosticsPage() {
  const fnDiag = useServerFn(getUazapiDiagnostics);
  const fnPing = useServerFn(pingUazapi);
  const fnTest = useServerFn(sendTestWhatsApp);
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testText, setTestText] = useState(
    "Mensagem de teste enviada pelo painel admin.",
  );
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnDiag({ data: { accessToken } });
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao carregar diagnóstico.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePing() {
    setPinging(true);
    setPingResult(null);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnPing({ data: { accessToken } });
      setPingResult(res);
      if (res.ok) toast.success(`Conexão OK em ${res.ms} ms`);
      else toast.error(`Falhou: ${("error" in res && res.error) || res.status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no ping.");
    } finally {
      setPinging(false);
    }
  }

  async function handleSendTest() {
    if (!testTo.trim() || !testText.trim()) {
      toast.error("Informe número e mensagem.");
      return;
    }
    setSending(true);
    setTestResult(null);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnTest({
        data: { accessToken, to: testTo.trim(), text: testText.trim() },
      });
      setTestResult(res);
      if (res.success) toast.success(`Enviado (HTTP ${res.status}, ${res.ms} ms)`);
      else toast.error(res.error || `Falhou (HTTP ${res.status})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar teste.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Stethoscope className="h-6 w-6 text-primary" /> Diagnóstico WhatsApp / uazapi
          </h1>
          <p className="text-sm text-muted-foreground">
            Verifica variáveis de ambiente, conexão com a uazapi e instância salva no banco.
          </p>
        </div>
        <Button variant="outline" onClick={() => void reload()} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" /> Testar conexão uazapi
              </CardTitle>
              <CardDescription>
                Faz uma chamada autenticada em <code>/instance/all</code> com o
                <code> admintoken</code> e mostra o tempo, status HTTP e o início do
                corpo de resposta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => void handlePing()} disabled={pinging}>
                {pinging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                Testar agora
              </Button>
              {pingResult && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      ok={pingResult.ok}
                      label={pingResult.ok ? `OK (${pingResult.status})` : `Falhou (${pingResult.status || "rede"})`}
                    />
                    <span className="text-muted-foreground">{pingResult.ms} ms</span>
                    {pingResult.url && (
                      <code className="text-xs text-muted-foreground">{pingResult.url}</code>
                    )}
                  </div>
                  {"error" in pingResult && pingResult.error ? (
                    <pre className="overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                      {pingResult.error}
                    </pre>
                  ) : null}
                  {"bodyPreview" in pingResult && pingResult.bodyPreview ? (
                    <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-2 text-xs">
                      {pingResult.bodyPreview}
                    </pre>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" /> Enviar WhatsApp de teste
              </CardTitle>
              <CardDescription>
                Usa o token da instância salva e chama <code>/send/text</code> da uazapi.
                A tentativa é registrada em <code>message_attempts</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="test-to">Número (E.164)</Label>
                  <Input
                    id="test-to"
                    placeholder="5511912345678"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    disabled={sending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Apenas dígitos. Se faltar o "55", será adicionado.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="test-text">Mensagem</Label>
                  <Textarea
                    id="test-text"
                    rows={3}
                    maxLength={1000}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    disabled={sending}
                  />
                </div>
              </div>
              <Button onClick={() => void handleSendTest()} disabled={sending}>
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar teste
              </Button>

              {testResult && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      ok={testResult.success}
                      label={testResult.success ? `Enviado (${testResult.status})` : `Falhou (${testResult.status || "rede"})`}
                    />
                    <span className="text-muted-foreground">{testResult.ms} ms</span>
                  </div>
                  {testResult.url && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">URL</p>
                      <code className="block break-all rounded bg-background p-2 text-xs">
                        {testResult.url}
                      </code>
                    </div>
                  )}
                  {testResult.requestBody && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Request body</p>
                      <pre className="overflow-auto rounded bg-background p-2 text-xs">
                        {JSON.stringify(testResult.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}
                  {testResult.error && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-destructive">Erro</p>
                      <pre className="overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        {testResult.error}
                      </pre>
                    </div>
                  )}
                  {testResult.responseBody && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Response body</p>
                      <pre className="overflow-auto rounded bg-background p-2 text-xs">
                        {testResult.responseBody}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variáveis de ambiente</CardTitle>
              <CardDescription>
                Valores lidos pelo processo Node dentro do container.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label="UAZAPI_BASE_URL"
                ok={Boolean(data.env.UAZAPI_BASE_URL)}
                value={data.env.UAZAPI_BASE_URL ?? "(ausente)"}
              />
              <Row
                label="UAZAPI_ADMIN_TOKEN"
                ok={data.env.UAZAPI_ADMIN_TOKEN_present}
                value={data.env.UAZAPI_ADMIN_TOKEN_masked ?? "(ausente)"}
              />
              <Row
                label="DATABASE_URL"
                ok={data.env.DATABASE_URL_present}
                value={data.env.DATABASE_URL_masked ?? "(ausente)"}
              />
              <Row
                label="TWILIO_ACCOUNT_SID"
                ok={data.env.TWILIO_ACCOUNT_SID_present}
                value={data.env.TWILIO_ACCOUNT_SID_masked ?? "(ausente)"}
              />
              <Row
                label="TWILIO_AUTH_TOKEN"
                ok={data.env.TWILIO_AUTH_TOKEN_present}
                value={data.env.TWILIO_AUTH_TOKEN_present ? "(definida)" : "(ausente)"}
              />
              <Row
                label="TWILIO_FROM_NUMBER"
                ok={Boolean(data.env.TWILIO_FROM_NUMBER)}
                value={data.env.TWILIO_FROM_NUMBER ?? "(ausente)"}
              />
              <Row
                label="JWT_SECRET"
                ok={data.env.JWT_SECRET_present}
                value={data.env.JWT_SECRET_present ? "(definida)" : "(ausente)"}
              />
              <Row
                label="UPLOADS_DIR"
                ok={Boolean(data.env.UPLOADS_DIR)}
                value={data.env.UPLOADS_DIR ?? "(ausente — usará Supabase Storage)"}
              />
              <Row label="NODE_ENV" ok value={data.env.NODE_ENV ?? "—"} />
              <Row
                label="Backend de dados"
                ok={data.env.data_backend === "pg"}
                value={data.env.data_backend === "pg" ? "Postgres (VPS)" : "Supabase (fallback)"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conectividade com uazapi</CardTitle>
              <CardDescription>
                Faz GET em <code>/instance/all</code> com o admintoken.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!data.probe ? (
                <p className="text-muted-foreground">
                  Probe não executado (env UAZAPI_* faltando).
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      ok={data.probe.ok}
                      label={
                        data.probe.ok
                          ? `OK (${data.probe.status})`
                          : `Falhou (${data.probe.status || "rede"})`
                      }
                    />
                    <span className="text-muted-foreground">{data.probe.ms} ms</span>
                    <code className="text-xs text-muted-foreground">{data.probe.url}</code>
                  </div>
                  {"error" in data.probe && data.probe.error ? (
                    <pre className="overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                      {data.probe.error}
                    </pre>
                  ) : null}
                  {"bodyPreview" in data.probe && data.probe.bodyPreview ? (
                    <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-2 text-xs">
                      {data.probe.bodyPreview}
                    </pre>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instância salva</CardTitle>
              <CardDescription>
                Última linha em <code>uazapi_instances</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.instanceError ? (
                <pre className="overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  {data.instanceError}
                </pre>
              ) : !data.instance ? (
                <p className="text-muted-foreground">Nenhuma instância salva.</p>
              ) : (
                <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(data.instance, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Verificado em {new Date(data.checkedAt).toLocaleString("pt-BR")}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-1.5 last:border-0">
      <div className="flex items-center gap-2">
        <StatusPill ok={ok} label={ok ? "OK" : "Faltando"} />
        <span className="font-mono text-xs">{label}</span>
      </div>
      <code className="text-xs text-muted-foreground">{value}</code>
    </div>
  );
}
