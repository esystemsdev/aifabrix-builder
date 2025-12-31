#!/usr/bin/env node
/**
 * Patch Jest's broken exit handler
 */

const fs = require('fs');
const path = require('path');

const jestCliPath = path.join(__dirname, '../node_modules/jest-cli/build/index.js');

if (fs.existsSync(jestCliPath)) {
  let content = fs.readFileSync(jestCliPath, 'utf8');

  // Patch the broken exit handler
  // Replace: (0 , _exitX().default)(code);
  // With: process.exit(code);
  content = content.replace(
    /\(0\s*,\s*_exitX\(\)\.default\)\((\w+)\)/g,
    'process.exit($1)'
  );

  // Also patch other variations with numbers
  content = content.replace(
    /\(0\s*,\s*_exitX\(\)\.default\)\((\d+)\)/g,
    'process.exit($1)'
  );

  // Patch _exit variations
  content = content.replace(
    /\(0\s*,\s*_exit\(\)\.default\)\((\w+)\)/g,
    'process.exit($1)'
  );

  content = content.replace(
    /\(0\s*,\s*_exit\(\)\.default\)\((\d+)\)/g,
    'process.exit($1)'
  );

  fs.writeFileSync(jestCliPath, content, 'utf8');
  console.log('✓ Patched Jest exit handler');
} else {
  console.log('⚠ Jest CLI not found, skipping patch');
}

