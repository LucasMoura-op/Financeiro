# NegociosX

Calculadora profissional para analisar oportunidades em studios para Airbnb, locais de eventos e imoveis de leilao.

## O que o sistema faz

- Cadastra oportunidades de negocio.
- Compara modelos de Airbnb, eventos e leilao.
- Calcula receita mensal, lucro, margem, cap rate, payback e score.
- Permite editar, duplicar, filtrar e remover cenarios.
- Salva os dados no navegador para uso imediato no prototipo.
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

## Supabase

O prototipo atual nao depende de Supabase. Quando a plataforma precisar de usuarios, times e dados sincronizados, crie as variaveis abaixo na Vercel e no `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Importante: `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser usada em componentes client-side. Ela deve ficar apenas em rotas server-side, actions ou jobs protegidos.

Tabelas recomendadas para a proxima etapa:

- `profiles`
- `organizations`
- `organization_members`
- `business_scenarios`
- `scenario_assumptions`
- `scenario_versions`

Ative RLS em todas as tabelas e permita acesso apenas aos membros da organizacao dona do registro.
