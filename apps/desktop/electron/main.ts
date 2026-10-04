import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runAgent, type Db, type Role } from '@bica/agent';

let win: BrowserWindow | null = null;
let sb: SupabaseClient | null = null;
let role: Role = 'teacher';
const pending = new Map<string, (ok: boolean) => void>();
const send = (e: unknown) => win?.webContents.send('agent:event', e);

function client() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY are not set in .env');
  return (sb ??= createClient(url, key)); // anon key + user session => RLS enforced
}
const first = (m: string) => `${m}-01`;
function rows<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}
function makeDb(c: SupabaseClient): Db {
  return {
    async searchStudents({ course, name }) {
      let q = c.from('students').select('id,full_name,phone,status,courses(code)').limit(50);
      if (name) q = q.ilike('full_name', `%\${name}%\`);
      const list = rows(await q) as any[];
      return course ? list.filter(r => r.courses?.code?.toLowerCase() === course.toLowerCase()) : list;
    },
    async pendingFees({ month, course }) {
      const list = rows(await c.from('fee_payments').select('amount,status,students(id,full_name,courses(code))').eq('month', first(month)).eq('status', 'pending')) as any[];
      return course ? list.filter(r => r.students?.courses?.code?.toLowerCase() === course.toLowerCase()) : list;
    },
    async recordFee({ studentId, month, amount, status }) {
      const paid_on = status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
      rows(await c.from('fee_payments').upsert({ student_id: studentId, month: first(month), amount, status, paid_on }, { onConflict: 'student_id,month' }));
      return rows(await c.from('fee_payments').select('student_id,month,amount,status,paid_on').eq('student_id', studentId).eq('month', first(month)).single());
    },
    async listCourses() {
      return rows(await c.from('courses').select('id,code,name,fee,duration,modules').eq('active', true).order('code')) as unknown[];
    },
    async createStudent({ fullName, phone, guardianPhone, courseId, batchId, status }) {
      const result = rows(await c.from('students').insert({
        full_name: fullName,
        phone: phone ?? null,
        guardian_phone: guardianPhone ?? null,
        course_id: courseId ?? null,
        batch_id: batchId ?? null,
        status: status ?? 'active'
      }).select('id,full_name,phone,guardian_phone,course_id,batch_id,status').single());
      return result;
    },
    async updateStudent({ studentId, fullName, phone, guardianPhone, courseId, batchId, status }) {
      const patch: Record<string, unknown> = {};
      if (fullName !== undefined && fullName !== null) patch.full_name = fullName;
      if (phone !== undefined) patch.phone = phone;
      if (guardianPhone !== undefined) patch.guardian_phone = guardianPhone;
      if (courseId !== undefined) patch.course_id = courseId;
      if (batchId !== undefined) patch.batch_id = batchId;
      if (status !== undefined && status !== null) patch.status = status;
      return rows(await c.from('students').update(patch).eq('id', studentId).select('id,full_name,phone,guardian_phone,course_id,batch_id,status').single());
    },
    async recordAttendance({ studentId, day, status }) {
      rows(await c.from('attendance').upsert({ student_id: studentId, day, status }, { onConflict: 'student_id,day' }));
      return rows(await c.from('attendance').select('id,student_id,day,status').eq('student_id', studentId).eq('day', day).single());
    },
    async attendanceSummary({ studentId, month }) {
      let q = c.from('attendance').select('id,student_id,day,status').gte('day', `${month}-01`).lt('day', `${month}-32`);
      if (studentId) q = q.eq('student_id', studentId);
      return rows(await q);
    },
    async createExam({ courseId, title, kind, totalMarks, heldOn }) {
      return rows(await c.from('exams').insert({
        course_id: courseId ?? null,
        title,
        kind,
        total_marks: totalMarks ?? null,
        held_on: heldOn ?? null
      }).select('id,course_id,title,kind,total_marks,held_on').single());
    },
    async addQuestion({ examId, body, options, answer, marks }) {
      return rows(await c.from('exam_questions').insert({
        exam_id: examId,
        body,
        options: options ?? null,
        answer: answer ?? null,
        marks: marks ?? null
      }).select('id,exam_id,body,options,answer,marks').single());
    },
    async recordResult({ examId, studentId, marks }) {
      return rows(await c.from('exam_results').upsert(
        { exam_id: examId, student_id: studentId, marks },
        { onConflict: 'exam_id,student_id' }
      ).select('id,exam_id,student_id,marks').single());
    }
  };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 600, backgroundColor: '#F4F6F3',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => { if (!process.env.VITE_DEV) e.preventDefault(); });
  process.env.VITE_DEV ? win.loadURL('http://localhost:5173') : win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  ipcMain.handle('auth:signIn', async (_e, email: string, password: string) => {
    try {
      const c = client();
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      const p = await c.from('profiles').select('role,full_name').eq('id', data.user.id).single();
      if (p.error) return { ok: false, error: 'Signed in, but this account has no staff profile.' };
      role = p.data.role as Role;
      return { ok: true, name: p.data.full_name as string, role };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  });
  ipcMain.handle('auth:signOut', async () => { await sb?.auth.signOut(); sb = null; });
  ipcMain.handle('agent:answer', (_e, id: string, ok: boolean) => { pending.get(id)?.(ok === true); pending.delete(id); });
  ipcMain.handle('agent:run', async (_e, prompt: unknown) => {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) return { ok: false };
    if (!process.env.OPENAI_API_KEY) { send({ type: 'error', text: 'OPENAI_API_KEY is not set in .env' }); return { ok: false }; }
    const c = client();
    await runAgent({
      prompt, model: process.env.OPENAI_MODEL,
      ctx: { role, db: makeDb(c), audit: async a => { await c.from('agent_actions').insert({ tool: a.tool, args: a.args, ok: a.ok, detail: a.detail }); } },
      emit: send,
      confirm: req => new Promise(res => { const id = randomUUID(); pending.set(id, res); send({ type: 'confirm', id, ...req }); }),
    });
    return { ok: true };
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
