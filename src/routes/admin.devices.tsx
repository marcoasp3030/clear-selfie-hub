import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listDevices,
  createDevice,
  deleteDevice,
  updateDevice,
  type DeviceRow,
} from "@/server/devices.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  Pencil,
  Search,
  Store,
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
  const update = useServerFn(updateDevice);

  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Edit dialog state
  const [editing, setEditing] = useState<DeviceRow | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editApiBaseUrl, setEditApiBaseUrl] = useState("");
  const [editApiLogin, setEditApiLogin] = useState("");
  const [editApiPassword, setEditApiPassword] = useState("");
  const [editCpfValidation, setEditCpfValidation] = useState(false);
  const [editCpfHidden, setEditCpfHidden] = useState(false);
  const [editAllowDuplicatePhone, setEditAllowDuplicatePhone] = useState(false);

  function openEdit(d: DeviceRow) {
    setEditing(d);
    setEditName(d.name);
    setEditSlug(d.slug);
    setEditApiBaseUrl(d.api_base_url);
    setEditApiLogin(d.api_login ?? "");
    setEditApiPassword("");
    setEditCpfValidation(d.cpf_validation_required);
    setEditCpfHidden(d.cpf_hidden);
    setEditAllowDuplicatePhone(d.allow_duplicate_phone);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || editSubmitting) return;
    setEditSubmitting(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await update({
        data: {
          accessToken,
          id: editing.id,
          name: editName.trim(),
          slug: editSlug.trim().toLowerCase(),
          apiBaseUrl: editApiBaseUrl.trim(),
          apiLogin: editApiLogin.trim(),
          apiPassword: editApiPassword,
          cpfValidationRequired: editCpfValidation,
          cpfHidden: editCpfHidden,
          allowDuplicatePhone: editAllowDuplicatePhone,
        },
      });
      if (!res.success) {
        if (res.error === "duplicate_slug") toast.error("Slug já está em uso");
        else if (res.error === "invalid_slug") toast.error("Slug inválido");
        else toast.error("Falha ao salvar alterações");
        return;
      }
      toast.success("Equipamento atualizado");
      setEditing(null);
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado");
    } finally {
      setEditSubmitting(false);
    }
  }

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cpfValidationRequired, setCpfValidationRequired] = useState(false);
  const [cpfHidden, setCpfHidden] = useState(false);
  const [allowDuplicatePhone, setAllowDuplicatePhone] = useState(false);
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
            cpfHidden,
            allowDuplicatePhone,
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
      setCpfHidden(false);
      setAllowDuplicatePhone(false);
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

  const filteredDevices = devices?.filter((d) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(s) ||
      d.slug.toLowerCase().includes(s) ||
      d.api_base_url.toLowerCase().includes(s)
    );
  });

  // Group devices by name (Loja)
  const groupedDevices = filteredDevices?.reduce((acc, d) => {
    if (!acc[d.name]) acc[d.name] = [];
    acc[d.name].push(d);
    return acc;
  }, {} as Record<string, DeviceRow[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lojas / Equipamentos</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cada loja/equipamento gera uma URL pública de cadastro exclusiva. O sistema replica
            automaticamente cada novo cadastro em todos os equipamentos com o mesmo nome de loja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar lojas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
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

                <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                  <Checkbox
                    id="dev-cpf-hidden"
                    checked={cpfHidden}
                    onCheckedChange={(v) => {
                      const checked = v === true;
                      setCpfHidden(checked);
                      if (checked) setCpfValidationRequired(false);
                    }}
                    className="mt-0.5"
                    disabled={cpfValidationRequired}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="dev-cpf-hidden" className="cursor-pointer text-sm font-medium">
                      Ocultar campo de CPF no cadastro
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, o usuário não precisará informar o CPF para se
                      cadastrar. Útil para públicos sem CPF (ex.: crianças).
                      Não pode ser combinado com a validação na Receita.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                  <Checkbox
                    id="dev-allow-dup-phone"
                    checked={allowDuplicatePhone}
                    onCheckedChange={(v) => setAllowDuplicatePhone(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="dev-allow-dup-phone" className="cursor-pointer text-sm font-medium">
                      Permitir o mesmo celular em múltiplos cadastros
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, o mesmo número de celular pode ser usado em
                      vários cadastros neste equipamento — útil para controle dos
                      pais (vários filhos usam o mesmo telefone).
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
      ) : !filteredDevices || filteredDevices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma loja ou equipamento encontrado para esta busca.</p>
            <Button variant="link" onClick={() => setSearch("")}>Limpar filtros</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedDevices || {}).map(([storeName, items]) => (
            <div key={storeName} className="space-y-4">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold tracking-tight">{storeName}</h2>
                <Badge variant="secondary" className="ml-1">
                  {items.length} {items.length === 1 ? "equipamento" : "equipamentos"}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => {
                  const url = publicUrl(d.slug);
                  return (
                    <Card key={d.id} className="overflow-hidden transition-all hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-sm font-medium">
                              {d.slug}
                            </CardTitle>
                            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                              {d.api_base_url}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(d)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {d.cpf_validation_required && (
                            <Badge variant="outline" className="h-5 border-primary/30 bg-primary/5 text-[9px] text-primary">
                              <ShieldCheck className="mr-1 h-3 w-3" /> CPF Receita
                            </Badge>
                          )}
                          {d.cpf_hidden && (
                            <Badge variant="outline" className="h-5 text-[9px]">
                              Sem CPF
                            </Badge>
                          )}
                          {d.allow_duplicate_phone && (
                            <Badge variant="outline" className="h-5 text-[9px]">
                              Tel. Duplicado
                            </Badge>
                          )}
                        </div>

                        <div className="rounded-md border bg-muted/30 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Link de Cadastro
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[10px]">{url}</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 text-xs"
                            onClick={() => copyUrl(d.slug)}
                          >
                            {copied === d.slug ? (
                              <Check className="mr-1 h-3 w-3" />
                            ) : (
                              <Copy className="mr-1 h-3 w-3" />
                            )}
                            Copiar
                          </Button>
                          <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 text-xs"
                          >
                            <a href={url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Abrir
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Editar equipamento</DialogTitle>
              <DialogDescription>
                Atualize os dados do equipamento. Deixe a senha em branco para manter
                a senha atual.
              </DialogDescription>
            </DialogHeader>

            <div className="my-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nome da loja / equipamento</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-slug">Slug da URL</Label>
                <Input
                  id="edit-slug"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                  pattern="[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?"
                  required
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  URL pública: <span className="font-mono">/r/{editSlug || "<slug>"}</span>
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  id="edit-cpf-validation"
                  checked={editCpfValidation}
                  onCheckedChange={(v) => setEditCpfValidation(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="edit-cpf-validation"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Exigir validação de CPF na Receita Federal
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, o usuário precisará informar a data de nascimento e
                    o CPF será validado na Receita antes do cadastro.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  id="edit-cpf-hidden"
                  checked={editCpfHidden}
                  onCheckedChange={(v) => {
                    const checked = v === true;
                    setEditCpfHidden(checked);
                    if (checked) setEditCpfValidation(false);
                  }}
                  className="mt-0.5"
                  disabled={editCpfValidation}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="edit-cpf-hidden"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Ocultar campo de CPF no cadastro
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    O usuário não precisará informar o CPF. Útil para públicos
                    sem CPF (ex.: crianças). Não combina com validação na Receita.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  id="edit-allow-dup-phone"
                  checked={editAllowDuplicatePhone}
                  onCheckedChange={(v) => setEditAllowDuplicatePhone(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="edit-allow-dup-phone"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Permitir o mesmo celular em múltiplos cadastros
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Útil para controle dos pais — vários filhos usam o mesmo
                    telefone neste equipamento.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-url">URL base da API</Label>
                <Input
                  id="edit-url"
                  type="url"
                  value={editApiBaseUrl}
                  onChange={(e) => setEditApiBaseUrl(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-login">Login (admin)</Label>
                  <Input
                    id="edit-login"
                    value={editApiLogin}
                    onChange={(e) => setEditApiLogin(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-password">Senha</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder="(deixe em branco para manter)"
                    value={editApiPassword}
                    onChange={(e) => setEditApiPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}