/**
 * @fileoverview Tests for index-aware database secret value helpers
 */

const path = require('path');
const {
  generateDatabaseUrlValueForKey,
  generateDatabasePasswordValueForKey,
  resolveLogicalDbName
} = require('../../../lib/parameters/database-secret-values');

describe('database-secret-values', () => {
  it('resolves miso-controller index 0 and 1 logical names', () => {
    expect(resolveLogicalDbName('miso-controller', 0, null)).toBe('miso');
    expect(resolveLogicalDbName('miso-controller', 1, null)).toBe('miso-logs');
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
    const fixtureDir = path.join(__dirname, '../../fixtures/parameters-two-db-app');
    expect(generateDatabaseUrlValueForKey('databases-myapp-1-urlKeyVault', fixtureDir)).toBe(
      'postgresql://second_db_user:second_db_pass123@${DB_HOST}:${DB_PORT}/second-db'
    );
  });
});
