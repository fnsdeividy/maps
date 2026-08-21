# Deploy — MAPA Laudos

Guia para subir o sistema em um VPS Linux (Ubuntu 22.04/24.04).

> **Por que VPS e não Vercel?** O banco é SQLite (arquivo em disco). Plataformas
> serverless têm disco efêmero e perderiam os dados. Em um VPS o arquivo persiste,
> com backup simples. (Migrar para Postgres/Vercel é possível, mas não é o caminho
> mais rápido.)

## 0. Pré-requisitos

- Um VPS (DigitalOcean, Hetzner, Contabo, Hostinger etc.) — 1 vCPU / 1 GB RAM basta
- Um domínio apontando para o IP do VPS (registro A), ex.: `laudos.suaclinica.com.br`
- O código em um repositório git privado (GitHub/GitLab)

### Publicar o código (na sua máquina)

O projeto ainda não tem commits. Na raiz do projeto:

```bash
git add -A
git commit -m "chore: initial release"
# crie um repositório privado no GitHub e depois:
git remote add origin git@github.com:SEU_USUARIO/mapa-laudos.git
git push -u origin main
```

## 1. Preparar o servidor (como root)

```bash
apt update && apt upgrade -y

# Node.js 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs git

# PM2 (mantém o app rodando e reinicia após reboot)
npm install -g pm2

# Caddy (proxy reverso com HTTPS automático)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudflare.com/public/gpg.key' > /dev/null 2>&1 || true
curl -1sLf 'https://dl.cloudflare.com/public/caddy/gpg.key' > /dev/null 2>&1 || true
apt install -y caddy || {
  curl -1sLf 'https://dl.cloudflare.com/public/caddy/setup.deb.sh' | bash
  apt install -y caddy
}

# Usuário da aplicação
adduser --disabled-password --gecos "" mapa
```

## 2. Baixar o código e configurar

```bash
su - mapa
git clone git@github.com:SEU_USUARIO/mapa-laudos.git app
cd app
mkdir -p /home/mapa/data
```

Crie o `.env` de produção (`nano .env`):

```env
DATABASE_URL="file:/home/mapa/data/prod.db"
AUTH_SECRET="COLE_AQUI_O_RESULTADO_DE_openssl_rand"
AUTH_TRUST_HOST="true"
AUTH_DOCTOR_EMAIL="medico@suaclinica.com.br"
AUTH_DOCTOR_PASSWORD="TROQUE-POR-SENHA-FORTE"
AUTH_OPERATOR_EMAIL="operador@suaclinica.com.br"
AUTH_OPERATOR_PASSWORD="TROQUE-POR-OUTRA-SENHA-FORTE"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

Gere o segredo (rode e cole no `.env`):

```bash
openssl rand -base64 48
```

> `OPENAI_API_KEY` é opcional — sem ela o laudo usa o texto determinístico
> (fallback), que já funciona.

## 3. Instalar, migrar e buildar

```bash
cd /home/mapa/app
npm ci
npx prisma generate
npx prisma migrate deploy   # cria/atualiza o banco em /home/mapa/data/prod.db
npm run db:seed             # cria usuários (aprovador + operador) e frases
npm run build
```

## 4. Subir com PM2

```bash
pm2 start npm --name mapa-laudos -- start
pm2 save
exit   # volta para root
pm2 startup systemd -u mapa --hp /home/mapa   # rode a linha que ele imprimir
```

O app fica em `http://localhost:3000` dentro do servidor.

## 5. HTTPS com Caddy (como root)

Edite `/etc/caddy/Caddyfile` deixando só isto:

```
laudos.suaclinica.com.br {
    reverse_proxy localhost:3000
}
```

```bash
systemctl restart caddy
```

Pronto: `https://laudos.suaclinica.com.br` com certificado automático.

## 6. Backup do banco (essencial)

```bash
# como root
apt install -y sqlite3
crontab -e
```

Adicione (backup diário às 2h, mantém 30 dias):

```
0 2 * * * sqlite3 /home/mapa/data/prod.db ".backup /home/mapa/data/backup-$(date +\%F).db" && find /home/mapa/data -name 'backup-*.db' -mtime +30 -delete
```

Ideal: copie os backups para fora do servidor (rclone para Google Drive/S3).

## 7. Atualizar o sistema depois

```bash
su - mapa
cd app
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart mapa-laudos
```

## Checklist final

- [ ] `https://…` abre a tela de login
- [ ] Login do aprovador e do operador funcionam (senhas fortes no `.env`)
- [ ] Importar um `.awp` de teste e gerar laudo
- [ ] Fluxo: operador envia → aprovador recebe notificação → aprova/devolve
- [ ] Impressão do laudo aprovado (Ctrl/Cmd+P)
- [ ] Backup criado em `/home/mapa/data/` no dia seguinte

## Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| 502 no domínio | App caiu | `pm2 logs mapa-laudos` e `pm2 restart mapa-laudos` |
| Erro de login | `AUTH_SECRET` ausente/trocado | Confira o `.env` e reinicie |
| "Unable to open database" | Caminho do `DATABASE_URL` | Use caminho absoluto `file:/home/mapa/data/prod.db` e confira permissões |
| Nome antigo do usuário na tela | Sessão JWT antiga | Sair e entrar de novo |
