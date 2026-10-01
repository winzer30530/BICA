# BICA ONE (foundation)
Electron + React + TS desktop app, OpenAI Agents SDK in the main process, Supabase (RLS) for data.
## Run
1. `cp .env.example .env` and fill OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
2. Apply `supabase/migrations/0001_schema.sql`; create 2 auth users and matching `profiles` rows (role owner/teacher)
3. `npm install && npm run dev`
## Real vs. not yet
Real: secure Electron shell (contextIsolation, sandbox, CSP, no secrets in renderer), sign-in, hamburger nav, agent loop with human approval + audit, 3 DB tools (search students, pending fees, record fee w/ read-back), full schema + RLS.
Not yet: computer control (interface only, `packages/agent/src/computer.ts`), Office/PDF generation, OCR, voice, printing, remaining screens/tools, tests. OpenAI usage is billed by your OpenAI account; BICA adds no limits of its own.
