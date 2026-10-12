import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage, parseWorkspace } from '../types/workspace';
import type { Topic, Workspace } from '../types/workspace';
import type { Account } from '../types/access';
import { api, ApiError } from '../lib/api';
import { Access } from '../features/Access';
import { updateTopic } from '../lib/roadmap';
interface State {
  data: Workspace;
  user: Account;
  canEdit: boolean;
  canInteract: boolean;
  error: string;
  saved: boolean;
  update: (fn: (data: Workspace) => Workspace) => Promise<boolean>;
  replace: (data: Workspace) => Promise<boolean>;
  setProgress: (id: string, status: Topic['status']) => Promise<boolean>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
interface Snapshot {
  data: Workspace;
  revision: number;
  progress: Record<string, Topic['status']>;
}
const Context = createContext<State | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = useRef<Snapshot | null>(null);
  const saving = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  function failure(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      setUser(null);
      setSnapshot(null);
      current.current = null;
    }
    setError(errorMessage(e));
  }
  async function refresh() {
    try {
      const session = await api<{ user: Account }>('/session');
      const next = await api<Snapshot>('/workspace');
      next.data = parseWorkspace(next.data);
      current.current = next;
      setSnapshot(next);
      setUser(session.user);
      setError('');
    } catch (e) {
      failure(e);
    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await api<{ user: Account }>('/session');
        const next = await api<Snapshot>('/workspace');
        next.data = parseWorkspace(next.data);
        if (active) {
          current.current = next;
          setSnapshot(next);
          setUser(session.user);
        }
      } catch (e) {
        if (active && !(e instanceof ApiError && e.status === 401)) setError(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function login(username: string, password: string) {
    setError('');
    try {
      await api('/login', 'POST', { username, password });
      await refresh();
    } catch (e) {
      failure(e);
    }
  }
  async function logout() {
    try {
      await api('/logout', 'POST', {});
      setUser(null);
      setSnapshot(null);
      current.current = null;
      setError('');
    } catch (e) {
      failure(e);
    }
  }
  async function commit(next: Workspace) {
    if (user?.role !== 'owner' || !current.current || saving.current) return false;
    saving.current = true;
    setSaved(false);
    try {
      next = parseWorkspace(next);
      const result = await api<{ revision: number }>('/workspace', 'PUT', {
        data: next,
        revision: current.current.revision,
      });
      const value = { ...current.current, data: next, revision: result.revision };
      current.current = value;
      setSnapshot(value);
      setError('');
      setSaved(true);
      return true;
    } catch (e) {
      failure(e);
      return false;
    } finally {
      saving.current = false;
    }
  }
  async function setProgress(id: string, status: Topic['status']) {
    if (!current.current || saving.current) return false;
    if (user?.role === 'owner')
      return commit({
        ...current.current.data,
        roadmap: updateTopic(current.current.data.roadmap, id, (topic) => ({ ...topic, status })),
      });
    if (!user?.canInteract) return false;
    saving.current = true;
    setSaved(false);
    try {
      await api('/progress', 'PUT', { topicId: id, status });
      const value = { ...current.current, progress: { ...current.current.progress, [id]: status } };
      current.current = value;
      setSnapshot(value);
      setSaved(true);
      setError('');
      return true;
    } catch (e) {
      failure(e);
      return false;
    } finally {
      saving.current = false;
    }
  }
  if (!user || !snapshot) return <Access login={login} loading={loading} error={error} />;
  const personal = (topics: Topic[]): Topic[] =>
    topics.map((topic) => ({
      ...topic,
      status: snapshot.progress[topic.id] ?? 'planned',
      children: personal(topic.children),
    }));
  const data =
    user.role === 'owner'
      ? snapshot.data
      : { ...snapshot.data, roadmap: personal(snapshot.data.roadmap) };
  return (
    <Context.Provider
      value={{
        data,
        user,
        canEdit: user.role === 'owner',
        canInteract: user.role === 'owner' || user.canInteract,
        error,
        saved,
        update: (fn) =>
          current.current ? commit(fn(current.current.data)) : Promise.resolve(false),
        replace: commit,
        setProgress,
        refresh,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider missing');
  return value;
}
