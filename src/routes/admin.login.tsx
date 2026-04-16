import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
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

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/admin" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Email ou senha inválidos");
      return;
    }
    toast.success("Login realizado");
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
