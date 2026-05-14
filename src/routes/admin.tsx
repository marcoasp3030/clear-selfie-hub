import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { checkAdminAccess } from "@/server/admin.functions";
import { getLocalSession, localLogout } from "@/server/auth.functions";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Loader2,
  ShieldAlert,
  Cpu,
  Stethoscope,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  BookOpen,
  Server,
  ScrollText,
  Settings,
  Smartphone,
  ChevronDown,
  Wrench,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import nutricarLogo from "@/assets/nutricar-logo.png";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") {
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (data.session) return;

    // Sem sessao Supabase -> tenta JWT local em cookie httpOnly.
    try {
      const { user } = await getLocalSession();
      if (user?.isAdmin) return;
    } catch {
      // ignore
    }

    {
      throw redirect({
        to: "/admin/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const checkAccess = useServerFn(checkAdminAccess);
  const path = routerState.location.pathname;
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (path === "/admin/login") {
      setStatus("ok");
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const accessToken = await requireAdminAccessToken();
        const res = await checkAccess({ data: { accessToken } });
        if (!mounted) return;
        setStatus(res.isAdmin ? "ok" : "denied");
      } catch {
        if (mounted) setStatus("denied");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [checkAccess, path]);

  // Listen for sign-out from any tab
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/admin/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await Promise.allSettled([supabase.auth.signOut(), localLogout()]);
    toast.success("Sessão encerrada");
    navigate({ to: "/admin/login" });
  };

  if (path === "/admin/login") {
    return <Outlet />;
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
        style={{ background: "var(--gradient-soft)" }}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Acesso negado</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Sua conta não tem permissão para acessar este painel. Solicite acesso a um
          administrador.
        </p>
        <Button onClick={handleLogout} variant="outline" className="mt-6">
          Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster richColors position="top-center" />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={nutricarLogo} alt="Nutricar" className="h-7" />
            <div className="hidden h-6 w-px bg-border sm:block" />
            <span className="hidden text-sm font-semibold text-foreground sm:inline">
              Painel admin
            </span>
          </div>

          <AdminNav path={path} onLogout={handleLogout} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; icon: React.ComponentType<{ className?: string }>; matchPrefixes: string[]; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Cadastros",
    icon: Users,
    matchPrefixes: [
      "/admin/registrations",
      "/admin/devices",
      "/admin/registered-devices",
      "/admin/pending-syncs",
    ],
    items: [
      { to: "/admin/registrations", label: "Cadastros", icon: Users },
      { to: "/admin/pending-syncs", label: "Pendentes de sincronização", icon: RefreshCw },
      { to: "/admin/devices", label: "Lojas / Equipamentos", icon: Cpu },
      { to: "/admin/registered-devices", label: "Dispositivos cadastrados", icon: Smartphone },
    ],
  },
  {
    label: "WhatsApp",
    icon: MessageCircle,
    matchPrefixes: ["/admin/whatsapp"],
    items: [
      { to: "/admin/whatsapp", label: "Status / Conexão", icon: MessageCircle },
      { to: "/admin/whatsapp/config", label: "Configuração uazapi", icon: Settings },
      { to: "/admin/whatsapp/diagnostics", label: "Diagnósticos uazapi", icon: Stethoscope },
      { to: "/admin/whatsapp/logs", label: "Logs uazapi", icon: ScrollText },
    ],
  },
  {
    label: "Mensageria",
    icon: MessageSquare,
    matchPrefixes: ["/admin/messages", "/admin/twilio"],
    items: [
      { to: "/admin/messages", label: "Envios", icon: MessageSquare },
      { to: "/admin/twilio", label: "Twilio", icon: MessageSquareText },
    ],
  },
  {
    label: "Sistema",
    icon: Wrench,
    matchPrefixes: [
      "/admin/diagnostics",
      "/admin/migration",
      "/admin/docs",
      "/admin/sintegraws",
    ],
    items: [
      { to: "/admin/diagnostics", label: "Diagnósticos", icon: Stethoscope },
      { to: "/admin/migration", label: "Migração VPS", icon: Server },
      { to: "/admin/sintegraws", label: "Validação CPF (SintegraWS)", icon: ShieldCheck },
      { to: "/admin/docs", label: "Documentação", icon: BookOpen },
    ],
  },
];

function AdminNav({ path, onLogout }: { path: string; onLogout: () => void }) {
  return (
    <nav className="flex items-center gap-1">
      <Link
        to="/admin"
        activeOptions={{ exact: true }}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          path === "/admin"
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <LayoutDashboard className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>

      {NAV_GROUPS.map((group) => {
        const isActive = group.matchPrefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
        const Icon = group.icon;
        return (
          <DropdownMenu key={group.label}>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{group.label}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                const itemActive = path === item.to || path.startsWith(item.to + "/");
                return (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link
                      to={item.to}
                      className={`flex w-full cursor-pointer items-center gap-2 ${
                        itemActive ? "text-primary" : ""
                      }`}
                    >
                      <ItemIcon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      <button
        onClick={onLogout}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </nav>
  );
}
