import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ShieldCheck, Lock, Cpu } from "lucide-react";
import { RegistrationForm } from "@/components/RegistrationForm";
import { getDeviceBySlug } from "@/server/devices.functions";
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
          ? `Cadastro · ${loaderData.device.name}`
          : "Cadastro Nutricar",
      },
      {
        name: "description",
        content: loaderData?.device
          ? `Faça seu cadastro no equipamento ${loaderData.device.name}.`
          : "Cadastro Nutricar Brasil.",
      },
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