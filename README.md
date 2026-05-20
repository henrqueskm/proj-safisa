# SafisaApp

Aplicação React/Vite com API Express e persistência em MySQL.

## Pré-requisitos

- Node.js 20+
- MySQL 8+
- npm

## Configurar o MySQL

Crie o banco e o usuário no MySQL. Ajuste a senha antes de usar em produção:

```sql
CREATE DATABASE safisa_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'safisa'@'%' IDENTIFIED BY 'troque_esta_senha';
GRANT ALL PRIVILEGES ON safisa_app.* TO 'safisa'@'%';
FLUSH PRIVILEGES;
```

O servidor cria as tabelas automaticamente na inicialização. Se preferir provisionar manualmente, rode o arquivo `mysql_schema.sql` no banco `safisa_app`.

## Variáveis de ambiente

Crie um arquivo `.env.local` ou exporte as variáveis no terminal:

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=safisa
MYSQL_PASSWORD=troque_esta_senha
MYSQL_DATABASE=safisa_app
PORT=3000
# Opcional se o frontend estiver hospedado em outro domínio:
# VITE_API_BASE_URL=http://localhost:3000
# Opcional para mudar o intervalo de sincronização da UI, em ms:
# VITE_MYSQL_POLL_INTERVAL=5000
```

Também é possível usar uma URL única:

```bash
DATABASE_URL=mysql://safisa:troque_esta_senha@127.0.0.1:3306/safisa_app
```

## Rodar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Suba o MySQL e confirme as variáveis de ambiente.
3. Inicie o app:

   ```bash
   npm run dev
   ```

4. Abra `http://localhost:3000`.

## Migração de dados do Supabase

As tabelas foram mantidas no mesmo modelo documental usado anteriormente (`id` + `data` JSON). Para migrar dados existentes:

1. Exporte os dados do Supabase em JSON/CSV mantendo `id` e `data`.
2. Importe cada tabela equivalente no MySQL (`users`, `orders`, `assembledunits`, `kits`, `kitdata`, `servomodeldata`, `customers`, `kitimages`, `auditlogs`, `messages`, `config`).
3. Garanta que `data` seja JSON válido.
4. Reinicie `npm run dev` e acesse a aplicação.

Uploads de imagens agora são salvos localmente em `uploads/<bucket>/<arquivo>` e servidos por `/uploads/...`.
