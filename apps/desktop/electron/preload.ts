import { contextBridge, ipcRenderer } from 'electron';

// The ONLY surface the renderer can touch. No secrets, no fs, no raw ipcRenderer.
contextBridge.exposeInMainWorld('bica', {
  signIn: (email: string, password: string) => ipcRenderer.invoke('auth:signIn', email, password),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  runAgent: (prompt: string) => ipcRenderer.invoke('agent:run', prompt),
  answerConfirm: (id: string, ok: boolean) => ipcRenderer.invoke('agent:answer', id, ok),
  onAgentEvent: (cb: (e: unknown) => void) => {
    const h = (_: unknown, e: unknown) => cb(e);
    ipcRenderer.on('agent:event', h);
    return () => ipcRenderer.removeListener('agent:event', h);
  },
});
