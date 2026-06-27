#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.dirname(path.dirname(__filename));
const apiDir = path.join(root, 'apps', 'api');
const webDir = path.join(root, 'apps', 'web');

const venvPython = process.platform === 'win32'
  ? path.join(apiDir, '.venv', 'Scripts', 'python.exe')
  : path.join(apiDir, '.venv', 'bin', 'python');

if (!fs.existsSync(venvPython)) {
  console.log('');
  console.log('\x1b[33m%s\x1b[0m', 'Fundle is not set up yet. Run from the project root:');
  console.log('\x1b[36m%s\x1b[0m', '  npm run setup');
  console.log('');
  process.exit(1);
}

const webModules = path.join(webDir, 'node_modules');
if (!fs.existsSync(webModules)) {
  console.log('');
  console.log('\x1b[33m%s\x1b[0m', 'Web dependencies missing. Run from the project root:');
  console.log('\x1b[36m%s\x1b[0m', '  npm run setup');
  console.log('');
  process.exit(1);
}

const rootModules = path.join(root, 'node_modules', 'concurrently');
if (!fs.existsSync(rootModules)) {
  console.log('');
  console.log('\x1b[33m%s\x1b[0m', 'Root npm dependencies missing. Run from the project root:');
  console.log('\x1b[36m%s\x1b[0m', '  npm install');
  console.log('');
  process.exit(1);
}
