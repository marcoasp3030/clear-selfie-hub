import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
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
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster richColors position="top-center" />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-center px-4 py-3">
          <img src={nutricarLogo} alt="Nutricar Brasil" className="h-9" />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-10 pt-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Faça seu cadastro
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Rápido e simples. Leva menos de 2 minutos.
          </p>
        </div>

        <RegistrationForm />
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nutricar Brasil
      </footer>
    </div>
  );
}
