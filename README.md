# Aureon Business Desk

Painel do Grupo Aureon, de Lucas Moura, para analisar oportunidades em studios para Airbnb, locais de eventos e imoveis de leilao.

## O que o sistema faz

- Cadastra estudos de investimento.
- Compara modelos de Airbnb, eventos e leilao.
- Calcula receita, caixa livre, margem, retorno operacional, retorno total, payback e score.
- Considera preco de compra, taxas de aquisicao, reforma/setup, capital de giro, custos fixos, parcelas, impostos/comissoes e valorizacao esperada.
- Permite editar, duplicar, filtrar e remover cenarios.
- Salva os dados no navegador para uso imediato no prototipo.
- Sincroniza estudos entre dispositivos quando Supabase esta configurado.
- Funciona sem backend, sem credenciais e sem dependencia externa.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Vercel

## Instalar

```bash
npm install
```

## Desenvolvimento local

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Validacao

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Deploy na Vercel

Use as configuracoes padrao da Vercel para Next.js:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: deixe vazio

O projeto nao usa `output: "export"`, `basePath` ou `assetPrefix`, porque isso e desnecessario na Vercel e pode quebrar assets/rotas quando o app evoluir.

## Supabase e sincronizacao

O app funciona localmente sem Supabase, mas para acessar os mesmos estudos em qualquer dispositivo e necessario configurar Supabase.

Crie as variaveis abaixo na Vercel e no `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Importante: `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser usada em componentes client-side. Ela deve ficar apenas em rotas server-side, actions ou jobs protegidos.

Execute o SQL em `supabase/migrations/001_aureon_workspaces.sql` no SQL Editor do Supabase.

No app, use o mesmo `Codigo do grupo` e a mesma `Chave de acesso` em qualquer dispositivo para carregar e salvar o mesmo conjunto de estudos.

A tabela nao possui policy anon de `insert` ou `update` com `true`. Escritas passam por funcoes RPC `security definer`, que validam a chave de acesso do grupo antes de criar, ler ou atualizar os dados.

Tabelas recomendadas para a proxima etapa:

- `aureon_workspaces`
- `profiles`
- `organizations`
- `organization_members`
- `business_scenarios`
- `scenario_assumptions`
- `scenario_versions`

Ative RLS em todas as tabelas e permita acesso apenas aos membros da organizacao dona do registro.
