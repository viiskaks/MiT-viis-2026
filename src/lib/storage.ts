import { createSeed } from '../data/seed';
import { parseBackup, parseWorkspace } from '../types/workspace';
import type { Workspace } from '../types/workspace';
export const STORAGE_KEY = 'mit-viis-2026.workspace.v1';
export interface WorkspaceRepository {
  load(): { data: Workspace; error: string; blocked: boolean };
  save(data: Workspace): void;
}
export const localRepository: WorkspaceRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return { data: raw ? parseBackup(raw) : createSeed(), error: '', blocked: false };
    } catch {
      return {
        data: createSeed(),
        error:
          'Локальные данные недоступны или повреждены. Они не перезаписаны. В настройках импортируйте резервную копию или подтвердите сброс.',
        blocked: true,
      };
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parseWorkspace(data)));
  },
};
export function downloadJson(data: Workspace) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
