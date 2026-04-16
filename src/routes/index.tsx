import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ShieldCheck, Lock, Clock } from "lucide-react";
import { RegistrationForm } from "@/components/RegistrationForm";
import nutricarLogo from "@/assets/nutricar-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cadastro Nutricar Brasil" },
      {
        name: "description",
        content:
          "Faça seu cadastro na Nutricar Brasil informando nome, sobrenome, celular e enviando uma foto do rosto.",
      },
      { name: "theme-color", content: "#92b61b" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div
      className="relative min-h-screen"
      style={{ background: "var(--gradient-soft)" }}
    >
      {/* Decorative hero glow */}
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
            Cadastro oficial Nutricar
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Faça seu cadastro
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Rápido, simples e seguro. Em menos de 2 minutos você está pronto.
          </p>

          <div className="mt-5 flex items-center justify-center gap-4 text-[11px] font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>~2 min</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span>Dados protegidos</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Verificado</span>
            </div>
          </div>
        </div>

        <RegistrationForm />
      </main>

      <footer className="relative pb-8 pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nutricar Brasil · Todos os direitos reservados
        </p>
        <Link
          to="/admin/login"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Lock className="h-3 w-3" /> Acesso administrativo
        </Link>
      </footer>
    </div>
  );
}
