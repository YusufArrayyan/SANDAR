// Menyalakan server SANDAR untuk tes end-to-end: isi ulang data contoh, lalu jalankan uvicorn.
// Basis data: SANDAR_E2E_DATABASE_URL bila diisi (misalnya PostgreSQL), selain itu SQLite sementara.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const akar = resolve(import.meta.dirname, '..', '..');
const backend = join(akar, 'backend');
const python = [join(backend, '.venv', 'Scripts', 'python.exe'), join(backend, '.venv', 'bin', 'python')].find(existsSync) ?? 'python';
const port = process.env.SANDAR_E2E_PORT ?? '8766';
const env = {
  ...process.env,
  SANDAR_DATABASE_URL: process.env.SANDAR_E2E_DATABASE_URL ?? `sqlite:///${join(mkdtempSync(join(tmpdir(), 'sandar-e2e-')), 'e2e.db')}`,
  SANDAR_WEB_DIST: join(akar, 'frontend', 'dist'),
};

const seed = spawnSync(python, ['-m', 'app.seed', '--demo', '--reset'], { cwd: backend, env, stdio: 'inherit' });
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--port', port], { cwd: backend, env, stdio: 'inherit' });
const henti = () => server.kill();
process.on('SIGINT', henti);
process.on('SIGTERM', henti);
process.on('exit', henti);
server.on('exit', (kode) => process.exit(kode ?? 0));
