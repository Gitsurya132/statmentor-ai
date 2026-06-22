# StatMentor AI Web

## Run locally

```bash
cd apps/web
cp .env.local.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The FastAPI backend must be available at
`http://localhost:8000/api/v1`. Change `NEXT_PUBLIC_API_BASE_URL` in
`.env.local` if needed.

## Quality checks

```bash
pnpm typecheck
pnpm exec eslint .
pnpm build
```
