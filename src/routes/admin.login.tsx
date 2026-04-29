import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Lock, ArrowLeft, ShieldAlert } from "lucide-react";
import nutricarLogo from "@/assets/nutricar-logo.png";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin · Nutricar Brasil" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [insecure, setInsecure] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInsecure(
      !window.isSecureContext &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1",
    );
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/admin" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("[admin-login] signIn error:", error);
        toast.error(error.message || "Email ou senha inválidos");
        return;
      }
      if (!data.session) {
        toast.error("Sessão não criada. Verifique se está acessando via HTTPS.");
        return;
      }
      toast.success("Login realizado");
      // Não confie só no onAuthStateChange — alguns navegadores em http://
      // não persistem o cookie e o evento nunca dispara.
      navigate({ to: "/admin" });
    } catch (err) {
      console.error("[admin-login] unexpected:", err);
      toast.error("Falha de conexão com o servidor de autenticação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: "var(--gradient-soft)" }}
    >
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src={nutricarLogo} alt="Nutricar" className="mx-auto h-10" />
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Lock className="h-3.5 w-3.5" />
            Área restrita
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Painel administrativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com suas credenciais de administrador.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border/60 bg-card p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {insecure && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Conexão não segura (HTTP)</p>
                <p className="mt-1 opacity-90">
                  O login pode falhar silenciosamente porque o navegador não
                  persiste a sessão sem HTTPS. Acesse via{" "}
                  <code className="font-mono">https://</code> (configure SSL no
                  Traefik/Caddy/Nginx).
                </p>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@empresa.com"
              autoComplete="email"
              disabled={submitting}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={submitting}
              className="h-11 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="h-12 w-full text-base font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao cadastro
          </Link>
        </div>
      </div>
    </div>
  );
}
