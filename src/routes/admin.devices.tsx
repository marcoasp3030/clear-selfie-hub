import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listDevices,
  createDevice,
  deleteDevice,
  type DeviceRow,
} from "@/server/devices.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check,
  Cpu,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/admin/devices")({
  head: () => ({
    meta: [{ title: "Equipamentos · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const list = useServerFn(listDevices);
  const create = useServerFn(createDevice);
  const remove = useServerFn(deleteDevice);

  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  async function reload() {
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await list({ data: { accessToken } });
      setDevices(res.devices);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar equipamentos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await create({
        data: {
          accessToken,
          name: name.trim(),
          slug: slug.trim() || undefined,
          apiBaseUrl: apiBaseUrl.trim(),
        },
      });
      if (!res.success) {
        if (res.error === "duplicate_slug") toast.error("Esse slug já está em uso");
        else if (res.error === "invalid_slug") toast.error("Slug inválido (use letras, números e hífen)");
        else toast.error("Não foi possível salvar");
        return;
      }
      toast.success("Equipamento cadastrado");
      setName("");
      setSlug("");
      setApiBaseUrl("");
      setOpenCreate(false);
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este equipamento? A URL pública deixará de funcionar.")) return;
    setDeletingId(id);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await remove({ data: { accessToken, id } });
      if (!res.success) {
        toast.error("Falha ao excluir");
        return;
      }
      toast.success("Equipamento removido");
      setDevices((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } finally {
      setDeletingId(null);
    }
  }

  function publicUrl(slug: string): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/r/${slug}`;
  }

  async function copyUrl(slug: string) {
    const url = publicUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      toast.success("Link copiado");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipamentos</h1>
          <p className="text-sm text-muted-foreground">
            Cada equipamento gera uma URL pública de cadastro exclusiva.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Novo equipamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Cadastrar equipamento</DialogTitle>
                <DialogDescription>
                  Defina um nome, um identificador para a URL e a URL base da API
                  do equipamento.
                </DialogDescription>
              </DialogHeader>

              <div className="my-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dev-name">Nome</Label>
                  <Input
                    id="dev-name"
                    placeholder="Recepção Matriz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-slug">
                    Slug da URL{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (opcional, gerado a partir do nome)
                    </span>
                  </Label>
                  <Input
                    id="dev-slug"
                    placeholder="recepcao-matriz"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    pattern="[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    A URL pública ficará: <span className="font-mono">/r/{slug || "<slug>"}</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-url">URL base da API do equipamento</Label>
                  <Input
                    id="dev-url"
                    type="url"
                    placeholder="https://192.168.1.50"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    O endpoint chamado será{" "}
                    <span className="font-mono">{apiBaseUrl || "https://..."}/user_test_image.fcgi</span>
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !devices || devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Nenhum equipamento cadastrado</p>
              <p className="text-sm text-muted-foreground">
                Cadastre seu primeiro equipamento para gerar a URL pública de cadastro.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map((d) => {
            const url = publicUrl(d.slug);
            return (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{d.name}</CardTitle>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {d.api_base_url}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                      aria-label="Excluir"
                    >
                      {deletingId === d.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-md border bg-muted/40 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      URL pública de cadastro
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs">{url}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => copyUrl(d.slug)}
                    >
                      {copied === d.slug ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copiar link
                    </Button>
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Abrir
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}