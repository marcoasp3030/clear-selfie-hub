import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getSintegrawsSettings,
  updateSintegrawsSettings,
  testSintegrawsToken,
} from "@/server/sintegrawsSettings.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";

export const Route = createFileRoute("/admin/sintegraws")({
  component: AdminSintegrawsPage,
});

function AdminSintegrawsPage() {
  const fnGet = useServerFn(getSintegrawsSettings);
  const fnUpdate = useServerFn(updateSintegrawsSettings);
  const fnTest = useServerFn(testSintegrawsToken);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState(false);
  const [tokenMasked, setTokenMasked] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [envFallback, setEnvFallback] = useState(false);

  const [testCpf, setTestCpf] = useState("");
  const [testBirth, setTestBirth] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: number;
    message: string;
    body: string | null;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnGet({ data: { accessToken } });
      setTokenMasked(res.tokenMasked ?? null);
      setHasToken(res.hasToken);
      setEnvFallback(res.envFallback);
      setToken("");
      setEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar configurações do SintegraWS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    if (!editing) {
      toast.info("Clique em \"Alterar token\" para editar.");
      return;
    }
    if (!token.trim()) {
      toast.error("Informe o token.");
      return;
    }
    setSaving(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await fnUpdate({ data: { accessToken, token: token.trim() } });
      toast.success("Token SintegraWS salvo.");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    if (!confirm("Remover o token salvo? A validação passará a usar o token de ambiente, se houver.")) return;
    setSaving(true);
    try {
      const accessToken = await requireAdminAccessToken();
      await fnUpdate({ data: { accessToken, token: null } });
      toast.success("Token removido.");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (!/^\d{11}$/.test(testCpf)) {
      toast.error("CPF deve ter 11 dígitos (somente números).");
      return;
    }
    if (!/^\d{8}$/.test(testBirth)) {
      toast.error("Data deve estar em ddmmaaaa (8 dígitos).");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnTest({
        data: { accessToken, cpf: testCpf, birthDate: testBirth },
      });
      setTestResult(res);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro no teste.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Validação de CPF (SintegraWS)</h1>
          <p className="text-sm text-muted-foreground">
            Configure o token usado para validar CPF na Receita Federal.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Token SintegraWS</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasToken ? (
              <Badge variant="secondary">Salvo no banco</Badge>
            ) : envFallback ? (
              <Badge variant="outline">Usando token de ambiente</Badge>
            ) : (
              <Badge variant="destructive">Não configurado</Badge>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            {editing ? (
              <Input
                id="token"
                type="password"
                autoComplete="off"
                placeholder="Cole aqui o token do SintegraWS"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="token"
                  value={tokenMasked ?? (envFallback ? "(token de ambiente)" : "(não configurado)")}
                  readOnly
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  Alterar token
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              O token é armazenado de forma segura no banco e nunca é exposto ao navegador
              após salvo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {editing && (
              <>
                <Button onClick={onSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setToken("");
                  }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </>
            )}
            {hasToken && !editing && (
              <Button variant="outline" onClick={onClear} disabled={saving}>
                Remover token salvo
              </Button>
            )}
            <Button variant="ghost" onClick={() => void load()} disabled={saving}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">Testar token</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Faça uma chamada real à API SintegraWS para validar se o token está ativo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="testCpf">CPF (somente dígitos)</Label>
            <Input
              id="testCpf"
              inputMode="numeric"
              maxLength={11}
              placeholder="33706787806"
              value={testCpf}
              onChange={(e) => setTestCpf(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testBirth">Nascimento (ddmmaaaa)</Label>
            <Input
              id="testBirth"
              inputMode="numeric"
              maxLength={8}
              placeholder="11071987"
              value={testBirth}
              onChange={(e) => setTestBirth(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={onTest} disabled={testing}>
          {testing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Executar teste
        </Button>

        {testResult && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              testResult.success
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span>
                {testResult.message} (HTTP {testResult.status})
              </span>
            </div>
            {testResult.body && (
              <pre className="mt-3 max-h-64 overflow-auto rounded bg-muted/50 p-3 text-xs">
                {testResult.body}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}