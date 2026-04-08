/**
 * Real-filesystem coverage for listIntegrationAppNames / listBuilderAppNames.
 * Must not use jest.mock('fs') (paths.js would still bind the real module in this project).
 * @fileoverview
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('paths app listing (real fs, broken symlinks)', () => {
  let tmp;
  let savedCwd;
  let savedProjectRoot;

  beforeEach(() => {
    savedCwd = process.cwd();
    savedProjectRoot = global.PROJECT_ROOT;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-paths-list-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), '{}');
    process.chdir(tmp);
    global.PROJECT_ROOT = tmp;
    jest.resetModules();
  });

  afterEach(() => {
    process.chdir(savedCwd);
    global.PROJECT_ROOT = savedProjectRoot;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    jest.resetModules();
    const paths = require('../../../lib/utils/paths');
    paths.clearProjectRootCache();
  });

  function trySymlink(target, linkPath) {
    try {
      fs.symlinkSync(target, linkPath);
      return true;
    } catch (err) {
      if (
        err &&
        (err.code === 'EPERM' ||
          err.code === 'EOPNOTSUPP' ||
          err.code === 'ENOENT')
      ) {
        return false;
      }
      throw err;
    }
  }

  it('listIntegrationAppNames omits broken symlink entries (e.g. dataplane)', () => {
    fs.mkdirSync(path.join(tmp, 'integration', 'goodapp'), { recursive: true });
    const ok = trySymlink(path.join(tmp, '__no_such_target__'), path.join(tmp, 'integration', 'dataplane'));
    if (!ok) {
      return;
    }
    const paths = require('../../../lib/utils/paths');
    expect(paths.listIntegrationAppNames()).toEqual(['goodapp']);
  });

  it('listBuilderAppNames omits broken symlink entries', () => {
    fs.mkdirSync(path.join(tmp, 'builder', 'app'), { recursive: true });
    const ok = trySymlink(path.join(tmp, '__no_such_builder_link__'), path.join(tmp, 'builder', 'badlink'));
    if (!ok) {
      return;
    }
    const paths = require('../../../lib/utils/paths');
    expect(paths.listBuilderAppNames()).toEqual(['app']);
  });
});
