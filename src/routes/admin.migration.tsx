import { createFileRoute } from "@tanstack/react-router";
import { Server, Database, Lock, HardDrive, Rocket, ShieldCheck, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/migration")({
  head: () => ({
    meta: [
      { title: "Migração para VPS · Admin Nutricar" },
      { name: "robots", content: "noindex" },
    ],
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
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Passo {step}
          </div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function MigrationPage() {
  const dockerCompose = `version: "3.9"

services:
  db:
    image: postgres:16-alpine
    container_name: nutricar-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: nutricar
      POSTGRES_USER: nutricar
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nutricar"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nutricar-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      HOST: 0.0.0.0
      # Banco
      DATABASE_URL: postgres://nutricar:\${DB_PASSWORD}@db:5432/nutricar
      # Auth (JWT próprio)
      JWT_SECRET: \${JWT_SECRET}
      SESSION_SECRET: \${SESSION_SECRET}
      # Storage (disco local)
      UPLOADS_DIR: /var/app/uploads
      PUBLIC_BASE_URL: https://facial.nutricarbrasil.com.br
      # WhatsApp (uazapi)
      UAZAPI_BASE_URL: \${UAZAPI_BASE_URL}
      UAZAPI_ADMIN_TOKEN: \${UAZAPI_ADMIN_TOKEN}
    volumes:
      - ./data/uploads:/var/app/uploads
    ports:
      - "127.0.0.1:3000:3000"
`;

  const envFile = `# /opt/nutricar/.env
DB_PASSWORD=troque-por-uma-senha-forte
JWT_SECRET=gere-com-openssl-rand-base64-48
SESSION_SECRET=gere-com-openssl-rand-base64-48
UAZAPI_BASE_URL=https://sua-instancia.uazapi.com
UAZAPI_ADMIN_TOKEN=seu-admin-token
`;

  const schemaSql = `-- db/init/001_schema.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Usuários (substitui auth.users do Supabase)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,           -- bcrypt
  is_admin     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cadastros faciais
CREATE TABLE registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  cpf         TEXT,
  photo_path  TEXT NOT NULL,            -- caminho relativo em UPLOADS_DIR
  ip_address  TEXT,
  user_agent  TEXT,
  device_os   TEXT,
  device_browser TEXT,
  geo_city    TEXT,
  geo_region  TEXT,
  geo_country TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verificações de telefone (WhatsApp / SMS)
CREATE TABLE phone_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON phone_verifications (phone);

-- Equipamentos ControlID
CREATE TABLE devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  api_base_url TEXT NOT NULL,
  api_login    TEXT,
  api_password TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Diagnósticos de câmera
CREATE TABLE camera_diagnostics_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_agent      TEXT,
  platform        TEXT,
  browser         TEXT,
  in_app_browser  BOOLEAN NOT NULL DEFAULT false,
  in_iframe       BOOLEAN NOT NULL DEFAULT false,
  is_secure_context BOOLEAN NOT NULL DEFAULT true,
  results         JSONB NOT NULL,
  likely_cause    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instâncias uazapi
CREATE TABLE uazapi_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  instance_id     TEXT,
  instance_token  TEXT,
  status          TEXT NOT NULL DEFAULT 'disconnected',
  phone_connected TEXT,
  profile_name    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

  const seedAdmin = `-- db/init/002_seed_admin.sql
-- Cria o admin inicial. Troque a senha imediatamente após o primeiro login.
-- Hash bcrypt para a senha "TroqueEssaSenha123!" (custo 10):
INSERT INTO users (email, password_hash, is_admin)
VALUES (
  'marcoasp.r@outlook.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  true
);
`;

  const dumpCmd = `# Na sua máquina (com acesso ao Lovable Cloud)
# Pegue a connection string em: Cloud → Backend → Connection string (Direct)
pg_dump --no-owner --no-acl --data-only \\
  --table=public.registrations \\
  --table=public.devices \\
  --table=public.uazapi_instances \\
  --table=public.camera_diagnostics_reports \\
  "postgres://postgres.hffbxygfvdkvtrjtxrba:SENHA@aws-0-...supabase.com:5432/postgres" \\
  > dump.sql

# Copie pra VPS
scp dump.sql usuario@SEU_IP:/opt/nutricar/

# Restaure no Postgres da VPS
docker compose exec -T db psql -U nutricar -d nutricar < /opt/nutricar/dump.sql`;

  const storageMigrate = `# Baixar todas as fotos do bucket Supabase Storage
# Use o painel Cloud → Storage → registration-photos → Download all
# Ou via API:
curl -X GET "https://hffbxygfvdkvtrjtxrba.supabase.co/storage/v1/object/list/registration-photos" \\
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prefix":"","limit":1000}' > files.json

# Coloque tudo em ./data/uploads na VPS — o photo_path do banco continua igual
rsync -avz ./fotos/ usuario@SEU_IP:/opt/nutricar/data/uploads/`;

  const caddyfile = `facial.nutricarbrasil.com.br {
    reverse_proxy localhost:3000
    encode zstd gzip
    request_body {
        max_size 20MB
    }
}`;

  const deployFlow = `ssh usuario@SEU_IP
sudo mkdir -p /opt/nutricar && sudo chown $USER /opt/nutricar
cd /opt/nutricar

git clone https://github.com/SEU_USUARIO/SEU_REPO.git .
cp .env.example .env
nano .env   # preencha DB_PASSWORD, JWT_SECRET etc.

# Gere segredos fortes
openssl rand -base64 48   # use no JWT_SECRET
openssl rand -base64 48   # use no SESSION_SECRET

docker compose up -d --build
docker compose logs -f app`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Migração para VPS (Postgres + JWT próprio)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guia passo-a-passo para sair do Supabase/Lovable Cloud e rodar o sistema 100% na sua VPS,
          com Postgres self-hosted, autenticação JWT própria e fotos em disco local.
        </p>
      </header>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Antes de começar</p>
            <p className="mt-1 opacity-90">
              Faça <strong>backup completo</strong> do banco e do bucket{" "}
              <code className="font-mono">registration-photos</code> no Lovable Cloud. Após apontar o DNS pra
              VPS, o sistema antigo deixa de receber novos cadastros.
            </p>
          </div>
        </div>
      </div>

      <Section icon={Server} step={1} title="Pré-requisitos da VPS">
        <p>VPS Linux (Ubuntu 22.04+ recomendado), 2 vCPU / 2 GB RAM, 20 GB disco, IP público.</p>
        <CopyBlock code={`curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version && docker compose version`} />
        <p>Abra portas 80/443 no firewall (não exponha 3000 nem 5432 publicamente):</p>
        <CopyBlock code={`sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable`} />
      </Section>

      <Section icon={Database} step={2} title="Schema do Postgres">
        <p>
          Crie o diretório <code className="font-mono">db/init/</code> na raiz do projeto. O Postgres
          executa qualquer <code className="font-mono">.sql</code> ali na primeira inicialização.
        </p>
        <CopyBlock code={schemaSql} lang="sql" />
        <p>Esse schema substitui as tabelas do Supabase (sem RLS — a segurança fica no backend Node).</p>
      </Section>

      <Section icon={Lock} step={3} title="Auth JWT próprio + admin inicial">
        <p>
          Removemos o <code className="font-mono">supabase.auth</code> e usamos bcrypt + JWT.
          Crie o admin inicial via seed:
        </p>
        <CopyBlock code={seedAdmin} lang="sql" />
        <p>Para gerar o hash da sua senha real:</p>
        <CopyBlock code={`docker run --rm -it node:20-alpine sh -c \\
  "npm i -g bcryptjs && node -e \\"console.log(require('bcryptjs').hashSync(process.argv[1],10))\\" 'SuaSenhaAqui'"`} />
        <p>
          O backend deve emitir um JWT assinado com <code className="font-mono">JWT_SECRET</code> em{" "}
          <code className="font-mono">/api/auth/login</code> e validar em todo endpoint admin
          (substitui o <code className="font-mono">requireAdminAccessToken</code> atual).
        </p>
      </Section>

      <Section icon={HardDrive} step={4} title="Storage em disco local">
        <p>
          O Supabase Storage é trocado por uma pasta no host (<code className="font-mono">/opt/nutricar/data/uploads</code>),
          montada no container em <code className="font-mono">/var/app/uploads</code>. As fotos
          continuam referenciadas pelo campo <code className="font-mono">photo_path</code> da tabela{" "}
          <code className="font-mono">registrations</code>.
        </p>
        <p>Endpoints novos no backend:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><code className="font-mono">POST /api/upload</code> — recebe multipart, grava em <code>UPLOADS_DIR</code>, retorna <code>photo_path</code>.</li>
          <li><code className="font-mono">GET /api/photos/:path</code> — só admin autenticado, faz stream do arquivo.</li>
        </ul>
        <p>Backup automático diário (rode via cron):</p>
        <CopyBlock code={`# /etc/cron.daily/nutricar-backup
#!/bin/bash
set -e
DATE=$(date +%F)
OUT=/opt/backups/nutricar
mkdir -p $OUT
docker compose -f /opt/nutricar/docker-compose.yml exec -T db \\
  pg_dump -U nutricar nutricar | gzip > $OUT/db-$DATE.sql.gz
tar -czf $OUT/uploads-$DATE.tgz -C /opt/nutricar/data uploads
find $OUT -mtime +14 -delete`} />
      </Section>

      <Section icon={Rocket} step={5} title="docker-compose + variáveis">
        <p>Substitua o <code className="font-mono">docker-compose.yml</code> da raiz pelo abaixo:</p>
        <CopyBlock code={dockerCompose} lang="yaml" />
        <p>E o <code className="font-mono">.env</code> em <code>/opt/nutricar/.env</code>:</p>
        <CopyBlock code={envFile} lang="env" />
      </Section>

      <Section icon={Database} step={6} title="Migrar dados do Lovable Cloud">
        <p>Exporte os dados existentes (apenas dados, sem schema — o schema novo já foi criado no passo 2):</p>
        <CopyBlock code={dumpCmd} />
        <p>E as fotos do Storage:</p>
        <CopyBlock code={storageMigrate} />
      </Section>

      <Section icon={Rocket} step={7} title="Subir o app">
        <CopyBlock code={deployFlow} />
        <p>O app fica em <code className="font-mono">http://127.0.0.1:3000</code> (não exposto). HTTPS público vem no próximo passo.</p>
      </Section>

      <Section icon={ShieldCheck} step={8} title="HTTPS com Caddy + domínio">
        <p>Aponte o DNS A de <code>facial.nutricarbrasil.com.br</code> para o IP da VPS.</p>
        <CopyBlock code={`sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile`} />
        <CopyBlock code={caddyfile} lang="caddy" />
        <CopyBlock code={`sudo systemctl reload caddy`} />
        <p>Caddy emite certificado Let's Encrypt automaticamente em segundos.</p>
      </Section>

      <Section icon={MessageCircleIcon} step={9} title="Webhook do uazapi">
        <p>No painel do uazapi, atualize a URL do webhook para:</p>
        <CopyBlock code={`https://facial.nutricarbrasil.com.br/api/public/uazapi-webhook`} />
      </Section>

      <Section icon={ShieldCheck} step={10} title="Checklist final">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>✅ Acesso <code>https://facial.nutricarbrasil.com.br</code> retorna o formulário de cadastro.</li>
          <li>✅ Login admin funciona com email + senha bcrypt.</li>
          <li>✅ Cadastrar uma pessoa salva foto em <code>data/uploads/</code> e linha em <code>registrations</code>.</li>
          <li>✅ <code>docker compose logs -f app</code> sem erros.</li>
          <li>✅ <code>cron.daily/nutricar-backup</code> ativo.</li>
          <li>✅ Senha do admin inicial trocada.</li>
          <li>✅ Cloud (Supabase) pode ser desativado sem quebrar nada.</li>
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

function MessageCircleIcon({ className }: { className?: string }) {
  return <Rocket className={className} />;
}