import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRegistrationStats, getStoreStats } from "@/server/admin.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Users, Calendar, TrendingUp, Loader2, Store } from "lucide-react";

type Stats = { total: number; today: number; week: number };
type StoreStat = { device_id: string | null; device_name: string; total: number; today: number };


export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard · Admin Nutricar" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchStats = useServerFn(getRegistrationStats);
  const fetchStoreStats = useServerFn(getStoreStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [storeStats, setStoreStats] = useState<StoreStat[] | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const accessToken = await requireAdminAccessToken();
        const [s, ss] = await Promise.all([
          fetchStats({ data: { accessToken } }),
          fetchStoreStats({ data: { accessToken } }),
        ]);
        if (mounted) {
          setStats(s);
          setStoreStats(ss);
        }

      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumo dos cadastros recebidos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={stats?.total}
          loading={loading}
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="Hoje"
          value={stats?.today}
          loading={loading}
          icon={Calendar}
          tone="accent"
        />
        <StatCard
          label="Últimos 7 dias"
          value={stats?.week}
          loading={loading}
          icon={TrendingUp}
          tone="secondary"
        />
      </div>

      <div
        className="rounded-2xl border border-border/60 bg-card p-6"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Cadastros por Loja
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="pb-3 text-left font-medium">Loja</th>
                  <th className="pb-3 text-center font-medium">Hoje</th>
                  <th className="pb-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {storeStats?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      Nenhum cadastro encontrado.
                    </td>
                  </tr>
                ) : (
                  storeStats?.map((store) => (
                    <tr key={store.device_id || "null"} className="group hover:bg-muted/50 transition-colors">
                      <td className="py-3 font-medium text-foreground">
                        {store.device_name}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${store.today > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                          {store.today}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {store.total}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-border/60 bg-card p-6"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="text-lg font-semibold">Próximos passos</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Acesse <strong className="text-foreground">Cadastros</strong> para listar, buscar, ver detalhes e excluir registros.</li>
          <li>• Cada cadastro mostra IP, geolocalização, modelo do aparelho, sistema operacional e navegador.</li>
          <li>• Fotos são acessadas via URLs assinadas válidas por 1 hora.</li>
        </ul>
      </div>

    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "accent" | "secondary";
}) {
  const toneClasses =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "accent"
        ? "bg-accent text-accent-foreground"
        : "bg-secondary text-secondary-foreground";

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-3xl font-bold tracking-tight">{value ?? 0}</p>
        )}
      </div>
    </div>
  );
}
