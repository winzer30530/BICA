# Netlify environment

Set these in Netlify Site configuration → Environment variables:

- `OPENROUTER_API_KEY` — your server-side OpenRouter API key. Never put this in VITE_ variables.
- `OPENROUTER_MODEL` — optional; defaults to `openrouter/free` in the included function.
- `SUPABASE_URL` — `https://vnhplrlpveuirmydykfy.supabase.co`
- `SUPABASE_ANON_KEY` — Supabase legacy anon key from the project's API settings.
- `VITE_SUPABASE_URL` — `https://vnhplrlpveuirmydykfy.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the project's `sb_publishable_...` key.

The publishable/anon keys are intended for the browser; the OpenAI key is not.
