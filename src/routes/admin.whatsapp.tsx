import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getInstance,
  createInstance,
  connectInstance,
  getInstanceStatus,
  disconnectInstance,
  deleteInstance,
} from "@/server/uazapi.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MessageCircle,
  QrCode,
  Plug,
  Unplug,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/admin/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp · Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WhatsAppPage,
});

type SavedInstance = {
  id: string;
  name: string;
  status: string;
  phone_connected: string | null;
  profile_name: string | null;
  owner_jid: string | null;
  instance_token: string | null;
  last_status_at: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    connected: {
      label: "Conectado",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
    connecting: {
      label: "Conectando...",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
    disconnected: {
      label: "Desconectado",
      cls: "bg-muted text-muted-foreground border-border",
    },
  };
  const v = map[status] ?? {
    label: status,
    cls: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`${v.cls} font-medium`}>
      {v.label}
    </Badge>
  );
}

function formatPhone(jid: string | null, phone: string | null) {
  const raw = phone ?? jid?.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (!raw) return "—";
  // Brazilian format: +55 (11) 91234-5678
  if (raw.startsWith("55") && raw.length >= 12) {
    const c = raw.slice(2);
    const ddd = c.slice(0, 2);
    const rest = c.slice(2);
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `+${raw}`;
}

function WhatsAppPage() {
  const fnGet = useServerFn(getInstance);
  const fnCreate = useServerFn(createInstance);
  const fnConnect = useServerFn(connectInstance);
  const fnStatus = useServerFn(getInstanceStatus);
  const fnDisconnect = useServerFn(disconnectInstance);
  const fnDelete = useServerFn(deleteInstance);

  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<SavedInstance | null>(null);
  const [name, setName] = useState("WhatsApp Principal");
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [busy, setBusy] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function reload() {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnGet({ data: { accessToken } });
      const inst = (res.instance ?? null) as SavedInstance | null;
      setInstance(inst);
      setStatus(inst?.status ?? "disconnected");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar instância.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pollOnce() {
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnStatus({ data: { accessToken } });
      setStatus(res.status);
      if (res.qrcode) setQrcode(res.qrcode);
      if (res.paircode) setPaircode(res.paircode);
      if (res.status === "connected") {
        stopPolling();
        setQrcode(null);
        setPaircode(null);
        toast.success("WhatsApp conectado com sucesso!");
        await reload();
      }
    } catch (err) {
      console.warn("Poll error:", err);
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(() => {
      void pollOnce();
    }, 3000);
  }

  async function onCreate() {
    if (!name.trim()) {
      toast.error("Informe um nome para a instância.");
      return;
    }
    setCreating(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await fnCreate({ data: { accessToken, name: name.trim() } });
      toast.success("Instância criada.");
      await reload();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância.");
    } finally {
      setCreating(false);
    }
  }

  async function onConnect() {
    setConnecting(true);
    setQrcode(null);
    setPaircode(null);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnConnect({ data: { accessToken } });
      if (res.qrcode) setQrcode(res.qrcode);
      if (res.paircode) setPaircode(res.paircode);
      setStatus(res.status || "connecting");
      startPolling();
      toast.info("Escaneie o QR Code com seu WhatsApp.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar conexão.");
    } finally {
      setConnecting(false);
    }
  }

  async function onDisconnect() {
    if (!confirm("Desconectar o WhatsApp? A instância será mantida.")) return;
    setBusy(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await fnDisconnect({ data: { accessToken } });
      stopPolling();
      setQrcode(null);
      setPaircode(null);
      toast.success("WhatsApp desconectado.");
      await reload();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        "Excluir definitivamente a instância? Esta ação não pode ser desfeita."
      )
    )
      return;
    setBusy(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await fnDelete({ data: { accessToken } });
      stopPolling();
      setQrcode(null);
      setPaircode(null);
      toast.success("Instância removida.");
      await reload();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageCircle className="h-6 w-6 text-primary" />
          WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte um número do WhatsApp via uazapi para enviar mensagens a partir do
          sistema.
        </p>
      </div>

      {/* No instance yet */}
      {!instance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" /> Criar instância
            </CardTitle>
            <CardDescription>
              Dê um nome para sua instância (ex: "WhatsApp Principal"). Depois você
              poderá conectar via QR Code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label htmlFor="inst-name">Nome da instância</Label>
              <Input
                id="inst-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                placeholder="WhatsApp Principal"
              />
            </div>
            <Button onClick={onCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                <>
                  <Plug className="mr-2 h-4 w-4" /> Criar instância
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing instance */}
      {instance && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                    {instance.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Atualizado:{" "}
                    {instance.last_status_at
                      ? new Date(instance.last_status_at).toLocaleString("pt-BR")
                      : "—"}
                  </CardDescription>
                </div>
                <StatusBadge status={status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Número conectado
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {status === "connected"
                      ? formatPhone(instance.owner_jid, instance.phone_connected)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Perfil
                  </p>
                  <p className="mt-1 text-sm">
                    {instance.profile_name || "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {status !== "connected" ? (
                  <Button onClick={onConnect} disabled={connecting || busy}>
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando QR...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" /> Conectar via QR Code
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={onDisconnect}
                    disabled={busy}
                  >
                    <Unplug className="mr-2 h-4 w-4" /> Desconectar
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => void pollOnce()}
                  disabled={busy}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Atualizar status
                </Button>

                <Button
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={onDelete}
                  disabled={busy}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir instância
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR area */}
          {status !== "connected" && (qrcode || paircode) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" /> Escaneie no
                  WhatsApp
                </CardTitle>
                <CardDescription>
                  Abra o WhatsApp no celular &gt; Aparelhos conectados &gt;
                  Conectar um aparelho.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {qrcode && (
                  <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                    <img
                      src={
                        qrcode.startsWith("data:")
                          ? qrcode
                          : `data:image/png;base64,${qrcode}`
                      }
                      alt="QR Code WhatsApp"
                      className="h-64 w-64"
                    />
                  </div>
                )}
                {paircode && (
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Ou use o código de pareamento
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-widest">
                      {paircode}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando leitura... O QR Code expira em ~60 segundos.
                </div>
              </CardContent>
            </Card>
          )}

          {status === "connected" && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="flex items-center gap-3 py-5">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="font-semibold">WhatsApp conectado</p>
                  <p className="text-sm text-muted-foreground">
                    Você já pode enviar mensagens pela instância{" "}
                    <span className="font-medium">{instance.name}</span>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
