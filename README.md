# PontoGestor — Guia de Deploy

## Estrutura do repositório

```
pontogestor/
├── public/
│   └── index.html          ← Frontend completo
├── netlify/
│   └── functions/
│       ├── auth-login.js   ← API de login
│       ├── tenants.js      ← API de empresas
│       ├── colaboradores.js
│       ├── registros.js    ← API de ponto
│       ├── documentos.js
│       └── ajustes-assinaturas.js
├── netlify.toml            ← Config Netlify
├── package.json
├── database.sql            ← Execute no Neon
└── README.md
```

---

## Passo 1 — Configurar o banco Neon

1. Acesse **console.neon.tech**
2. Abra seu projeto → clique em **SQL Editor**
3. Cole todo o conteúdo de `database.sql` e execute
4. Copie a **Connection String** (formato: `postgresql://user:pass@host/db?sslmode=require`)

---

## Passo 2 — Subir para o GitHub

1. Crie um repositório no GitHub (pode ser privado)
2. Suba todos os arquivos desta pasta
3. Certifique-se que a estrutura de pastas está correta

---

## Passo 3 — Conectar ao Netlify

1. Acesse **app.netlify.com**
2. Clique em **Add new site → Import an existing project**
3. Conecte seu repositório GitHub
4. Configurações de build:
   - **Base directory:** (deixe vazio)
   - **Build command:** `npm install`
   - **Publish directory:** `public`
5. Clique em **Deploy site**

---

## Passo 4 — Variáveis de ambiente no Netlify

1. No painel do site → **Site configuration → Environment variables**
2. Adicione as seguintes variáveis:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Sua connection string do Neon |
| `JWT_SECRET` | Uma senha forte qualquer (ex: `PontoGestor@2025#Seguro`) |

3. Clique em **Deploy → Trigger deploy**

---

## Passo 5 — Criar sua conta de acesso

Após o deploy, acesse o SQL Editor do Neon e execute:

```sql
-- Trocar a senha do Super Admin (hash bcrypt de 'admin123')
UPDATE usuarios SET senha_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'weslei@confiance.com.br';

-- Criar suas empresas
INSERT INTO tenants (nome, cnpj, segmento) VALUES
('Confiance Gestão Contábil', '12.345.678/0001-90', 'Contabilidade'),
('UpOut Soluções Financeiras', '98.765.432/0001-10', 'Financeiro'),
('YNYX Group', '11.222.333/0001-44', 'Tecnologia');
```

---

## Credenciais iniciais (modo demo)

O sistema funciona em modo demo mesmo sem banco configurado:

| Perfil | E-mail | Senha |
|---|---|---|
| Super Admin | weslei@confiance.com.br | admin123 |
| Admin | ana@confiance.com.br | 123456 |
| Colaborador | carlos@confiance.com.br | 123456 |

---

## Observações importantes

- O frontend funciona em **modo demo** (dados locais) se a API não estiver disponível
- Quando a API estiver ativa, os dados são salvos no Neon automaticamente
- Para gerar senhas bcrypt para novos usuários: use `https://bcrypt.online`
