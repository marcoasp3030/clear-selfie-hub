import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getDiagnosticsAggregate,
  type DiagnosticsAggregate,
} from "@/server/diagnostics.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Loader2, Stethoscope, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/diagnostics")({
  component: DiagnosticsPage,
});

const CAUSE_LABEL: Record<string, string> = {
  secure_context: "Conexão não segura (HTTP)",
  in_app_browser: "Navegador interno (Instagram/WhatsApp/etc.)",
  iframe: "Página em iframe",
  api_available: "API de câmera indisponível",
  device_present: "Câmera não encontrada",
  permission_state: "Permissão negada",
  device_in_use: "Câmera em uso por outro app",
};

function DiagnosticsPage() {
  const fetchAggregate = useServerFn(getDiagnosticsAggregate);
  const [data, setData] = useState<DiagnosticsAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const accessToken = await requireAdminAccessToken();
        const res = await fetchAggregate({ data: { accessToken } });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Falha ao carregar");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAggregate]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Diagnósticos de câmera
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.totalReports} relatório
              {data.totalReports === 1 ? "" : "s"} recebido
              {data.totalReports === 1 ? "" : "s"} (opt-in dos usuários).
            </p>
          </div>
        </div>
      </div>

      {data.totalReports === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          Nenhum relatório recebido ainda. Quando um usuário tiver problema com
          a câmera e optar por enviar o diagnóstico, ele aparecerá aqui.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Por causa provável">
            {data.byCause.map((row) => (
              <Row
                key={String(row.cause)}
                label={
                  row.cause === null
                    ? "Tudo OK (falso alarme)"
                    : (CAUSE_LABEL[row.cause] ?? row.cause)
                }
                count={row.count}
                total={data.totalReports}
                highlight={row.cause !== null}
              />
            ))}
          </Card>
          <Card title="Por plataforma">
            {data.byPlatform.map((row) => (
              <Row
                key={String(row.platform)}
                label={row.platform ?? "desconhecida"}
                count={row.count}
                total={data.totalReports}
              />
            ))}
          </Card>
          <Card title="Por navegador">
            {data.byBrowser.map((row) => (
              <Row
                key={String(row.browser)}
                label={row.browser ?? "desconhecido"}
                count={row.count}
                total={data.totalReports}
              />
            ))}
          </Card>
        </div>
      )}

      {data.recent.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold">Últimos 50 relatórios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Causa provável</th>
                  <th className="px-3 py-2">Plataforma</th>
                  <th className="px-3 py-2">Navegador</th>
                  <th className="px-3 py-2">Contexto</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {r.likely_cause === null ? (
                        <span className="text-muted-foreground">— OK —</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {CAUSE_LABEL[r.likely_cause] ?? r.likely_cause}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.platform ?? "—"}</td>
                    <td className="px-3 py-2">{r.browser ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[
                        r.in_app_browser && "in-app",
                        r.in_iframe && "iframe",
                        !r.is_secure_context && "HTTP",
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  count,
  total,
  highlight,
}: {
  label: string;
  count: number;
  total: number;
  highlight?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span
          className={highlight ? "font-medium text-foreground" : "text-foreground"}
        >
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${highlight ? "bg-destructive/70" : "bg-primary/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}