import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMessageAttempts } from "@/server/messages.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessagesPage,
});

type Row = {
  id: string;
  channel: "sms" | "whatsapp";
  provider: string | null;
  phone: string;
  status: "sent" | "failed";
  error: string | null;
  provider_message_id: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

function AdminMessagesPage() {
  const fetchRows = useServerFn(listMessageAttempts);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<"all" | "sms" | "whatsapp">("all");
  const [status, setStatus] = useState<"all" | "sent" | "failed">("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const accessToken = await requireAdminAccessToken();
      const res = await fetchRows({
        data: {
          accessToken,
          channel,
          status,
          search: search.trim() || undefined,
          limit: PAGE_SIZE,
          offset,
        },
      });
      setRows(res.rows as Row[]);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar tentativas de envio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, status, offset]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR");
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageSquare className="h-6 w-6 text-primary" />
            Tentativas de envio
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de mensagens SMS (Twilio) e WhatsApp (uazapi).
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Select
          value={channel}
          onValueChange={(v) => {
            setOffset(0);
            setChannel(v as typeof channel);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setOffset(0);
            setStatus(v as typeof status);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar telefone ou erro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setOffset(0);
              void load();
            }
          }}
          className="max-w-xs"
        />
        <Button
          variant="secondary"
          onClick={() => {
            setOffset(0);
            void load();
          }}
        >
          Buscar
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Erro / Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhuma tentativa encontrada.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.channel === "sms" ? "secondary" : "default"}>
                      {r.channel === "sms" ? "SMS" : "WhatsApp"}
                    </Badge>
                    {r.provider ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.provider}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                  <TableCell>
                    {r.status === "sent" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Enviado</Badge>
                    ) : (
                      <Badge variant="destructive">Falhou</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground">
                    {r.error ? (
                      <span className="break-words">{r.error}</span>
                    ) : r.provider_message_id ? (
                      <span className="font-mono">{r.provider_message_id}</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Mostrando {rows.length === 0 ? 0 : offset + 1}–{offset + rows.length} de {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}