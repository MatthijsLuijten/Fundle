#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.dirname(path.dirname(__filename));
const apiDir = path.join(root, 'apps', 'api');
const webDir = path.join(root, 'apps', 'web');
const venvDir = path.join(apiDir, '.venv');
const venvPython = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

console.log('\x1b[36m%s\x1b[0m', 'Setting up Fundle...');

try {
  const configFile = path.join(root, 'fundle.config.env');
  const configExample = path.join(root, 'fundle.config.env.example');

  if (!fs.existsSync(configFile)) {
    if (!fs.existsSync(configExample)) {
      throw new Error('Missing fundle.config.env.example');
    }
    fs.copyFileSync(configExample, configFile);
    console.log('Created fundle.config.env from example');
  }

  console.log('Installing Python dependencies with uv...');
  execSync('uv sync', { cwd: apiDir, stdio: 'inherit' });

  const apiEnv = path.join(apiDir, '.env');
  if (!fs.existsSync(apiEnv)) {
    fs.copyFileSync(path.join(apiDir, '.env.example'), apiEnv);
    console.log('Created apps/api/.env');
  }

  console.log('Installing root npm dependencies...');
  execSync('npm install --silent', { cwd: root, stdio: 'inherit' });

  console.log('Installing web npm dependencies...');
  const webEnvLocal = path.join(webDir, '.env.local');
  if (!fs.existsSync(webEnvLocal)) {
    fs.copyFileSync(path.join(webDir, '.env.local.example'), webEnvLocal);
    console.log('Created apps/web/.env.local');
  }
  execSync('npm install --silent', { cwd: webDir, stdio: 'inherit' });

  console.log('Syncing config...');
  execSync(`"${venvPython}" "${path.join(root, 'scripts', 'sync_config.py')}"`, { stdio: 'inherit' });

  console.log('');
  console.log('\x1b[32m%s\x1b[0m', 'Setup complete. Start development with:');
  console.log('\x1b[36m%s\x1b[0m', '  npm run dev');
  console.log('');
} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', 'Setup failed:', error.message);
  process.exit(1);
}
