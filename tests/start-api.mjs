// Isolated browser-test fixture. Never used by the production entrypoint.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'mit-browser-test-'));
const env = {
  ...process.env,
  DATABASE_PATH: join(directory, 'test.sqlite'),
  APP_ORIGIN: 'http://localhost:5174',
  PORT: '3001',
  LISTEN_HOST: '127.0.0.1',
};
const setup = spawnSync(process.execPath, ['server-dist/index.js', 'create-owner', 'test-owner'], {
  env,
  input: 'browser-test-password-12345',
  encoding: 'utf8',
});
if (setup.status !== 0) {
  console.error(setup.stderr);
  process.exit(1);
}
const child = spawn(process.execPath, ['server-dist/index.js'], { env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill('SIGTERM'));
child.on('exit', (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
