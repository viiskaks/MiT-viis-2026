import { DatabaseSync } from 'node:sqlite';
import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
  randomUUID,
} from 'node:crypto';
import { createSeed } from '../src/data/seed';
import type { Account } from '../src/types/access';
const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, expected] = encoded.split(':');
  const key = await scrypt(password, salt);
  return timingSafeEqual(key, Buffer.from(expected, 'hex'));
}
export interface UserRow {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'mentee';
  password: string;
  enabled: number;
  interact: number;
}
export const account = (row: UserRow): Account => ({
  id: row.id,
  username: row.username,
  name: row.name,
  role: row.role,
  enabled: !!row.enabled,
  canInteract: !!row.interact,
});
export function openStore(filename: string) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','mentee')), password TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, interact INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS single_owner ON users(role) WHERE role='owner';
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, topic_id TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(user_id,topic_id));
    CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO workspace VALUES (1, ?, 1)').run(JSON.stringify(createSeed()));
  return db;
}
export type Store = ReturnType<typeof openStore>;
export async function createUser(
  db: Store,
  username: string,
  name: string,
  password: string,
  role: 'owner' | 'mentee',
) {
  const id = randomUUID();
  const encoded = await hashPassword(password);
  db.prepare('INSERT INTO users (id,username,name,password,role) VALUES (?,?,?,?,?)').run(
    id,
    username,
    name,
    encoded,
    role,
  );
  return id;
}
