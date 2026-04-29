import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listRegistrations,
  getPhotoSignedUrl,
  deleteRegistration,
} from "@/server/admin.functions";
import { retrySyncRegistration } from "@/server/controlid.functions";
import type { Tables } from "@/integrations/supabase/types";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Phone,
  MapPin,
  Smartphone,
  Globe,
  Monitor,
  Languages,
  Clock,
  Fingerprint,
  Calendar,
  Wifi,
  Download,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/registrations/$id")({
  head: () => ({
    meta: [{ title: "Detalhe · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RegistrationDetail,
});

type Registration = Tables<"registrations">;

function RegistrationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchList = useServerFn(listRegistrations);
  const fetchSignedUrl = useServerFn(getPhotoSignedUrl);
  const removeRegistration = useServerFn(deleteRegistration);
  const retrySync = useServerFn(retrySyncRegistration);

  const [reg, setReg] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const accessToken = await requireAdminAccessToken();
        const res = await fetchList({ data: { accessToken, limit: 200, offset: 0 } });
        if (!mounted) return;
        const found = (res.rows as Registration[]).find((r) => r.id === id) || null;
        setReg(found);
        if (found?.photo_path) {
          try {
            const signed = await fetchSignedUrl({
              data: { accessToken, path: found.photo_path },
            });
            if (mounted) setPhotoUrl(signed.url);
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, fetchList, fetchSignedUrl]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await removeRegistration({ data: { accessToken, id } });
      toast.success("Cadastro excluído");
      navigate({ to: "/admin/registrations" });
    } catch {
      toast.error("Não foi possível excluir");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const handleRetrySync = async () => {
    if (!reg) return;
    setSyncing(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await retrySync({
        data: { accessToken, registrationId: reg.id },
      });
      if (res.success) {
        toast.success("Cadastro enviado ao equipamento");
        setReg({
          ...reg,
          device_sync_status: "success",
          device_sync_user_id: res.deviceUserId,
          device_sync_error: null,
          device_sync_attempted_at: new Date().toISOString(),
        });
      } else {
        toast.error(res.error);
        setReg({
          ...reg,
          device_sync_status: "error",
          device_sync_error: res.error,
          device_sync_attempted_at: new Date().toISOString(),
        });
      }
    } catch {
      toast.error("Falha ao sincronizar com o equipamento");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reg) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Cadastro não encontrado.</p>
        <Link
          to="/admin/registrations"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/admin/registrations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Excluir cadastro
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Photo + identity */}
        <div
          className="space-y-4 rounded-2xl border border-border/60 bg-card p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="aspect-square overflow-hidden rounded-xl bg-muted">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Foto do cadastro"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {photoUrl && (
            <a
              href={photoUrl}
              download
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Baixar foto
            </a>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cadastrado
            </p>
            <p className="text-xl font-bold tracking-tight">
              {reg.first_name} {reg.last_name}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {reg.phone}
            </p>
          </div>
        </div>

        {/* Device + meta */}
        <div className="space-y-5">
          <Section title="Quando">
            <Field icon={Calendar} label="Data do cadastro" value={formatFullDate(reg.created_at)} />
          </Section>

          <Section title="Equipamento (Control iD)">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <SyncBadge status={reg.device_sync_status} />
                {reg.device_sync_user_id != null && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                    ID no equipamento: <span className="font-mono">{reg.device_sync_user_id}</span>
                  </span>
                )}
                {reg.device_sync_attempted_at && (
                  <span className="text-xs text-muted-foreground">
                    Última tentativa: {formatFullDate(reg.device_sync_attempted_at)}
                  </span>
                )}
              </div>
              {reg.device_sync_error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {reg.device_sync_error}
                </p>
              )}
              {!reg.device_id && (
                <p className="text-xs text-muted-foreground">
                  Este cadastro não está vinculado a um equipamento.
                </p>
              )}
              {reg.device_id && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetrySync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {reg.device_sync_status === "success"
                    ? "Reenviar ao equipamento"
                    : "Enviar ao equipamento"}
                </Button>
              )}
            </div>
          </Section>

          <Section title="Localização">
            <Field icon={MapPin} label="Cidade" value={reg.geo_city} />
            <Field icon={MapPin} label="Estado/Região" value={reg.geo_region} />
            <Field icon={Globe} label="País" value={reg.geo_country} />
            <Field icon={Wifi} label="Endereço IP" value={reg.ip_address} mono />
          </Section>

          <Section title="Dispositivo">
            <Field icon={Smartphone} label="Modelo" value={reg.device_model} />
            <Field icon={Monitor} label="Sistema operacional" value={reg.device_os} />
            <Field icon={Globe} label="Navegador" value={reg.device_browser} />
            <Field icon={Smartphone} label="Plataforma" value={reg.device_platform} />
            <Field icon={Monitor} label="Resolução de tela" value={reg.screen_resolution} />
            <Field icon={Languages} label="Idioma" value={reg.device_language} />
            <Field icon={Clock} label="Fuso horário" value={reg.device_timezone} />
            <Field
              icon={Fingerprint}
              label="Device fingerprint"
              value={reg.device_fingerprint}
              mono
            />
            <Field
              icon={Globe}
              label="User agent (completo)"
              value={reg.user_agent}
              mono
              wrap
            />
          </Section>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é permanente. O registro e a foto correspondente serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-border/60 bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <dl className="space-y-2.5">{children}</dl>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
  wrap,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:w-44">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd
        className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""} ${
          wrap ? "break-all" : ""
        }`}
      >
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
