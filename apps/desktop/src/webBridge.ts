// Browser implementation of window.bica (used on Netlify). Electron's preload defines it instead.
import { createClient } from '@supabase/supabase-js';

if (!(window as any).bica) {
  const url = import.meta.env.VITE_SUPABASE_URL as string, key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const sb = url && key ? createClient(url, key) : null;
  const listeners = new Set<(e: any) => void>();
  const emit = (e: any) => listeners.forEach(l => l(e));
  const waiting = new Map<string, (ok: boolean) => void>();

  (window as any).bica = {
    async signIn(email: string, password: string) {
      if (!sb) return { ok: false, error: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.' };
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      const p = await sb.from('profiles').select('role,full_name').eq('id', data.user.id).single();
      if (p.error) return { ok: false, error: 'Signed in, but this account has no staff profile.' };
      return { ok: true, name: p.data.full_name, role: p.data.role };
    },
    async signOut() { await sb?.auth.signOut(); },
    onAgentEvent(cb: (e: any) => void) { listeners.add(cb); return () => listeners.delete(cb); },
    answerConfirm: async (id: string, ok: boolean) => { waiting.get(id)?.(ok); waiting.delete(id); },
    async runAgent(prompt: string) {
      try {
        const token = (await sb?.auth.getSession())?.data.session?.access_token;
        if (!token) throw new Error('Not signed in');
        let body: any = { prompt };
        for (let turn = 0; turn < 8; turn++) {
          const res = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
          const out = await res.json();
          if (!res.ok || out.type === 'error') throw new Error(out.text ?? `Server error ${res.status}`);
          if (out.type === 'final') { emit({ type: 'final', text: out.text }); return { ok: true }; }
          const id = crypto.randomUUID();
          emit({ type: 'confirm', id, tool: out.tool, args: out.args });
          const ok = await new Promise<boolean>(r => waiting.set(id, r));
          body = { state: out.state, approve: ok };
        }
        throw new Error('Too many approval rounds');
      } catch (e) { emit({ type: 'error', text: e instanceof Error ? e.message : String(e) }); return { ok: false }; }
    },
  };
}
