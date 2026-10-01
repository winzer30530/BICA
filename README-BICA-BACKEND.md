# BICA ONE backend status

Supabase project: `bica's project`

The database includes students, courses, batches, fees, attendance, exams, results, certificates, lab devices, maintenance, documents, agent runs/actions, audit logs and settings.

The Netlify agent endpoint now exposes typed tools for student search/create/update, courses, fees, attendance, exams/questions/results, with approval required for writes and verification-oriented instructions.

Database access is protected by Supabase RLS. The service-role key must never be placed in the browser.

The management agent requires a BICA staff Supabase session. The public/open UI does not make private student data public.

Remaining work: connect the Netlify frontend to the new project, finish management screens, add staff provisioning/admin UX, document processing/OCR, certificate PDF generation, Photopea/PSD workflow, and the Windows Electron computer-control companion.
