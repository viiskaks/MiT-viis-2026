import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openStore, createUser, hashPassword } from './store';
import { createApi, passwordSchema, usernameSchema } from './api';
process.umask(0o077);
if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN)
  throw new Error('APP_ORIGIN is required in production');
const filename = process.env.DATABASE_PATH ?? './data/workspace.sqlite';
mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
const db = openStore(filename);
const command = process.argv[2];
if (command === 'create-owner' || command === 'reset-owner') {
  let password = '';
  for await (const chunk of process.stdin) password += chunk;
  password = password.replace(/\r?\n$/, '');
  passwordSchema.parse(password);
  if (command === 'create-owner') {
    const username = usernameSchema.parse(process.argv[3]);
    await createUser(db, username, 'Ментор', password, 'owner');
  } else {
    const row = db.prepare("SELECT id FROM users WHERE role='owner'").get() as
      { id: string } | undefined;
    if (!row) throw new Error('Owner does not exist');
    db.prepare('UPDATE users SET password=? WHERE id=?').run(await hashPassword(password), row.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
  }
  console.log('Owner credentials saved.');
  db.close();
} else {
  const server = await createApi(db, process.env.APP_ORIGIN ?? 'http://localhost:5174');
  server.listen(Number(process.env.PORT ?? 3001), process.env.LISTEN_HOST ?? '127.0.0.1', () =>
    console.log('Mentorship API listening'),
  );
  const stop = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
