import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listRegistrations } from "@/server/admin.functions";
import type { Tables } from "@/integrations/supabase/types";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Smartphone,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/admin/registrations/")({
  head: () => ({
    meta: [{ title: "Cadastros · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RegistrationsList,
});

type Registration = Tables<"registrations">;

const PAGE_SIZE = 25;

function RegistrationsList() {
  const fetchList = useServerFn(listRegistrations);
  const [rows, setRows] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fetchList({
        data: { accessToken, search: debounced, limit: PAGE_SIZE, offset },
      });
      setRows(res.rows as Registration[]);
      setTotal(res.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetchList, debounced, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} registro{total === 1 ? "" : "s"} no total
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou celular..."
            className="h-11 rounded-xl pl-10"
          />
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-border/60 bg-card"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-foreground">Nenhum cadastro encontrado</p>
            <p className="text-xs text-muted-foreground">
              {debounced ? "Tente outro termo de busca." : "Aguardando novos cadastros."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Celular</th>
                    <th className="px-4 py-3 text-left">Localização</th>
                    <th className="px-4 py-3 text-left">Dispositivo</th>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.phone}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatLocation(r)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDevice(r)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/admin/registrations/$id"
                          params={{ id: r.id }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border/50 md:hidden">
              {rows.map((r) => (
                <Link
                  key={r.id}
                  to="/admin/registrations/$id"
                  params={{ id: r.id }}
                  className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {r.first_name} {r.last_name}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(r.created_at, true)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.phone}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {formatLocation(r)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> {formatDevice(r)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatLocation(r: Registration): string {
  const parts = [r.geo_city, r.geo_region, r.geo_country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function formatDevice(r: Registration): string {
  return r.device_model || r.device_os || r.device_platform || "—";
}

function formatDate(iso: string, short = false): string {
  const d = new Date(iso);
  if (short) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
