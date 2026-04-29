# Deploy via Docker em VPS

Este projeto pode rodar em qualquer VPS Linux com **Docker** + **Docker Compose**.
O build usa Node.js (não Cloudflare Workers) quando a variável `DEPLOY_TARGET=node`
está presente — isso já está configurado no `Dockerfile`.

## 1. Pré-requisitos na VPS

```bash
# Instalar Docker (Ubuntu / Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # relogue depois disso
```

Docker Compose v2 já vem embutido (`docker compose ...`).

## 2. Enviar o código para a VPS

Você pode usar `git clone`, `scp` ou `rsync`. Exemplo com git:

```bash
ssh usuario@SEU_IP
git clone https://github.com/SEU_USUARIO/SEU_REPO.git app
cd app
```

## 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env   # preencha SUPABASE_SERVICE_ROLE_KEY, UAZAPI_*, etc.
```

> A `SUPABASE_SERVICE_ROLE_KEY` está no painel do Lovable Cloud → Backend.
> **Nunca** comite o `.env` real no git.

## 4. Subir o container

```bash
docker compose up -d --build
```

A aplicação ficará disponível em `http://SEU_IP:3000`.

Logs em tempo real:

```bash
docker compose logs -f app
```

## 5. Atualizar (deploy de nova versão)

```bash
git pull
docker compose up -d --build
```

## 6. Colocar atrás de um domínio + HTTPS (recomendado)

Use **Nginx** ou **Caddy** como proxy reverso. Exemplo com Caddy
(`/etc/caddy/Caddyfile`):

```
seu-dominio.com.br {
    reverse_proxy localhost:3000
}
```

O Caddy pega certificado SSL Let's Encrypt automaticamente.

Exemplo equivalente com Nginx:

```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}
```

Depois rode `sudo certbot --nginx -d seu-dominio.com.br` para o SSL.

## 7. Webhook do uazapi

Após colocar no domínio, configure o webhook do uazapi para:

```
https://seu-dominio.com.br/api/public/uazapi-webhook
```

## 8. Comandos úteis

```bash
docker compose ps              # status
docker compose restart app     # reiniciar
docker compose down            # parar
docker compose logs -f app     # logs
docker stats clear-selfie-hub  # uso de CPU/RAM
```

## Solução de problemas

- **Porta 3000 ocupada**: troque o mapeamento em `docker-compose.yml` para
  `"8080:3000"` (host:container).
- **Build falha por memória**: VPS pequenas (1 GB) podem precisar de swap.
  Crie 2 GB de swap antes do `docker compose up`.
- **Câmera não funciona em HTTP**: o navegador exige HTTPS para acessar a
  câmera. Sempre use o passo 6 (domínio + SSL) em produção.