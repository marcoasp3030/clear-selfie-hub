import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen,
  Copy,
  Check,
  Server,
  Globe,
  Lock,
  Rocket,
  AlertTriangle,
  Terminal,
  FileCode,
} from "lucide-react";

export const Route = createFileRoute("/admin/docs")({
  component: DocsPage,
});

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] uppercase">
          {language}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7 opacity-70 hover:opacity-100"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 pr-20 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {n}
      </div>
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DocsPage() {
  const traefikCompose = `services:
  traefik:
    image: traefik:v3.1
    container_name: traefik
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.tlschallenge=true"
      - "--certificatesresolvers.le.acme.email=seu-email@nutricarbrasil.com.br"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./letsencrypt:/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - web

networks:
  web:
    name: web
    external: false`;

  const appCompose = `services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: clear-selfie-hub:latest
    container_name: clear-selfie-hub
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      HOST: 0.0.0.0
      SUPABASE_URL: \${SUPABASE_URL}
      SUPABASE_PUBLISHABLE_KEY: \${SUPABASE_PUBLISHABLE_KEY}
      SUPABASE_SERVICE_ROLE_KEY: \${SUPABASE_SERVICE_ROLE_KEY}
      VITE_SUPABASE_URL: \${SUPABASE_URL}
      VITE_SUPABASE_PUBLISHABLE_KEY: \${SUPABASE_PUBLISHABLE_KEY}
      VITE_SUPABASE_PROJECT_ID: \${VITE_SUPABASE_PROJECT_ID}
      UAZAPI_BASE_URL: \${UAZAPI_BASE_URL}
      UAZAPI_ADMIN_TOKEN: \${UAZAPI_ADMIN_TOKEN}
      LOVABLE_API_KEY: \${LOVABLE_API_KEY}
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=web"
      - "traefik.http.routers.facial.rule=Host(\`facial.nutricarbrasil.com.br\`)"
      - "traefik.http.routers.facial.entrypoints=websecure"
      - "traefik.http.routers.facial.tls=true"
      - "traefik.http.routers.facial.tls.certresolver=le"
      - "traefik.http.services.facial.loadbalancer.server.port=3000"

networks:
  web:
    external: true`;

  const envExample = `# Lovable Cloud / Supabase
SUPABASE_URL=https://hffbxygfvdkvtrjtxrba.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=coloque-a-service-role-key-aqui
VITE_SUPABASE_PROJECT_ID=hffbxygfvdkvtrjtxrba

# WhatsApp (uazapi)
UAZAPI_BASE_URL=https://sua-instancia.uazapi.com
UAZAPI_ADMIN_TOKEN=seu-admin-token

# Lovable AI (opcional)
LOVABLE_API_KEY=`;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Documentação de Deploy</h1>
            <p className="text-sm text-muted-foreground">
              Como subir esta aplicação na sua VPS usando Docker + Traefik
            </p>
          </div>
        </div>
      </header>

      <Alert>
        <Rocket className="h-4 w-4" />
        <AlertTitle>Por que Traefik?</AlertTitle>
        <AlertDescription>
          Traefik é um proxy reverso que descobre containers automaticamente via labels Docker e
          emite certificados SSL Let's Encrypt sozinho. Ideal para hospedar múltiplos apps na mesma
          VPS sem precisar editar Nginx a cada deploy.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="setup">
            <Server className="mr-1.5 h-4 w-4" /> Setup
          </TabsTrigger>
          <TabsTrigger value="traefik">
            <Globe className="mr-1.5 h-4 w-4" /> Traefik
          </TabsTrigger>
          <TabsTrigger value="app">
            <FileCode className="mr-1.5 h-4 w-4" /> App
          </TabsTrigger>
          <TabsTrigger value="ops">
            <Terminal className="mr-1.5 h-4 w-4" /> Operação
          </TabsTrigger>
        </TabsList>

        {/* ---------------- SETUP ---------------- */}
        <TabsContent value="setup" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pré-requisitos na VPS</CardTitle>
              <CardDescription>
                Ubuntu / Debian recente, com acesso root e portas 80/443 liberadas no firewall.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Step n={1} title="Instalar Docker e Compose">
                <CodeBlock
                  code={`curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Saia da sessão SSH e entre de novo para aplicar o grupo`}
                />
              </Step>

              <Step n={2} title="Apontar o DNS para a VPS">
                <p className="text-sm text-muted-foreground">
                  No painel do registrador (onde está <code>nutricarbrasil.com.br</code>), crie um
                  registro <strong>A</strong>:
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div>
                      <div className="text-xs text-muted-foreground">Tipo</div>
                      <div>A</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Nome</div>
                      <div>facial</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Valor</div>
                      <div>IP da sua VPS</div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Verifique a propagação em{" "}
                  <a
                    href="https://dnschecker.org"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    dnschecker.org
                  </a>{" "}
                  antes de continuar.
                </p>
              </Step>

              <Step n={3} title="Liberar firewall">
                <CodeBlock
                  code={`sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable`}
                />
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    NÃO exponha a porta 3000 publicamente. O Traefik faz a ponte segura.
                  </AlertDescription>
                </Alert>
              </Step>

              <Step n={4} title="Criar a network compartilhada">
                <p className="text-sm text-muted-foreground">
                  Traefik e o app vivem em containers separados — eles se comunicam por uma network
                  Docker chamada <code>web</code>:
                </p>
                <CodeBlock code="docker network create web" />
              </Step>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- TRAEFIK ---------------- */}
        <TabsContent value="traefik" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subir o Traefik</CardTitle>
              <CardDescription>
                Crie uma pasta dedicada (ex: <code>/opt/traefik</code>) com o compose abaixo. Ele só
                precisa subir uma vez — depois cada novo app é detectado automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Step n={1} title="Estrutura de pastas">
                <CodeBlock
                  code={`sudo mkdir -p /opt/traefik
cd /opt/traefik
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json`}
                />
              </Step>

              <Step n={2} title="docker-compose.yml do Traefik">
                <p className="text-sm text-muted-foreground">
                  Salve em <code>/opt/traefik/docker-compose.yml</code>. Troque o e-mail antes de
                  subir — é usado pelo Let's Encrypt.
                </p>
                <CodeBlock code={traefikCompose} language="yaml" />
              </Step>

              <Step n={3} title="Iniciar o Traefik">
                <CodeBlock
                  code={`cd /opt/traefik
docker compose up -d
docker compose logs -f traefik   # acompanhe a emissão dos certificados`}
                />
              </Step>

              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>SSL automático</AlertTitle>
                <AlertDescription>
                  Após o app subir, o Traefik solicita o certificado para{" "}
                  <code>facial.nutricarbrasil.com.br</code> em segundos e renova sozinho.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- APP ---------------- */}
        <TabsContent value="app" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subir esta aplicação</CardTitle>
              <CardDescription>
                O repositório já vem com <code>Dockerfile</code> pronto. Você só precisa do{" "}
                <code>.env</code> e do <code>docker-compose.yml</code> abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Step n={1} title="Clonar o projeto na VPS">
                <CodeBlock
                  code={`cd /opt
git clone <URL_DO_SEU_REPO> facial
cd facial`}
                />
              </Step>

              <Step n={2} title="Criar o arquivo .env">
                <p className="text-sm text-muted-foreground">
                  Copie o conteúdo abaixo para <code>.env</code> na raiz do projeto e preencha os
                  valores reais. A <code>SUPABASE_SERVICE_ROLE_KEY</code> está no painel do Lovable
                  Cloud.
                </p>
                <CodeBlock code={envExample} language="env" />
              </Step>

              <Step n={3} title="Substituir o docker-compose.yml">
                <p className="text-sm text-muted-foreground">
                  Substitua o <code>docker-compose.yml</code> do projeto por esta versão com labels
                  Traefik:
                </p>
                <CodeBlock code={appCompose} language="yaml" />
              </Step>

              <Step n={4} title="Build e start">
                <CodeBlock
                  code={`docker compose up -d --build
docker compose logs -f app`}
                />
                <p className="text-sm text-muted-foreground">
                  Em alguns segundos o Traefik detecta o container, emite o SSL e a aplicação fica
                  acessível em{" "}
                  <a
                    href="https://facial.nutricarbrasil.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline"
                  >
                    https://facial.nutricarbrasil.com.br
                  </a>
                </p>
              </Step>

              <Step n={5} title="Configurar webhook do uazapi">
                <p className="text-sm text-muted-foreground">
                  No painel do uazapi, aponte o webhook para:
                </p>
                <CodeBlock
                  code="https://facial.nutricarbrasil.com.br/api/public/uazapi-webhook"
                  language="url"
                />
              </Step>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- OPERAÇÃO ---------------- */}
        <TabsContent value="ops" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comandos do dia a dia</CardTitle>
              <CardDescription>Atualizar, reiniciar, ver logs e diagnosticar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Step n={1} title="Deploy de nova versão">
                <CodeBlock
                  code={`cd /opt/facial
git pull
docker compose up -d --build`}
                />
              </Step>

              <Step n={2} title="Logs">
                <CodeBlock
                  code={`# App
docker compose -f /opt/facial/docker-compose.yml logs -f app

# Traefik
docker compose -f /opt/traefik/docker-compose.yml logs -f traefik`}
                />
              </Step>

              <Step n={3} title="Reiniciar / parar">
                <CodeBlock
                  code={`docker compose restart app
docker compose stop app
docker compose down            # remove o container (mantém imagem)`}
                />
              </Step>

              <Step n={4} title="Verificar status e recursos">
                <CodeBlock
                  code={`docker compose ps
docker stats clear-selfie-hub`}
                />
              </Step>

              <Step n={5} title="Renovação SSL">
                <p className="text-sm text-muted-foreground">
                  Automática via Traefik. Para forçar manualmente, basta reiniciar o Traefik:
                </p>
                <CodeBlock code="docker compose -f /opt/traefik/docker-compose.yml restart" />
              </Step>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Solução de problemas</AlertTitle>
                <AlertDescription className="space-y-1">
                  <div>
                    • <strong>Câmera não funciona:</strong> só funciona em HTTPS — confirme que o
                    Traefik emitiu o certificado.
                  </div>
                  <div>
                    • <strong>SSL não emite:</strong> verifique se o DNS da subdomain já propagou e
                    se as portas 80/443 estão abertas.
                  </div>
                  <div>
                    • <strong>Build falha por memória:</strong> VPS de 1 GB precisa de swap. Crie 2
                    GB de swap antes do <code>docker compose up</code>.
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}