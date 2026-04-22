# Live Subtitle Interpreter MVP

## Local setup

1. Frontend env is already prepared in `.env`
2. Fill real values into `server/.env`
3. Run the SQL below in Supabase SQL editor
4. Start backend and frontend

## Supabase SQL

```sql
create table sessions (
  id text primary key,
  session_title text,
  contact_name text,
  company_name text,
  source_lang text,
  target_lang text,
  created_at timestamptz default now(),
  ended_at timestamptz,
  duration text,
  total_messages integer default 0
);

create table messages (
  id text primary key,
  session_id text references sessions(id),
  speaker_role text,
  original_text text,
  translated_text text,
  timestamp timestamptz default now()
);
```

## Run commands

Backend:

```bash
cd server
npm install
npm start
```

Frontend:

```bash
npm install
npm run dev
```

## Required values

- `server/.env`
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `FRONTEND_URL`
- root `.env`
  - `VITE_API_URL=http://localhost:3001`

## CORS note

- `FRONTEND_URL` can be a single URL or multiple comma-separated URLs
- Example:
  - `FRONTEND_URL=https://your-app.vercel.app,https://your-app-git-main-your-team.vercel.app`

## GitHub upload checklist

1. Do not commit `.env` or `server/.env`
2. Push code only
3. Use GitHub Actions secrets only for workflows
4. Use deployment platform environment variables for the running app

## Recommended GitHub secrets

If you later add deployment workflows, create these in:
`Settings > Secrets and variables > Actions`

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `VITE_API_URL`

## Important

- GitHub Advanced Security secret scanning detects leaked secrets
- It is not the runtime config source for your app
- Vercel and Render should each store their own environment variables
