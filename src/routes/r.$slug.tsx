import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ShieldCheck, Lock, Cpu, Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { RegistrationForm } from "@/components/RegistrationForm";
import { getDeviceBySlug, getStoreDevicesStatus } from "@/server/devices.functions";
import nutricarLogo from "@/assets/nutricar-logo.png";

export const Route = createFileRoute("/r/$slug")({
  loader: async ({ params }) => {
    const { device } = await getDeviceBySlug({ data: { slug: params.slug } });
    if (!device) throw notFound();
    return { device };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.device
          ? `Nutricar Brasil · ${loaderData.device.name}`
          : "Nutricar Brasil",
      },
      {
        name: "description",
        content: loaderData?.device
          ? `Cadastro oficial Nutricar Brasil — ${loaderData.device.name}. Rápido, simples e seguro.`
          : "Cadastro oficial Nutricar Brasil — rápido, simples e seguro.",
      },
      {
        property: "og:title",
        content: loaderData?.device
          ? `Nutricar Brasil · ${loaderData.device.name}`
          : "Nutricar Brasil",
      },
      {
        property: "og:description",
        content: loaderData?.device
          ? `Cadastro oficial Nutricar Brasil — ${loaderData.device.name}.`
          : "Cadastro oficial Nutricar Brasil — rápido, simples e seguro.",
      },
      { property: "og:site_name", content: "Nutricar Brasil" },
      { property: "og:type", content: "website" },
      {
        name: "twitter:title",
        content: loaderData?.device
          ? `Nutricar Brasil · ${loaderData.device.name}`
          : "Nutricar Brasil",
      },
      {
        name: "twitter:description",
        content: loaderData?.device
          ? `Cadastro oficial Nutricar Brasil — ${loaderData.device.name}.`
          : "Cadastro oficial Nutricar Brasil — rápido, simples e seguro.",
      },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#92b61b" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: NotFoundDevice,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-bold">Erro ao carregar</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: PublicDeviceRegistration,
});

function NotFoundDevice() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Cpu className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold">Equipamento não encontrado</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        O link que você acessou não corresponde a nenhum equipamento ativo. Verifique
        com quem compartilhou o endereço.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Ir para a página inicial
      </Link>
    </div>
  );
}

function PublicDeviceRegistration() {
  const { device } = Route.useLoaderData();
  const { slug } = Route.useParams();

  return (
    <div
      className="relative min-h-screen"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: "var(--gradient-hero)" }}
      />

      <Toaster richColors position="top-center" />

      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <img src={nutricarLogo} alt="Nutricar Brasil" className="h-9" />
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            <Lock className="h-3 w-3" />
            <span>Seguro</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-xl px-4 pb-12 pt-8">
        <div className="mb-7 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cadastro · {device.name}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Faça seu cadastro
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Você está se cadastrando no equipamento{" "}
            <span className="font-semibold text-foreground">{device.name}</span>.
          </p>
        </div>

        <StoreDevicesStatus slug={slug} />

        <RegistrationForm deviceId={device.id} />
      </main>

      <footer className="relative pb-8 pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nutricar Brasil
        </p>
      </footer>
    </div>
  );
}

function StoreDevicesStatus({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<
    Array<{ id: string; name: string; online: boolean; error?: string }>
  >([]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getStoreDevicesStatus({ data: { slug } });
      setDevices(r.devices);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (!loading && devices.length <= 1) return null;

  const onlineCount = devices.filter((d) => d.online).length;

  return (
    <div className="mb-6 rounded-xl border border-border/60 bg-background/70 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Equipamentos desta loja
          </p>
          <p className="text-xs text-muted-foreground">
            Seu cadastro será replicado em{" "}
            <span className="font-medium text-foreground">
              {devices.length || "…"}
            </span>{" "}
            equipamento(s)
            {!loading && devices.length > 0 && (
              <>
                {" "}
                — <span className="text-foreground">{onlineCount} online</span>,{" "}
                <span className="text-foreground">
                  {devices.length - onlineCount} offline
                </span>
              </>
            )}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted disabled:opacity-50"
          aria-label="Atualizar status"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <ul className="space-y-1.5">
        {loading && devices.length === 0 ? (
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando equipamentos…
          </li>
        ) : (
          devices.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{d.name}</span>
              </div>
              {d.online ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Wifi className="h-3 w-3" /> online
                </span>
              ) : (
                <span
                  title={d.error}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                >
                  <WifiOff className="h-3 w-3" /> offline
                </span>
              )}
            </li>
          ))
        )}
      </ul>

      {!loading && devices.some((d) => !d.online) && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Equipamentos offline ficarão pendentes e serão sincronizados automaticamente
          assim que voltarem a responder.
        </p>
      )}
    </div>
  );
}