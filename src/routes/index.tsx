import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { RegistrationForm } from "@/components/RegistrationForm";
import { PhotoGuidelines } from "@/components/PhotoGuidelines";
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
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster richColors position="top-center" />

      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <img src={nutricarLogo} alt="Nutricar Brasil" className="h-10 sm:h-12" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cadastro
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Bem-vindo à Nutricar Brasil
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Preencha seus dados e envie uma foto do rosto para concluir seu cadastro.
            Leva menos de 2 minutos.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <RegistrationForm />
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <PhotoGuidelines />
          </aside>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nutricar Brasil
      </footer>
    </div>
  );
}
