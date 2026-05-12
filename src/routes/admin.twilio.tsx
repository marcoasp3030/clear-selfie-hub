import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageSquareText, Save, RefreshCw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getTwilioSettings,
  updateTwilioSettings,
} from "@/server/twilioSettings.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";

export const Route = createFileRoute("/admin/twilio")({
  component: AdminTwilioPage,
});

function AdminTwilioPage() {
  const fnGet = useServerFn(getTwilioSettings);
  const fnUpdate = useServerFn(updateTwilioSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [editingToken, setEditingToken] = useState(false);
  const [tokenMasked, setTokenMasked] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [envFallback, setEnvFallback] = useState({
    sid: false,
    token: false,
    from: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fnGet({ data: { accessToken } });
      setAccountSid(res.accountSid ?? "");
      setFromNumber(res.fromNumber ?? "");
      setTokenMasked(res.authTokenMasked ?? null);
      setHasToken(res.hasAuthToken);
      setEnvFallback(res.envFallback);
      setAuthToken("");
      setEditingToken(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar configurações do Twilio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const payload: {
        accessToken: string;
        accountSid?: string | null;
        authToken?: string | null;
        fromNumber?: string | null;
      } = {
        accessToken,
        accountSid: accountSid.trim() || null,
        fromNumber: fromNumber.trim() || null,
      };
      if (editingToken) {
        payload.authToken = authToken.trim() || null;
      }
      await fnUpdate({ data: payload });
      toast.success("Configurações do Twilio salvas.");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar as configurações.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageSquareText className="h-6 w-6 text-primary" />
            Twilio (SMS)
          </h1>
          <p className="text-sm text-muted-foreground">
            Credenciais usadas para envio de SMS de verificação.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Recarregar
        </Button>
      </div>

      <div className="space-y-5 rounded-lg border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="sid">Account SID</Label>
          <Input
            id="sid"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {envFallback.sid && !accountSid ? (
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-1">env</Badge>
              Usando valor de <code>TWILIO_ACCOUNT_SID</code>.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="token">Auth Token</Label>
          {editingToken ? (
            <div className="flex gap-2">
              <Input
                id="token"
                type="password"
                placeholder="Cole o novo Auth Token"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingToken(false);
                  setAuthToken("");
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={tokenMasked ?? "(não configurado)"}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingToken(true);
                  setAuthToken("");
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {hasToken ? "Alterar" : "Definir"}
              </Button>
            </div>
          )}
          {envFallback.token && !hasToken ? (
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-1">env</Badge>
              Usando valor de <code>TWILIO_AUTH_TOKEN</code>.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="from">My Twilio phone number</Label>
          <Input
            id="from"
            placeholder="+15551234567"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Formato E.164 (com código do país, ex.: <code>+1...</code>).
          </p>
          {envFallback.from && !fromNumber ? (
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-1">env</Badge>
              Usando valor de <code>TWILIO_FROM_NUMBER</code>.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Onde encontrar?</p>
        <p>
          Acesse o{" "}
          <a
            href="https://console.twilio.com/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Twilio Console
          </a>
          . Os campos <strong>Account SID</strong>, <strong>Auth Token</strong> e{" "}
          <strong>My Twilio phone number</strong> aparecem na página inicial.
        </p>
      </div>
    </div>
  );
}