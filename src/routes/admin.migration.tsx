import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Server,
  Database,
  Lock,
  HardDrive,
  Rocket,
  ShieldCheck,
  AlertTriangle,
  Copy,
  PlugZap,
  MessageCircle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { pingPostgresFromClient } from "@/server/dbHealth.functions";

export const Route = createFileRoute("/admin/migration")({
  head: () => ({
    meta: [{ title: "Migração VPS · Admin Nutricar" }, { name: "robots", content: "noindex" }],
  }),
  component: MigrationPage,
});

function CopyBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {lang}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(code);
            toast.success("Copiado");
          }}
        >
          <Copy className="mr-1 h-3 w-3" /> Copiar
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  step: number | string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-border/60 bg-card p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {typeof step === "number" ? `Passo ${step}` : step}
          </div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function ConnectionTester() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; now: string; tables: Record<string, number | null> }
    | { kind: "err"; error: string; configured: boolean }
  >({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    try {
      const res = await pingPostgresFromClient();
      if (res.ok) {
        setState({ kind: "ok", now: res.now, tables: res.tables });
      } else {
        setState({ kind: "err", error: res.error, configured: res.configured });
      }
    } catch (e) {
      setState({
        kind: "err",
        error: e instanceof Error ? e.message : String(e),
        configured: true,
      });
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Teste de conexão</p>
          <p className="text-xs text-muted-foreground">
            Usa o secret <code className="font-mono">DATABASE_URL</code> do projeto.
          </p>
        </div>
        <Button onClick={run} disabled={state.kind === "loading"} size="sm">
          {state.kind === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="mr-2 h-4 w-4" />
          )}
          Testar agora
        </Button>
      </div>

      {state.kind === "ok" && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Conectado — {state.now}
          </div>
          <ul className="mt-2 space-y-1 font-mono">
            {Object.entries(state.tables).map(([t, c]) => (
              <li key={t}>
                {t}:{" "}
                {c === null ? (
                  <span className="opacity-60">tabela ainda não existe</span>
                ) : (
                  <span>{c} linhas</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.kind === "err" && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4" />
            {state.configured ? "Falha ao conectar" : "DATABASE_URL não configurado"}
          </div>
          <pre className="mt-1 whitespace-pre-wrap break-all">{state.error}</pre>
        </div>
      )}
    </div>
  );
}

function MigrationPage() {
  const dockerCompose = `# /opt/nutricar/docker-compose.yml
services:
  app:
    build: { context: ., dockerfile: Dockerfile }
    image: clear-selfie-hub:latest
    container_name: clear-selfie-hub
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      HOST: 0.0.0.0
      # Postgres da MESMA rede docker do n8n
      DATABASE_URL: postgres://postgres:\${DB_POSTGRESDB_PASSWORD}@postgres:5432/postgres
      DB_SSL: "false"
      JWT_SECRET: \${JWT_SECRET}
      SESSION_SECRET: \${SESSION_SECRET}
      UPLOADS_DIR: /var/app/uploads
      PUBLIC_BASE_URL: https://facial.nutricarbrasil.com.br
      UAZAPI_BASE_URL: \${UAZAPI_BASE_URL}
      UAZAPI_ADMIN_TOKEN: \${UAZAPI_ADMIN_TOKEN}
      TWILIO_ACCOUNT_SID: \${TWILIO_ACCOUNT_SID}
      TWILIO_AUTH_TOKEN: \${TWILIO_AUTH_TOKEN}
      TWILIO_FROM_NUMBER: \${TWILIO_FROM_NUMBER}
      # Mantenha enquanto o cutover nao terminar:
      SUPABASE_URL: \${SUPABASE_URL}
      SUPABASE_PUBLISHABLE_KEY: \${SUPABASE_PUBLISHABLE_KEY}
      SUPABASE_SERVICE_ROLE_KEY: \${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./data/uploads:/var/app/uploads
    networks: [n8n_network]

networks:
  n8n_network:
    external: true
    name: n8n_default   # ajuste com 'docker network ls'`;

  const envFile = `# /opt/nutricar/.env
DB_POSTGRESDB_PASSWORD=pd2V7VA2phVQBfxQ
JWT_SECRET=gere-com-openssl-rand-base64-48
SESSION_SECRET=gere-com-openssl-rand-base64-48
PUBLIC_BASE_URL=https://facial.nutricarbrasil.com.br
UAZAPI_BASE_URL=https://sua-instancia.uazapi.com
UAZAPI_ADMIN_TOKEN=seu-admin-token
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu-auth-token
TWILIO_FROM_NUMBER=+5511999999999
# Mantidos durante o cutover:
SUPABASE_URL=https://hffbxygfvdkvtrjtxrba.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`;

  const findNetwork = `# Na VPS, descubra o nome real da rede onde o n8n + postgres estao:
docker network ls
docker inspect postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\\n"}}{{end}}'`;

  const psqlCheck = `# Verifique do host se o Postgres responde:
docker exec -it postgres psql -U postgres -c "SELECT version();"`;

  const schemaSql = `-- db/init/001_schema.sql (ja gerado no repositorio)
-- Aplique uma unica vez no banco do n8n, em um database separado:
docker exec -it postgres psql -U postgres -c "CREATE DATABASE nutricar;"
docker exec -i  postgres psql -U postgres -d nutricar < db/init/001_schema.sql

# Em seguida AJUSTE o DATABASE_URL para apontar pro database "nutricar":
DATABASE_URL=postgres://postgres:pd2V7VA2phVQBfxQ@postgres:5432/nutricar`;

  const seedAdmin = `-- Hash bcrypt da senha do admin inicial (gere com bcryptjs)
docker run --rm node:20-alpine sh -c \\
  "npx -y bcryptjs-cli hash 'SuaSenhaForte123!' 10"

-- Cole o hash gerado abaixo:
INSERT INTO users (email, password_hash, is_admin)
VALUES ('marcoasp.r@outlook.com', '<HASH_BCRYPT>', true);`;

  const dumpCmd = `# Exporte SOMENTE os dados do Lovable Cloud (schema novo ja existe na VPS):
pg_dump --no-owner --no-acl --data-only \\
  --table=public.registrations \\
  --table=public.devices \\
  --table=public.uazapi_instances \\
  --table=public.camera_diagnostics_reports \\
  "postgres://postgres.hffbxygfvdkvtrjtxrba:SENHA@aws-0-...supabase.com:5432/postgres" \\
  > dump.sql

scp dump.sql usuario@SEU_IP:/opt/nutricar/
docker exec -i postgres psql -U postgres -d nutricar < /opt/nutricar/dump.sql`;

  const storageMigrate = `# Baixar todas as fotos de registration-photos do Lovable Cloud
# (Backend -> Storage -> Download all) e copiar para a VPS:
rsync -avz ./fotos/ usuario@SEU_IP:/opt/nutricar/data/uploads/
# O campo photo_path no banco continua igual.`;

  const caddyfile = `facial.nutricarbrasil.com.br {
    reverse_proxy localhost:3000
    encode zstd gzip
    request_body { max_size 20MB }
}`;

  const deployFlow = `ssh usuario@SEU_IP
sudo mkdir -p /opt/nutricar && sudo chown $USER /opt/nutricar
cd /opt/nutricar

git clone https://github.com/SEU_USUARIO/SEU_REPO.git .
cp .env.example .env
nano .env   # preencha com os valores acima

openssl rand -base64 48   # use no JWT_SECRET
openssl rand -base64 48   # use no SESSION_SECRET

docker compose up -d --build
docker compose logs -f app`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Migração para VPS (Postgres + JWT próprio)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guia em 3 etapas para sair do Supabase. <strong>Etapa 1 (esta):</strong> infra + conexão
          Postgres validada. <strong>Etapa 2:</strong> migrar autenticação para JWT/bcrypt.{" "}
          <strong>Etapa 3:</strong> migrar storage e queries.
        </p>
      </header>

      <Section icon={PlugZap} step="Status" title="Conexão com seu Postgres">
        <p>
          Suas credenciais foram salvas no secret <code className="font-mono">DATABASE_URL</code>.
          Hostname <code className="font-mono">postgres</code>, usuário{" "}
          <code className="font-mono">postgres</code>, porta <code className="font-mono">5432</code>
          .
        </p>
        <p className="text-xs">
          ⚠️ O hostname <code className="font-mono">postgres</code> só resolve{" "}
          <strong>de dentro</strong> da rede Docker do n8n. O teste abaixo só funcionará após o app
          estar rodando na VPS na mesma rede. Em desenvolvimento aqui no Lovable, ele falha — é o
          esperado.
        </p>
        <ConnectionTester />
      </Section>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Antes de começar</p>
            <p className="mt-1 opacity-90">
              Faça <strong>backup completo</strong> do banco e do bucket{" "}
              <code className="font-mono">registration-photos</code> no Lovable Cloud antes do
              cutover final.
            </p>
          </div>
        </div>
      </div>

      <Section icon={Server} step={1} title="Identificar a rede Docker do n8n">
        <p>
          Como o Postgres já roda no docker-compose do n8n, vamos conectar o app à mesma rede em vez
          de subir um Postgres novo.
        </p>
        <CopyBlock code={findNetwork} />
        <p>
          Anote o nome da rede (ex.: <code className="font-mono">n8n_default</code>) e ajuste no{" "}
          <code className="font-mono">docker-compose.yml</code> abaixo.
        </p>
        <CopyBlock code={psqlCheck} />
      </Section>

      <Section icon={Database} step={2} title="Criar database e schema">
        <p>
          Crie um database <code className="font-mono">nutricar</code> separado no mesmo Postgres
          (não use o database do n8n) e aplique o schema (já está em{" "}
          <code className="font-mono">db/init/001_schema.sql</code> no repo):
        </p>
        <CopyBlock code={schemaSql} lang="sql" />
      </Section>

      <Section icon={Lock} step={3} title="Auth JWT próprio + admin inicial">
        <p>
          No cutover (Etapa 2), <code className="font-mono">supabase.auth</code> é substituído por
          bcrypt + JWT. Crie o admin inicial:
        </p>
        <CopyBlock code={seedAdmin} lang="sql" />
      </Section>

      <Section icon={HardDrive} step={4} title="Storage em disco local">
        <p>
          Supabase Storage vira pasta no host (
          <code className="font-mono">/opt/nutricar/data/uploads</code>), montada em{" "}
          <code className="font-mono">/var/app/uploads</code>. O campo{" "}
          <code className="font-mono">photo_path</code> continua igual.
        </p>
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
          <strong>✅ Etapa 3 já implementada no código:</strong> upload e leitura de fotos passam
          por <code className="font-mono">/api/public/upload-photo</code> e{" "}
          <code className="font-mono">/api/admin/photo/&lt;path&gt;</code>. O backend escolhe
          automaticamente <code>disk</code> (se <code className="font-mono">UPLOADS_DIR</code>{" "}
          existir) ou <code>supabase</code>. Queries de <code>registrations</code> também detectam{" "}
          <code className="font-mono">DATABASE_URL</code> e usam Postgres direto quando disponível.
        </p>
        <CopyBlock
          code={`# Backup diario (cron)
#!/bin/bash
set -e
DATE=$(date +%F)
OUT=/opt/backups/nutricar
mkdir -p $OUT
docker exec -t postgres pg_dump -U postgres nutricar | gzip > $OUT/db-$DATE.sql.gz
tar -czf $OUT/uploads-$DATE.tgz -C /opt/nutricar/data uploads
find $OUT -mtime +14 -delete`}
        />
      </Section>

      <Section icon={Rocket} step={5} title="docker-compose + .env">
        <p>
          Arquivo já versionado em <code className="font-mono">docker-compose.yml</code>:
        </p>
        <CopyBlock code={dockerCompose} lang="yaml" />
        <CopyBlock code={envFile} lang="env" />
      </Section>

      <Section icon={Database} step={6} title="Migrar dados do Lovable Cloud">
        <CopyBlock code={dumpCmd} />
        <CopyBlock code={storageMigrate} />
      </Section>

      <Section icon={Rocket} step={7} title="Subir o app">
        <CopyBlock code={deployFlow} />
      </Section>

      <Section icon={ShieldCheck} step={8} title="HTTPS com Caddy + domínio">
        <p>
          Aponte o DNS A de <code>facial.nutricarbrasil.com.br</code> para o IP da VPS.
        </p>
        <CopyBlock code={caddyfile} lang="caddy" />
        <CopyBlock code={`sudo systemctl reload caddy`} />
      </Section>

      <Section icon={MessageCircle} step={9} title="Webhook do uazapi">
        <CopyBlock code={`https://facial.nutricarbrasil.com.br/api/public/uazapi-webhook`} />
      </Section>

      <Section icon={ShieldCheck} step={10} title="Checklist final">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>✅ Botão "Testar agora" acima retorna conectado.</li>
          <li>✅ Login admin funciona com email + bcrypt.</li>
          <li>
            ✅ Cadastro salva foto em <code>data/uploads/</code> e linha em{" "}
            <code>registrations</code>.
          </li>
          <li>
            ✅ <code>docker compose logs -f app</code> sem erros.
          </li>
          <li>✅ Backup diário ativo.</li>
          <li>✅ Senha do admin inicial trocada.</li>
        </ul>
      </Section>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Atualizar versão:</strong>{" "}
          <code>cd /opt/nutricar &amp;&amp; git pull &amp;&amp; docker compose up -d --build</code>
        </p>
      </div>
    </div>
  );
}
