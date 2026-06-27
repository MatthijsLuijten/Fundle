#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const root = path.dirname(path.dirname(__filename));
const apiDir = path.join(root, 'apps', 'api');

const venvPython = process.platform === 'win32'
  ? path.join(apiDir, '.venv', 'Scripts', 'python.exe')
  : path.join(apiDir, '.venv', 'bin', 'python');

try {
  execSync(`"${venvPython}" "${path.join(root, 'scripts', 'sync_config.py')}"`, {
    stdio: 'inherit',
    shell: true
  });
} catch (error) {
  process.exit(1);
}
