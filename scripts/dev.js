#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.dirname(path.dirname(__filename));
const apiDir = path.join(root, 'apps', 'api');
const webDir = path.join(root, 'apps', 'web');

const venvPython = process.platform === 'win32'
  ? path.join(apiDir, '.venv', 'Scripts', 'python.exe')
  : path.join(apiDir, '.venv', 'bin', 'python');

if (!fs.existsSync(venvPython)) {
  console.error('\x1b[31m%s\x1b[0m', 'Setup not complete. Run: npm run setup');
  process.exit(1);
}

process.env.WATCHFILES_FORCE_POLLING = '1';

const apiProc = spawn(venvPython, [
  '-m', 'uvicorn', 'app.main:app',
  '--reload', '--reload-dir', 'app', '--reload-include', '.env',
  '--port', '8000'
], {
  cwd: apiDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

const webProc = spawn('npm', ['run', 'dev'], {
  cwd: webDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

const cleanup = () => {
  apiProc.kill();
  webProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
