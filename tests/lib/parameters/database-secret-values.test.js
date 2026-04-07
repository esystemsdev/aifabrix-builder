/**
 * @fileoverview Tests for index-aware database secret value helpers
 */

const fs = require('fs');
const path = require('path');
const {
  generateDatabaseUrlValueForKey,
  generateDatabasePasswordValueForKey,
  resolveLogicalDbName,
  loadShippedRequiresDatabases
} = require('../../../lib/parameters/database-secret-values');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE_TWO_DB_APP = path.resolve(__dirname, '../../fixtures/parameters-two-db-app');

describe('database-secret-values', () => {
  let savedBuilderDir;
  let savedCwd;
  let savedProjectRoot;

  beforeAll(() => {
    savedBuilderDir = process.env.AIFABRIX_BUILDER_DIR;
    savedCwd = process.cwd();
    savedProjectRoot = global.PROJECT_ROOT;
    global.PROJECT_ROOT = REPO_ROOT;
    delete process.env.AIFABRIX_BUILDER_DIR;
    process.chdir(REPO_ROOT);
  });

  afterAll(() => {
    try {
      process.chdir(savedCwd);
    } catch {
      /* ignore */
    }
    if (savedBuilderDir === undefined) {
      delete process.env.AIFABRIX_BUILDER_DIR;
    } else {
      process.env.AIFABRIX_BUILDER_DIR = savedBuilderDir;
    }
    if (savedProjectRoot === undefined) {
      delete global.PROJECT_ROOT;
    } else {
      global.PROJECT_ROOT = savedProjectRoot;
    }
  });

  it('resolves miso-controller index 0 and 1 from shipped template when appDir is null', () => {
    expect(resolveLogicalDbName('miso-controller', 0, null)).toBe('miso');
    expect(resolveLogicalDbName('miso-controller', 1, null)).toBe('miso-logs');
    expect(loadShippedRequiresDatabases('miso-controller')?.map((d) => d.name)).toEqual(['miso', 'miso-logs']);
  });

  it('generates correct URL and password for miso-controller-1', () => {
    expect(generateDatabasePasswordValueForKey('databases-miso-controller-1-passwordKeyVault', null)).toBe(
      'miso_logs_pass123'
    );
    expect(generateDatabaseUrlValueForKey('databases-miso-controller-1-urlKeyVault', null)).toBe(
      'postgresql://miso_logs_user:miso_logs_pass123@${DB_HOST}:${DB_PORT}/miso-logs'
    );
  });

  it('uses application.yaml requires.databases when appDir is provided', () => {
    expect(fs.existsSync(FIXTURE_TWO_DB_APP)).toBe(true);
    expect(generateDatabaseUrlValueForKey('databases-myapp-1-urlKeyVault', FIXTURE_TWO_DB_APP)).toBe(
      'postgresql://second_db_user:second_db_pass123@${DB_HOST}:${DB_PORT}/second-db'
    );
  });
});
