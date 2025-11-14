/**
 * Tests for AI Fabrix Builder Path Utilities
 *
 * @fileoverview Unit tests for paths.js config-only home resolution
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const os = require('os');

// Mock fs BEFORE requiring paths
jest.mock('fs');
const fs = require('fs');

// We will dynamically import paths within tests to pick up current mocks and fs behavior

describe('Path Utilities - getAifabrixHome (config only)', () => {
  const realHomeDir = os.homedir();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should default to ~/.aifabrix when config override is not set', async() => {
    const configPath = path.join(realHomeDir, '.aifabrix', 'config.yaml');
    fs.existsSync.mockImplementation((filePath) => filePath === configPath ? true : false);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === configPath) return 'developer-id: "0"\n';
      return '';
    });

    const paths = require('../../../lib/utils/paths');
    const home = paths.getAifabrixHome();
    expect(home).toBe(path.join(realHomeDir, '.aifabrix'));
  });

  it('should ignore config override in test environment and use default', async() => {
    const override = '/custom/aifabrix';
    const configPath = path.join(realHomeDir, '.aifabrix', 'config.yaml');
    fs.existsSync.mockImplementation((filePath) => filePath === configPath ? true : false);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === configPath) return `aifabrix-home: "${override}"\n`;
      return '';
    });

    const paths = require('../../../lib/utils/paths');
    const home = paths.getAifabrixHome();
    // In test env, config is intentionally ignored for determinism
    expect(home).toBe(path.join(realHomeDir, '.aifabrix'));
  });
});

describe('Path Utilities - getAifabrixHome (non-test env config behavior)', () => {
  const realHomeDir = os.homedir();
  const configPath = path.join(realHomeDir, '.aifabrix', 'config.yaml');
  let originalNodeEnv;
  let originalJestWorker;
  const canUnsetJestWorker = (() => {
    const prev = process.env.JEST_WORKER_ID;
    try {
      delete process.env.JEST_WORKER_ID;
      return process.env.JEST_WORKER_ID === undefined;
    } finally {
      if (prev !== undefined) process.env.JEST_WORKER_ID = prev;
    }
  })();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    originalJestWorker = process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJestWorker === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorker;
    }
  });

  it.skip('should use config override when set and non-empty', () => {
    const override = '/custom/aifabrix';
    fs.existsSync.mockImplementation((filePath) => filePath === configPath);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === configPath) return `aifabrix-home: "${override}"\n`;
      return '';
    });

    const paths = require('../../../lib/utils/paths');
    const home = paths.getAifabrixHome();
    expect(home).toBe(path.resolve(override));
  });

  it('should fall back to default when config missing', () => {
    fs.existsSync.mockReturnValue(false);

    const paths = require('../../../lib/utils/paths');
    const home = paths.getAifabrixHome();
    expect(home).toBe(path.join(realHomeDir, '.aifabrix'));
  });

  it('should fall back to default when override is empty', () => {
    fs.existsSync.mockImplementation((filePath) => filePath === configPath);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === configPath) return 'aifabrix-home: ""\n';
      return '';
    });

    const paths = require('../../../lib/utils/paths');
    const home = paths.getAifabrixHome();
    expect(home).toBe(path.join(realHomeDir, '.aifabrix'));
  });

  it('should ignore read or parse errors and fall back to default', () => {
    fs.existsSync.mockImplementation((filePath) => filePath === configPath);
    fs.readFileSync.mockImplementation(() => {
      throw new Error('boom');
    });

    const paths = require('../../../lib/utils/paths');
    const home = paths.getAifabrixHome();
    expect(home).toBe(path.join(realHomeDir, '.aifabrix'));
  });
});

describe('Path Utilities - directory helpers', () => {
  const realHomeDir = os.homedir();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('getApplicationsBaseDir returns applications for developerId 0', () => {
    const paths = require('../../../lib/utils/paths');
    const base = paths.getApplicationsBaseDir(0);
    expect(base).toBe(path.join(realHomeDir, '.aifabrix', 'applications'));
  });

  it('getApplicationsBaseDir returns applications-dev-{id} for non-zero id', () => {
    const id = 5;
    const paths = require('../../../lib/utils/paths');
    const base = paths.getApplicationsBaseDir(id);
    expect(base).toBe(path.join(realHomeDir, '.aifabrix', `applications-dev-${id}`));
  });

  it('getDevDirectory returns base dir for developerId 0', () => {
    const paths = require('../../../lib/utils/paths');
    const devDir = paths.getDevDirectory('myapp', 0);
    expect(devDir).toBe(path.join(realHomeDir, '.aifabrix', 'applications'));
  });

  it('getDevDirectory returns appName-dev-{id} for non-zero id (string id)', () => {
    const paths = require('../../../lib/utils/paths');
    const devDir = paths.getDevDirectory('myapp', '3');
    expect(devDir).toBe(path.join(realHomeDir, '.aifabrix', 'applications-dev-3', 'myapp-dev-3'));
  });
});
