import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApi } from '../server/api';
import { openStore, createUser, digest } from '../server/store';
const origin = 'http://localhost:5174';
const password = 'fixture-password-only-12345';
let db: ReturnType<typeof openStore>;
let server: Awaited<ReturnType<typeof createApi>>;
let endpoint: string;
let owner: string;
let mentee: string;
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  cookie = '',
  requestOrigin = origin,
) {
  return fetch(endpoint + path, {
    method,
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Cookie: cookie },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function login(username: string) {
  const res = await request('/api/login', 'POST', { username, password });
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0];
}
beforeEach(async () => {
  db = openStore(':memory:');
  await createUser(db, 'owner', 'Owner fixture', password, 'owner');
  await createUser(db, 'mentee', 'Mentee fixture', password, 'mentee');
  server = await createApi(db, origin);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  owner = await login('owner');
  mentee = await login('mentee');
}, 15000);
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
});
describe('server-enforced access', () => {
  it('denies anonymous content, forged cookies, writes and user management', async () => {
    for (const [path, method] of [
      ['/api/workspace', 'GET'],
      ['/api/workspace', 'PUT'],
      ['/api/users', 'GET'],
      ['/api/users', 'POST'],
      ['/api/progress', 'PUT'],
    ]) {
      expect(
        (await request(path, method, method === 'GET' ? undefined : {}, 'mit_dev_session=owner'))
          .status,
      ).toBe(401);
    }
    expect((await request('/api/register', 'POST', {})).status).toBe(401);
  });
  it('lets owner save validated shared data and rejects lost updates', async () => {
    const snapshot = await (await request('/api/workspace', 'GET', undefined, owner)).json();
    snapshot.data.meetings[0].title = 'Owner edit';
    expect(
      (
        await request(
          '/api/workspace',
          'PUT',
          { revision: snapshot.revision, data: snapshot.data },
          owner,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          '/api/workspace',
          'PUT',
          { revision: snapshot.revision, data: snapshot.data },
          owner,
        )
      ).status,
    ).toBe(409);
    const read = await (await request('/api/workspace', 'GET', undefined, mentee)).json();
    expect(read.data.meetings[0].title).toBe('Owner edit');
    expect(
      (await request('/api/workspace', 'PUT', { revision: read.revision, data: {} }, owner)).status,
    ).toBe(400);
  });
  it('denies mentee shared edits and privilege escalation even via direct API calls', async () => {
    expect((await request('/api/workspace', 'PUT', {}, mentee)).status).toBe(403);
    expect(
      (
        await request(
          '/api/users',
          'POST',
          { username: 'attacker', name: 'x', password, role: 'owner' },
          mentee,
        )
      ).status,
    ).toBe(403);
    expect((await request('/api/users', 'GET', undefined, mentee)).status).toBe(403);
    expect(
      (
        await request(
          '/api/users',
          'POST',
          { username: 'extra', name: 'x', password, role: 'owner' },
          owner,
        )
      ).status,
    ).toBe(400);
  });
  it('gates and isolates personal progress, revokes sessions when access changes', async () => {
    const snap = await (await request('/api/workspace', 'GET', undefined, mentee)).json();
    const topicId = snap.data.roadmap[0].children[0].id;
    const patch = { topicId, status: 'completed' };
    expect((await request('/api/progress', 'PUT', patch, mentee)).status).toBe(403);
    const users = await (await request('/api/users', 'GET', undefined, owner)).json();
    const student = users.users.find((u: { role: string }) => u.role === 'mentee');
    expect(JSON.stringify(users)).not.toContain('password');
    expect(
      (
        await request(
          `/api/users/${student.id}`,
          'PATCH',
          { enabled: true, canInteract: true },
          owner,
        )
      ).status,
    ).toBe(200);
    expect((await request('/api/session', 'GET', undefined, mentee)).status).toBe(401);
    mentee = await login('mentee');
    expect(
      (await request('/api/progress', 'PUT', { ...patch, userId: 'someone-else' }, mentee)).status,
    ).toBe(400);
    expect((await request('/api/progress', 'PUT', patch, mentee)).status).toBe(200);
    const personal = await (await request('/api/workspace', 'GET', undefined, mentee)).json();
    const mentor = await (await request('/api/workspace', 'GET', undefined, owner)).json();
    expect(personal.progress[topicId]).toBe('completed');
    expect(mentor.progress).toEqual({});
    expect(mentor.data).toEqual(snap.data);
    await request(
      `/api/users/${student.id}`,
      'PATCH',
      { enabled: false, canInteract: false },
      owner,
    );
    expect((await request('/api/progress', 'PUT', patch, mentee)).status).toBe(401);
    expect((await request('/api/login', 'POST', { username: 'mentee', password })).status).toBe(
      401,
    );
  });
  it('rejects cross-origin mutations and non-JSON requests', async () => {
    expect(
      (
        await request(
          '/api/login',
          'POST',
          { username: 'owner', password },
          '',
          'https://evil.example',
        )
      ).status,
    ).toBe(403);
    expect((await request('/api/logout', 'POST', {}, owner, 'https://evil.example')).status).toBe(
      403,
    );
    const result = await fetch(endpoint + '/api/workspace', {
      method: 'PUT',
      headers: { Origin: origin, Cookie: owner, 'Content-Type': 'text/plain' },
      body: '{}',
    });
    expect(result.status).toBe(415);
  });
  it('expires sessions, uses HttpOnly cookies and stores only token hashes', async () => {
    const response = await request('/api/login', 'POST', { username: 'owner', password });
    const header = response.headers.get('set-cookie')!;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    const token = header.split(';')[0].split('=')[1];
    expect(db.prepare('SELECT token FROM sessions WHERE token=?').get(token)).toBeUndefined();
    expect(db.prepare('SELECT token FROM sessions WHERE token=?').get(digest(token))).toBeTruthy();
    db.prepare('UPDATE sessions SET expires=0').run();
    expect((await request('/api/session', 'GET', undefined, owner)).status).toBe(401);
  });
  it('enforces login throttling without revealing whether an account exists', async () => {
    for (let i = 0; i < 8; i++)
      expect((await request('/api/login', 'POST', { username: 'missing', password })).status).toBe(
        401,
      );
    expect((await request('/api/login', 'POST', { username: 'missing', password })).status).toBe(
      429,
    );
  });
  it('allows password changes and invalidates all existing sessions', async () => {
    expect(
      (
        await request(
          '/api/password',
          'POST',
          { current: password, password: 'new-fixture-password-12345' },
          mentee,
        )
      ).status,
    ).toBe(200);
    expect((await request('/api/session', 'GET', undefined, mentee)).status).toBe(401);
    expect((await request('/api/login', 'POST', { username: 'mentee', password })).status).toBe(
      401,
    );
    expect(
      (
        await request('/api/login', 'POST', {
          username: 'mentee',
          password: 'new-fixture-password-12345',
        })
      ).status,
    ).toBe(200);
  });
  it('rejects unsafe public origins and uses Secure host-only cookies in production', async () => {
    await expect(createApi(db, 'http://public.example')).rejects.toThrow('HTTPS');
    const tls = await createApi(db, 'https://private.example');
    tls.listen(0, '127.0.0.1');
    await once(tls, 'listening');
    try {
      const res = await fetch(`http://127.0.0.1:${(tls.address() as AddressInfo).port}/api/login`, {
        method: 'POST',
        headers: { Origin: 'https://private.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password }),
      });
      expect(res.headers.get('set-cookie')).toContain('__Host-mit_session=');
      expect(res.headers.get('set-cookie')).toContain('; Secure');
      expect(res.headers.get('set-cookie')).not.toContain('Domain=');
    } finally {
      tls.closeAllConnections();
      await new Promise<void>((resolve) => tls.close(() => resolve()));
    }
  });
});

it('persists accounts and shared data across a database reopen', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = mkdtempSync(join(tmpdir(), 'mit-persistence-'));
  try {
    const filename = join(directory, 'test.sqlite');
    const first = openStore(filename);
    await createUser(first, 'persisted', 'Persistence fixture', password, 'owner');
    const snapshot = JSON.parse(
      (first.prepare('SELECT data FROM workspace').get() as { data: string }).data,
    );
    snapshot.meetings[0].title = 'Saved before restart';
    first
      .prepare('UPDATE workspace SET data=?,revision=2 WHERE id=1')
      .run(JSON.stringify(snapshot));
    first.close();
    const reopened = openStore(filename);
    try {
      expect(reopened.prepare('SELECT username FROM users').get()?.username).toBe('persisted');
      expect(
        JSON.parse((reopened.prepare('SELECT data FROM workspace').get() as { data: string }).data)
          .meetings[0].title,
      ).toBe('Saved before restart');
      expect(reopened.prepare('SELECT revision FROM workspace').get()?.revision).toBe(2);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
