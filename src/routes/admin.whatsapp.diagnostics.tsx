import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getUazapiDiagnostics } from "@/server/uazapiDiagnostics.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Stethoscope, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/whatsapp/diagnostics")({
  head: () => ({
    meta: [{ title: "Diagnóstico WhatsApp · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: WhatsAppDiagnosticsPage,
});

type Diagnostics = Awaited<ReturnType<typeof getUazapiDiagnostics>>;

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
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);

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
