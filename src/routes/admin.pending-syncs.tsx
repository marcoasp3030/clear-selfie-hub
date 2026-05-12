import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listPendingSyncs,
  retrySyncRegistration,
  bulkRetrySync,
} from "@/server/controlid.functions";
import { listDevices } from "@/server/devices.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  RefreshCw,
  Clock3,
  XCircle,
  PlayCircle,
  Eye,
  Store,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/admin/pending-syncs")({
  head: () => ({
    meta: [
      { title: "Cadastros pendentes · Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendingSyncsPage,
});

type PendingRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  device_id: string | null;
  device_sync_status: string;
  device_sync_error: string | null;
  device_sync_attempted_at: string | null;
  created_at: string;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function PendingSyncsPage() {
  const fetchPending = useServerFn(listPendingSyncs);
  const fetchDevices = useServerFn(listDevices);
  const retryOne = useServerFn(retrySyncRegistration);
  const bulkRetry = useServerFn(bulkRetrySync);

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [deviceMap, setDeviceMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const [pendingRes, devicesRes] = await Promise.all([
        fetchPending({ data: { accessToken } }),
        fetchDevices({ data: { accessToken } }),
      ]);
      setRows(pendingRes.rows as PendingRow[]);
      const map: Record<string, string> = {};
      for (const d of devicesRes.devices) map[d.id] = d.name;
      setDeviceMap(map);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar cadastros pendentes");
    } finally {
      setLoading(false);
    }
  }, [fetchPending, fetchDevices]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await retryOne({ data: { accessToken, registrationId: id } });
      if (res.success) {
        toast.success("Cadastro reenviado ao equipamento");
        setRows((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(res.error);
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  device_sync_status: "error",
                  device_sync_error: res.error,
                  device_sync_attempted_at: new Date().toISOString(),
                }
              : r,
          ),
        );
      }
    } catch {
      toast.error("Erro inesperado");
    } finally {
      setRetryingId(null);
    }
  }

  async function handleBulk() {
    if (rows.length === 0) return;
    if (
      !confirm(
        `Reprocessar ${rows.length} cadastro(s) pendente(s)? O envio é sequencial e pode levar alguns minutos.`,
      )
    )
      return;
    setBulkRunning(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await bulkRetry({
        data: { accessToken, ids: rows.map((r) => r.id) },
      });
      toast.success(
        `Concluído: ${res.success} sincronizado(s), ${res.failed} com erro (de ${res.total}).`,
      );
      await load();
    } catch {
      toast.error("Falha ao reprocessar em massa");
    } finally {
      setBulkRunning(false);
    }
  }

  const pendingCount = rows.filter((r) => r.device_sync_status === "pending").length;
  const errorCount = rows.filter((r) => r.device_sync_status === "error").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Cadastros pendentes de sincronização
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando o equipamento está offline, os cadastros ficam aqui aguardando
            reprocessamento. Reprocesse individualmente ou em massa.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading || bulkRunning}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            onClick={handleBulk}
            disabled={loading || bulkRunning || rows.length === 0}
          >
            {bulkRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Reprocessar todos ({rows.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Clock3}
          label="Pendentes"
          value={pendingCount}
          tone="muted"
        />
        <StatCard icon={XCircle} label="Com erro" value={errorCount} tone="error" />
        <StatCard
          icon={CheckCircle2}
          label="Aguardando reprocessar"
          value={rows.length}
          tone="primary"
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-semibold">Tudo sincronizado</p>
            <p className="text-sm text-muted-foreground">
              Não há cadastros pendentes ou com erro de envio ao equipamento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border border-border/60 bg-card"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Loja / Equipamento</th>
                  <th className="px-4 py-3 text-left">Erro</th>
                  <th className="px-4 py-3 text-left">Última tentativa</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {r.device_sync_status === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          <XCircle className="h-3 w-3" /> Erro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Clock3 className="h-3 w-3" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.first_name} {r.last_name}
                      <p className="text-xs text-muted-foreground">{r.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {r.device_id && deviceMap[r.device_id] ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <Store className="h-3 w-3" /> {deviceMap[r.device_id]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[280px]">
                      <span className="line-clamp-2">
                        {r.device_sync_error || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmt(r.device_sync_attempted_at || r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(r.id)}
                          disabled={retryingId === r.id || bulkRunning}
                        >
                          {retryingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Reenviar
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                        >
                          <Link
                            to="/admin/registrations/$id"
                            params={{ id: r.id }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "muted" | "error" | "primary";
}) {
  const toneClasses =
    tone === "error"
      ? "bg-destructive/10 text-destructive"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}