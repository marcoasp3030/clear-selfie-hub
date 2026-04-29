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

## 6. Colocar atrás do domínio `facial.nutricarbrasil.com.br` + HTTPS

### 6.1 DNS

No painel do seu registrador (onde está `nutricarbrasil.com.br`), crie um
registro **A**:

| Tipo | Nome     | Valor              | TTL  |
|------|----------|--------------------|------|
| A    | facial   | IP_PUBLICO_DA_VPS  | 3600 |

Aguarde a propagação (verifique em https://dnschecker.org buscando
`facial.nutricarbrasil.com.br`).

### 6.2 Proxy reverso + SSL automático (recomendado: Caddy)

Caddy é o caminho mais rápido — ele cuida do certificado Let's Encrypt sozinho.

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```

Conteúdo do `Caddyfile`:

```
facial.nutricarbrasil.com.br {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

Pronto. Acesse `https://facial.nutricarbrasil.com.br/` — o SSL é emitido
automaticamente em poucos segundos.

### 6.3 Alternativa com Nginx + Certbot

```nginx
# /etc/nginx/sites-available/facial.nutricarbrasil.com.br
server {
    listen 80;
    server_name facial.nutricarbrasil.com.br;

    client_max_body_size 20M;   # uploads de foto

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

```bash
sudo ln -s /etc/nginx/sites-available/facial.nutricarbrasil.com.br \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d facial.nutricarbrasil.com.br
```

### 6.4 Firewall

```bash
sudo ufw allow 80
sudo ufw allow 443
# NÃO abra a 3000 publicamente — o proxy já cuida disso
```

## 7. Webhook do uazapi

No painel do uazapi, configure o webhook para:

```
https://facial.nutricarbrasil.com.br/api/public/uazapi-webhook
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