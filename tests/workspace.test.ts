import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSeed } from '../src/data/seed';
import { parseBackup, parseWorkspace, meetingSchema, safeUrl } from '../src/types/workspace';
import { chronological, meetingTime, isUpcoming } from '../src/lib/time';
import { flatten, progress, updateTopic, deleteTopic } from '../src/lib/roadmap';
import { executeCommand, commands } from '../src/features/terminal/commands';
import { localRepository, STORAGE_KEY } from '../src/lib/storage';

afterEach(() => vi.unstubAllGlobals());
describe('Validated workspace boundary', () => {
  it('roundtrips seed data without fabricated date, link or biography', () => {
    const data = createSeed();
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
    expect(data.meetings[0]).toMatchObject({ date: '', time: '', zoomUrl: '' });
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:password@example.com',
    'not-a-url',
  ])('rejects unsafe URL %s', (url) => expect(safeUrl.safeParse(url).success).toBe(false));
  it('accepts empty or ordinary HTTP URL', () => {
    expect(safeUrl.parse('')).toBe('');
    expect(safeUrl.parse('https://example.com')).toBe('https://example.com');
  });
  it('rejects malformed, oversized and unknown-version backups', () => {
    expect(() => parseBackup('{')).toThrow();
    expect(() => parseBackup(' '.repeat(2_000_001))).toThrow();
    expect(() => parseWorkspace({ ...createSeed(), version: 2 })).toThrow();
  });
  it('rejects duplicate topic and meeting IDs', () => {
    const data = createSeed();
    data.roadmap.push(data.roadmap[0]);
    expect(() => parseWorkspace(data)).toThrow(/идентификатор/);
    const next = createSeed();
    next.meetings.push(next.meetings[0]);
    expect(() => parseWorkspace(next)).toThrow(/идентификатор/);
  });
  it('bounds recursive imports', () => {
    const data = createSeed();
    let topic = data.roadmap[0];
    for (let i = 0; i < 11; i++) {
      topic.children = [{ ...topic, id: `deep-${i}`, children: [] }];
      topic = topic.children[0];
    }
    expect(() => parseWorkspace(data)).toThrow(/уровней/);
  });
  it('rejects incomplete dates, impossible dates, invalid zone and DST gaps/folds', () => {
    const m = createSeed().meetings[0];
    for (const change of [
      { date: '2026-10-12' },
      { date: '2026-02-30', time: '10:00' },
      { timezone: 'Mars/Olympus' },
      { date: '2026-03-08', time: '02:30', timezone: 'America/New_York' },
      { date: '2026-11-01', time: '01:30', timezone: 'America/New_York' },
    ]) {
      expect(meetingSchema.safeParse({ ...m, ...change }).success).toBe(false);
    }
  });
});
describe('Calendar and roadmap behavior', () => {
  it('sorts across IANA zones, leaving undated sessions last', () => {
    const draft = createSeed().meetings[0];
    const early = { ...draft, date: '2030-01-01', time: '10:00', timezone: 'Asia/Tbilisi' };
    const late = { ...early, timezone: 'UTC' };
    expect([draft, late, early].sort(chronological)).toEqual([early, late, draft]);
    expect(meetingTime(early)?.toUTC().hour).toBe(6);
    expect(isUpcoming(early)).toBe(true);
    expect(isUpcoming({ ...early, status: 'canceled' })).toBe(false);
  });
  it('tracks leaf progress, immutable child editing and recursive deletion', () => {
    const data = createSeed();
    const child = data.roadmap[0].children[0];
    const changed = updateTopic(data.roadmap, child.id, (t) => ({ ...t, status: 'completed' }));
    expect(progress(changed).done).toBe(1);
    expect(progress(data.roadmap).done).toBe(0);
    const rootComplete = updateTopic(data.roadmap, data.roadmap[0].id, (t) => ({
      ...t,
      status: 'completed',
    }));
    expect(progress(rootComplete).done).toBe(0);
    const removed = deleteTopic(changed, data.roadmap[0].id);
    expect(flatten(removed).some((t) => t.id === child.id)).toBe(false);
    expect(progress([]).percent).toBe(0);
  });
});
describe('Persistence recovery', () => {
  it('does not overwrite corrupt data while loading', () => {
    const storage = { getItem: () => '{broken', setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    expect(localRepository.load().blocked).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('saves validated data and reloads it', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    });
    const data = createSeed();
    data.profile.headline = 'Настроенный профиль';
    localRepository.save(data);
    expect(map.has(STORAGE_KEY)).toBe(true);
    expect(localRepository.load().data.profile.headline).toBe(data.profile.headline);
  });
});
describe('Terminal command registry', () => {
  it('covers all advertised commands', () => {
    for (const command of commands)
      expect(executeCommand(command.name).lines).toBeInstanceOf(Array);
    expect(executeCommand('help').lines.length).toBe(commands.length + 1);
  });
  it('treats shell syntax and JavaScript as plain text', () => {
    expect(executeCommand('echo $(rm -rf /); <script>alert(1)</script>').lines[0].text).toBe(
      '$(rm -rf /); <script>alert(1)</script>',
    );
    expect(executeCommand('process.exit(1)').lines[0].tone).toBe('warning');
    expect(executeCommand('ls && pwd').lines[0].tone).toBe('warning');
  });
  it('clear and deployment return local rendering instructions only', () => {
    expect(executeCommand('clear').clear).toBe(true);
    expect(executeCommand('deploy --dry-run').pipeline).toBe(true);
  });
});
