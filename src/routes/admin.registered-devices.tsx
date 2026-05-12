import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listRegisteredDevices,
  releaseRegisteredDevice,
} from "@/server/registeredDevices.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, RefreshCw, Smartphone } from "lucide-react";

export const Route = createFileRoute("/admin/registered-devices")({
  head: () => ({
    meta: [
      { title: "Dispositivos cadastrados · Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisteredDevicesPage,
});

type DeviceGroup = {
  device_fingerprint: string | null;
  device_id: string | null;
  registrations_count: number;
  last_created_at: string;
  last_first_name: string | null;
  last_last_name: string | null;
  last_phone: string | null;
  device_os: string | null;
  device_browser: string | null;
  device_model: string | null;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function RegisteredDevicesPage() {
  const fnList = useServerFn(listRegisteredDevices);
  const fnRelease = useServerFn(releaseRegisteredDevice);
  const [devices, setDevices] = useState<DeviceGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnList({ data: { accessToken } });
      setDevices(res.devices as DeviceGroup[]);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar dispositivos cadastrados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRelease(d: DeviceGroup) {
    if (!d.device_fingerprint) return;
    const key = `${d.device_fingerprint}|${d.device_id ?? ""}`;
    const confirmMsg = `Remover ${d.registrations_count} cadastro(s) deste dispositivo? Isso libera o aparelho para um novo cadastro.`;
    if (!confirm(confirmMsg)) return;
    setRemovingKey(key);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnRelease({
        data: {
          accessToken,
          deviceFingerprint: d.device_fingerprint,
          deviceId: d.device_id,
        },
      });
      toast.success(`${res.deleted} cadastro(s) removido(s). Dispositivo liberado.`);
      setDevices((prev) =>
        prev?.filter(
          (x) =>
            `${x.device_fingerprint}|${x.device_id ?? ""}` !== key,
        ) ?? null,
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha ao liberar dispositivo.");
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Smartphone className="h-6 w-6 text-primary" /> Dispositivos cadastrados
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista de aparelhos que já enviaram um cadastro. Remova para liberar o
            dispositivo a fazer um novo cadastro.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !devices || devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Smartphone className="h-6 w-6" />
            </div>
            <p className="font-semibold">Nenhum dispositivo encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ainda não existem cadastros associados a um dispositivo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map((d) => {
            const key = `${d.device_fingerprint}|${d.device_id ?? ""}`;
            const isRemoving = removingKey === key;
            const fullName = [d.last_first_name, d.last_last_name]
              .filter(Boolean)
              .join(" ") || "—";
            return (
              <Card key={key}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.last_phone ?? "sem telefone"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {d.registrations_count} cadastro(s)
                    </Badge>
                  </div>

                  <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <p>
                      <span className="text-muted-foreground">Fingerprint:</span>{" "}
                      <span className="font-mono">
                        {d.device_fingerprint?.slice(0, 24) ?? "—"}
                        {d.device_fingerprint && d.device_fingerprint.length > 24
                          ? "…"
                          : ""}
                      </span>
                    </p>
                    <p className="truncate">
                      <span className="text-muted-foreground">Device id:</span>{" "}
                      <span className="font-mono">{d.device_id ?? "—"}</span>
                    </p>
                    <p className="truncate">
                      <span className="text-muted-foreground">SO/Browser:</span>{" "}
                      {(d.device_os ?? "—") + " · " + (d.device_browser ?? "—")}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Último cadastro:</span>{" "}
                      {fmtDate(d.last_created_at)}
                    </p>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRelease(d)}
                    disabled={isRemoving || !d.device_fingerprint}
                  >
                    {isRemoving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Remover cadastros e liberar dispositivo
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
