/**
 * @fileoverview Tests for identity CLI
 */

jest.mock('chalk', () => {
  const mock = (t) => t;
  mock.red = (t) => t;
  mock.gray = (t) => t;
  mock.bold = (t) => t;
  mock.white = Object.assign((t) => t, { bold: (t) => t });
  return mock;
});

jest.mock('../../../lib/utils/cli-layout-chalk', () => ({
  formatBlockingError: (m) => m,
  formatSuccessLine: (m) => m,
  headerKeyValue: (k, v) => `${k} ${v}`
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn()
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  normalizeControllerUrl: jest.fn((u) => u),
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));

jest.mock('../../../lib/identity/identity-apply-service', () => ({
  runIdentityApply: jest.fn()
}));

jest.mock('../../../lib/api/auth-cache.api', () => ({
  clearAuthCache: jest.fn()
}));

const { Command } = require('commander');
const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { runIdentityApply } = require('../../../lib/identity/identity-apply-service');
const { setupIdentityCommands } = require('../../../lib/commands/identity');

let exitSpy;

beforeAll(() => {
  exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterAll(() => {
  if (exitSpy) {
    exitSpy.mockRestore();
  }
});

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  setupIdentityCommands(program);
  return program;
}

describe('identity-cli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('http://controller');
    getOrRefreshDeviceToken.mockResolvedValue({
      token: 'tok',
      controller: 'http://controller'
    });
    runIdentityApply.mockResolvedValue({
      groupsProcessed: 1,
      groupsCreated: 1,
      usersProcessed: 1,
      usersCreated: 1,
      membershipsProcessed: 1,
      membershipsCreated: 1,
      membershipsSkipped: 0,
      dryRun: false,
      syncStats: null
    });
  });

  it('apply invokes runIdentityApply with filter-prefix', async() => {
    const program = makeProgram();
    await program.parseAsync([
      'node',
      'aifabrix',
      'identity',
      'apply',
      '--file',
      '/tmp/users.csv',
      '--filter-prefix',
      'test-protection',
      '--dry-run'
    ]);
    expect(runIdentityApply).toHaveBeenCalledWith(
      'http://controller',
      expect.objectContaining({ type: 'bearer' }),
      expect.objectContaining({
        filePath: '/tmp/users.csv',
        filterPrefix: 'test-protection',
        dryRun: true
      })
    );
  });

  it('[EDGE] exits 1 when not authenticated', async() => {
    getOrRefreshDeviceToken.mockResolvedValue(null);
    const program = makeProgram();
    await expect(
      program.parseAsync(['node', 'aifabrix', 'identity', 'apply', '--file', '/tmp/x.csv'])
    ).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalled();
  });
});
