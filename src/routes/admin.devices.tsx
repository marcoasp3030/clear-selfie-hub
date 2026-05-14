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
import { Checkbox } from "@/components/ui/checkbox";
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
  X,
  ShieldCheck,
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
  const [cpfValidationRequired, setCpfValidationRequired] = useState(false);
  type Endpoint = { apiBaseUrl: string; apiLogin: string; apiPassword: string };
  const emptyEndpoint = (): Endpoint => ({ apiBaseUrl: "", apiLogin: "", apiPassword: "" });
  const [endpoints, setEndpoints] = useState<Endpoint[]>([emptyEndpoint()]);

  function updateEndpoint(idx: number, patch: Partial<Endpoint>) {
    setEndpoints((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function addEndpoint() {
    setEndpoints((prev) => [...prev, emptyEndpoint()]);
  }
  function removeEndpoint(idx: number) {
    setEndpoints((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

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
      const baseSlugInput = slug.trim();
      let okCount = 0;
      const errors: string[] = [];
      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        if (!ep.apiBaseUrl.trim() || !ep.apiLogin.trim() || !ep.apiPassword) continue;
        const slugForThis =
          baseSlugInput.length > 0
            ? i === 0
              ? baseSlugInput
              : `${baseSlugInput}-${i + 1}`
            : undefined;
        const res = await create({
          data: {
            accessToken,
            name: name.trim(),
            slug: slugForThis,
            apiBaseUrl: ep.apiBaseUrl.trim(),
            apiLogin: ep.apiLogin.trim(),
            apiPassword: ep.apiPassword,
            cpfValidationRequired,
          },
        });
        if (res.success) okCount++;
        else {
          if (res.error === "duplicate_slug") errors.push(`URL #${i + 1}: slug em uso`);
          else if (res.error === "invalid_slug") errors.push(`URL #${i + 1}: slug inválido`);
          else errors.push(`URL #${i + 1}: falha ao salvar`);
        }
      }
      if (okCount === 0) {
        toast.error(errors[0] ?? "Nenhum equipamento foi cadastrado");
        return;
      }
      if (errors.length > 0) {
        toast.warning(`${okCount} cadastrado(s). ${errors.join("; ")}`);
      } else {
        toast.success(
          okCount === 1
            ? "Equipamento cadastrado"
            : `${okCount} equipamentos cadastrados nesta loja`,
        );
      }
      setName("");
      setSlug("");
      setCpfValidationRequired(false);
      setEndpoints([emptyEndpoint()]);
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
          <h1 className="text-2xl font-bold tracking-tight">Lojas / Equipamentos</h1>
          <p className="text-sm text-muted-foreground">
            Cada loja/equipamento gera uma URL pública de cadastro exclusiva. Use o
            nome da loja para identificar a origem dos cadastros.
            <br />
            <strong>Múltiplos equipamentos por loja:</strong> cadastre cada equipamento
            usando exatamente o mesmo <em>Nome da loja</em>. O sistema replica
            automaticamente cada novo cadastro em todos os equipamentos com o mesmo nome.
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
                  <Label htmlFor="dev-name">Nome da loja / equipamento</Label>
                  <Input
                    id="dev-name"
                    placeholder="Ex.: Loja Centro · Recepção Matriz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use o mesmo nome em equipamentos da mesma loja para sincronizar
                    cada cadastro em todos eles.
                  </p>
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
                    {endpoints.length > 1 && slug && (
                      <> · equipamentos extras receberão sufixo automático (ex.: <span className="font-mono">{slug}-2</span>)</>
                    )}
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                  <Checkbox
                    id="dev-cpf-validation"
                    checked={cpfValidationRequired}
                    onCheckedChange={(v) => setCpfValidationRequired(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="dev-cpf-validation" className="cursor-pointer text-sm font-medium">
                      Exigir validação de CPF na Receita Federal
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, o usuário precisará informar a data de nascimento e o
                      sistema validará o CPF junto à Receita Federal antes de finalizar o
                      cadastro. Aplica-se a todos os equipamentos cadastrados aqui.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Equipamentos da loja</p>
                      <p className="text-xs text-muted-foreground">
                        Adicione uma ou mais URLs de equipamento. Todo cadastro será replicado
                        em cada URL; equipamentos offline são ignorados rapidamente.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addEndpoint}>
                      <Plus className="h-4 w-4" />
                      URL
                    </Button>
                  </div>

                  {endpoints.map((ep, idx) => (
                    <div key={idx} className="space-y-2 rounded-md border bg-background p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          Equipamento #{idx + 1}
                        </p>
                        {endpoints.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeEndpoint(idx)}
                            aria-label="Remover URL"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`dev-url-${idx}`}>URL base da API</Label>
                        <Input
                          id={`dev-url-${idx}`}
                          type="url"
                          placeholder="http://177.67.71.26:8186"
                          value={ep.apiBaseUrl}
                          onChange={(e) => updateEndpoint(idx, { apiBaseUrl: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`dev-login-${idx}`}>Login (admin)</Label>
                          <Input
                            id={`dev-login-${idx}`}
                            placeholder="admin"
                            value={ep.apiLogin}
                            onChange={(e) => updateEndpoint(idx, { apiLogin: e.target.value })}
                            required
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`dev-password-${idx}`}>Senha</Label>
                          <Input
                            id={`dev-password-${idx}`}
                            type="password"
                            placeholder="••••••••"
                            value={ep.apiPassword}
                            onChange={(e) => updateEndpoint(idx, { apiPassword: e.target.value })}
                            required
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
                      {d.cpf_validation_required && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <ShieldCheck className="h-3 w-3" /> Valida CPF na Receita
                        </span>
                      )}
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