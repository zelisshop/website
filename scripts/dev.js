import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const apiPort = process.env.DEV_API_PORT || '5174';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}

function start(args, env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Unable to start development server: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
start(['--watch', 'server.js'], { ...process.env, PORT: apiPort });
start(['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], {
  ...process.env,
  DEV_API_PORT: apiPort,
});
