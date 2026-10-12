import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { localRepository } from '../lib/storage';
import { errorMessage, parseWorkspace } from '../types/workspace';
import type { Workspace } from '../types/workspace';
interface State {
  data: Workspace;
  error: string;
  saved: boolean;
  update: (fn: (data: Workspace) => Workspace) => boolean;
  replace: (data: Workspace) => boolean;
}
const Context = createContext<State | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => localRepository.load());
  const [data, setData] = useState(initial.data);
  const current = useRef(data);
  const [error, setError] = useState(initial.error);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [saved, setSaved] = useState(!initial.blocked);
  function commit(next: Workspace, recovery = false) {
    if (blocked && !recovery) {
      setError(initial.error || 'Сначала восстановите данные в настройках.');
      return false;
    }
    try {
      next = parseWorkspace(next);
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
    try {
      localRepository.save(next);
      setSaved(true);
      setError('');
      setBlocked(false);
    } catch {
      setSaved(false);
      setError(
        'Изменения только в памяти: браузер не смог сохранить их. Экспортируйте JSON до закрытия страницы.',
      );
    }
    current.current = next;
    setData(next);
    return true;
  }
  return (
    <Context.Provider
      value={{
        data,
        error,
        saved,
        update: (fn) => commit(fn(current.current)),
        replace: (next) => commit(next, true),
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
