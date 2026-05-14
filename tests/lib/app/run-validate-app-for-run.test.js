/**
 * @fileoverview validateAppForRun — integration / external apps: next actions are upload & deploy, not build
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const paths = require('../../../lib/utils/paths');
const { validateAppForRun } = require('../../../lib/app/run');

describe('validateAppForRun (external / integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false and suggests upload and deploy for integration external app', async() => {
    paths.detectAppType.mockResolvedValue({
      isExternal: true,
      appPath: '/tmp/integration/x',
      appType: 'external',
      baseDir: 'integration'
    });
    const ok = await validateAppForRun('test-e2e-hubspot', false);
    expect(ok).toBe(false);
    const joined = (logger.log.mock.calls || []).map((c) => c[0]).join('\n');
    expect(joined).toContain('aifabrix upload test-e2e-hubspot');
    expect(joined).toContain('aifabrix deploy test-e2e-hubspot');
    expect(joined).not.toContain('aifabrix build test-e2e-hubspot');
  });

  it('returns false and suggests upload and deploy for builder app with type external', async() => {
    paths.detectAppType.mockResolvedValue({
      isExternal: true,
      appPath: '/tmp/builder/x',
      appType: 'external',
      baseDir: 'builder'
    });
    const ok = await validateAppForRun('my-external', false);
    expect(ok).toBe(false);
    const joined = (logger.log.mock.calls || []).map((c) => c[0]).join('\n');
    expect(joined).toContain('aifabrix upload my-external');
    expect(joined).toContain('aifabrix deploy my-external');
  });
});
