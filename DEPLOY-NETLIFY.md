# BICA ONE — Netlify deployment

## Mobile-friendly deployment
This archive is structured so `package.json` and `netlify.toml` are at the archive root. Upload the extracted project folder to Netlify or import it from GitHub.

## Required Netlify environment variables
- `OPENROUTER_API_KEY` — server-only OpenRouter API key. Never put this in VITE variables.
- `OPENROUTER_MODEL` — optional; defaults to `openrouter/free`.
- `SUPABASE_URL` — `https://vnhplrlpveuirmydykfy.supabase.co`
- `SUPABASE_ANON_KEY` — Supabase legacy anon key for the server-side authenticated client.
- `VITE_SUPABASE_URL` — same project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key for the browser.

## First staff account
Create the first user in Supabase Authentication, then add the matching row in `public.profiles` with role `owner` or `teacher`. This is intentionally not automated through a public endpoint because it would create an account-claiming security risk.

## Included web features
- Dashboard
- Staff login and role-aware navigation
- Student CRUD starter workflow
- Course management
- Fee records
- Attendance
- Exams
- Protected document storage
- Lab inventory
- Reports
- Owner audit log
- OpenAI Agents SDK agent with approval/resume state
- Agent run persistence
- AI reference-image analysis
- Photopea editable-design workspace and PSD export

## Important architecture boundary
The Netlify version is the browser/server version. Windows desktop automation, filesystem automation and native Office/Photoshop computer control require the Electron desktop build and a Windows machine. The web build does not pretend to control the user's computer.

## Verification note
The project files and ZIP structure are checked locally. A full `npm install`/Vite production build could not be completed in the build environment because registry access timed out, so do not treat this as a claim that Netlify's remote build has already passed.
