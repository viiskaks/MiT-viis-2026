import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { parseWorkspace, topicStatuses } from '../src/types/workspace';
import { flatten } from '../src/lib/roadmap';
import { account, createUser, digest, hashPassword, verifyPassword } from './store';
import type { Store, UserRow } from './store';
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
export const passwordSchema = z.string().min(14).max(128);
const loginSchema = z
  .object({ username: usernameSchema, password: z.string().min(1).max(128) })
  .strict();
const createSchema = z
  .object({
    username: usernameSchema,
    name: z.string().trim().min(1).max(100),
    password: passwordSchema,
  })
  .strict();
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw new HttpError(415, 'Нужен JSON');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new HttpError(413, 'Файл слишком большой');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, 'Некорректный JSON');
  }
}
export async function createApi(db: Store, origin: string) {
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new Error('APP_ORIGIN must be an HTTPS origin (HTTP is only allowed on localhost).');
  const secure = url.protocol === 'https:';
  const cookieName = secure ? '__Host-mit_session' : 'mit_dev_session';
  const cookie = (token: string, age = 28800) =>
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  // Unknown usernames still incur the same password derivation cost.
  const dummy = await hashPassword(randomBytes(32).toString('hex'));
  let hashing = 0;
  async function expensive<T>(fn: () => Promise<T>) {
    if (hashing >= 4) throw new HttpError(429, 'Попробуйте позже');
    hashing++;
    try {
      return await fn();
    } finally {
      hashing--;
    }
  }
  function limit(key: string, max: number) {
    const now = Date.now();
    db.prepare('DELETE FROM attempts WHERE expires < ?').run(now);
    db.prepare(
      'INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
    ).run(digest(key), now + 15 * 60_000);
    const row = db.prepare('SELECT count FROM attempts WHERE key=?').get(digest(key)) as {
      count: number;
    };
    if (row.count > max) throw new HttpError(429, 'Слишком много попыток. Подождите 15 минут.');
  }
  const server = createServer(async (req, res) => {
    try {
      const path = req.url?.split('?')[0];
      const method = req.method;
      if (method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
      if (!['GET', 'POST', 'PUT', 'PATCH'].includes(method ?? ''))
        throw new HttpError(405, 'Метод не поддерживается');
      if (
        method !== 'GET' &&
        (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site')
      )
        throw new HttpError(403, 'Запрос с другого сайта запрещён');
      const token =
        req.headers.cookie
          ?.split(';')
          .map((v) => v.trim())
          .find((v) => v.startsWith(`${cookieName}=`))
          ?.slice(cookieName.length + 1) ?? '';
      db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
      const user = db
        .prepare(
          'SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND enabled=1 AND expires>?',
        )
        .get(digest(token), Date.now()) as UserRow | undefined;
      if (method === 'POST' && path === '/api/login') {
        // Peer address only: no trust in client-supplied forwarded headers. Nginx has a separate IP limit.
        limit(`peer:${req.socket.remoteAddress}`, 60);
        const input = loginSchema.parse(await body(req));
        limit(`login:${input.username}`, 8);
        const candidate = db.prepare('SELECT * FROM users WHERE username=?').get(input.username) as
          UserRow | undefined;
        const valid = await expensive(() =>
          verifyPassword(input.password, candidate?.password ?? dummy),
        );
        if (!valid || !candidate?.enabled) throw new HttpError(401, 'Неверный логин или пароль');
        db.prepare('DELETE FROM attempts WHERE key=?').run(digest(`login:${input.username}`));
        db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
        const fresh = randomBytes(32).toString('base64url');
        db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
          digest(fresh),
          candidate.id,
          Date.now() + 8 * 3600_000,
        );
        res.setHeader('Set-Cookie', cookie(fresh));
        return send(res, 200, { user: account(candidate) });
      }
      if (!user) throw new HttpError(401, 'Войдите в пространство');
      const owner = () => {
        if (user.role !== 'owner')
          throw new HttpError(403, 'Только владелец может изменять общие данные');
      };
      if (method === 'GET' && path === '/api/session')
        return send(res, 200, { user: account(user) });
      if (method === 'POST' && path === '/api/logout') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
        res.setHeader('Set-Cookie', cookie('', 0));
        return send(res, 200, { ok: true });
      }
      if (method === 'POST' && path === '/api/password') {
        limit(`password:${user.id}`, 8);
        const input = z
          .object({ current: z.string().min(1).max(128), password: passwordSchema })
          .strict()
          .parse(await body(req));
        await expensive(async () => {
          if (!(await verifyPassword(input.current, user.password)))
            throw new HttpError(403, 'Текущий пароль неверен');
          const encoded = await hashPassword(input.password);
          db.prepare('UPDATE users SET password=? WHERE id=?').run(encoded, user.id);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        });
        res.setHeader('Set-Cookie', cookie('', 0));
        return send(res, 200, { ok: true });
      }
      if (path === '/api/workspace' && method === 'GET') {
        const row = db.prepare('SELECT data,revision FROM workspace WHERE id=1').get() as {
          data: string;
          revision: number;
        };
        const progress = Object.fromEntries(
          (
            db.prepare('SELECT topic_id,status FROM progress WHERE user_id=?').all(user.id) as {
              topic_id: string;
              status: string;
            }[]
          ).map((r) => [r.topic_id, r.status]),
        );
        return send(res, 200, { data: JSON.parse(row.data), revision: row.revision, progress });
      }
      if (path === '/api/workspace' && method === 'PUT') {
        owner();
        const input = z
          .object({ revision: z.number().int().positive(), data: z.unknown() })
          .strict()
          .parse(await body(req));
        let data;
        try {
          data = parseWorkspace(input.data);
        } catch {
          throw new HttpError(400, 'Некорректные данные workspace');
        }
        const result = db
          .prepare('UPDATE workspace SET data=?,revision=revision+1 WHERE id=1 AND revision=?')
          .run(JSON.stringify(data), input.revision);
        if (!result.changes)
          throw new HttpError(
            409,
            'Данные изменились в другой вкладке. Обновите страницу и повторите правку.',
          );
        return send(res, 200, { revision: input.revision + 1 });
      }
      if (path === '/api/progress' && method === 'PUT') {
        if (user.role !== 'mentee' || !user.interact)
          throw new HttpError(403, 'Ментор пока не разрешил изменять прогресс');
        const input = z
          .object({ topicId: z.string().max(100), status: z.enum(topicStatuses) })
          .strict()
          .parse(await body(req));
        const row = db.prepare('SELECT data FROM workspace WHERE id=1').get() as { data: string };
        if (
          !flatten(parseWorkspace(JSON.parse(row.data)).roadmap).some((t) => t.id === input.topicId)
        )
          throw new HttpError(404, 'Тема не найдена');
        db.prepare(
          'INSERT INTO progress VALUES (?,?,?) ON CONFLICT(user_id,topic_id) DO UPDATE SET status=excluded.status',
        ).run(user.id, input.topicId, input.status);
        return send(res, 200, { ok: true });
      }
      if (path === '/api/users' && method === 'GET') {
        owner();
        return send(res, 200, {
          users: (
            db.prepare('SELECT * FROM users ORDER BY role,name').all() as unknown as UserRow[]
          ).map(account),
        });
      }
      if (path === '/api/users' && method === 'POST') {
        owner();
        limit(`create:${user.id}`, 20);
        const input = createSchema.parse(await body(req));
        if (db.prepare('SELECT id FROM users WHERE username=?').get(input.username))
          throw new HttpError(409, 'Логин уже занят');
        await expensive(() => createUser(db, input.username, input.name, input.password, 'mentee'));
        return send(res, 201, { ok: true });
      }
      if (path?.startsWith('/api/users/') && method === 'PATCH') {
        owner();
        const id = path.slice('/api/users/'.length);
        const input = z
          .object({
            enabled: z.boolean(),
            canInteract: z.boolean(),
            password: passwordSchema.optional(),
          })
          .strict()
          .parse(await body(req));
        const target = db.prepare("SELECT id FROM users WHERE id=? AND role='mentee'").get(id);
        if (!target) throw new HttpError(404, 'Менти не найден');
        if (input.password) {
          limit(`reset:${user.id}`, 20);
          const encoded = await expensive(() => hashPassword(input.password!));
          db.prepare('UPDATE users SET password=? WHERE id=?').run(encoded, id);
        }
        db.prepare('UPDATE users SET enabled=?,interact=? WHERE id=?').run(
          Number(input.enabled),
          Number(input.canInteract),
          id,
        );
        // Revocation and permission changes apply immediately, including existing sessions.
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
        return send(res, 200, { ok: true });
      }
      throw new HttpError(404, 'Не найдено');
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message });
      if (error instanceof z.ZodError)
        return send(res, 400, {
          error: 'Проверьте поля: логин 3–64 символа, новый пароль 14–128 символов.',
        });
      console.error('API request failed'); // Never log request bodies, credentials, sessions or workspace content.
      if (!res.headersSent) send(res, 500, { error: 'Ошибка сервера. Попробуйте позже.' });
      else res.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}
