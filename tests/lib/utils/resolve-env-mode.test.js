/**
 * @fileoverview Tests for resolve-env-mode
 */

'use strict';

const path = require('path');
const {
  isIntegrationAppPath,
  resolveGenerateEnvEnvironment
} = require('../../../lib/utils/resolve-env-mode');

describe('resolve-env-mode', () => {
  it('isIntegrationAppPath returns true for integration paths', () => {
    expect(isIntegrationAppPath('/workspace/foo/integration/hubspot-demo')).toBe(true);
  });

  it('isIntegrationAppPath returns false for builder paths', () => {
    expect(isIntegrationAppPath('/workspace/foo/builder/dataplane')).toBe(false);
  });

  it('resolveGenerateEnvEnvironment uses local for integration', () => {
    const appPath = path.join(process.cwd(), 'integration', 'hubspot-demo');
    expect(resolveGenerateEnvEnvironment(appPath, 'hubspot-demo')).toBe('local');
  });

  it('resolveGenerateEnvEnvironment uses docker for platform apps', () => {
    const appPath = path.join(process.cwd(), 'builder', 'dataplane');
    expect(resolveGenerateEnvEnvironment(appPath, 'dataplane')).toBe('docker');
  });

  it('resolveGenerateEnvEnvironment uses docker for generic builder apps', () => {
    const appPath = path.join(process.cwd(), 'builder', 'myapp');
    expect(resolveGenerateEnvEnvironment(appPath, 'myapp')).toBe('docker');
  });
});
