/**
 * @fileoverview secrets-ensure behavior when getInfraParameterCatalog() throws (AJV/schema failure).
 * Ensures relaxed YAML read still supplies key names and emptyAllowed detection.
 */

jest.mock('../../../lib/core/config', () => ({
  getSecretsPath: jest.fn(),
  getSecretsEncryptionKey: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/tmp/.aifabrix'),
  listBuilderAppNames: jest.fn(() => []),
  listIntegrationAppNames: jest.fn(() => []),
  getBuilderPath: jest.fn((n) => `/builder/${n}`),
  getIntegrationPath: jest.fn((n) => `/integration/${n}`)
}));

jest.mock('../../../lib/utils/remote-dev-auth', () => ({
  isRemoteSecretsUrl: jest.fn(() => false),
  getRemoteDevAuth: jest.fn(),
  resolveSharedSecretsEndpoint: jest.fn(async(p) => p)
}));

jest.mock('../../../lib/api/dev.api', () => ({
  listSecrets: jest.fn(),
  addSecret: jest.fn()
}));

jest.mock('../../../lib/utils/secrets-generator', () => ({
  findMissingSecretKeys: jest.fn(),
  generateSecretValue: jest.fn((k) => `gen-${k}`),
  loadExistingSecrets: jest.fn(() => ({})),
  appendSecretsToFile: jest.fn(),
  saveSecretsFile: jest.fn()
}));

jest.mock('../../../lib/utils/secrets-encryption', () => ({
  encryptSecret: jest.fn((v) => `enc(${v})`)
}));

jest.mock('../../../lib/utils/secrets-helpers', () => ({
  loadEnvTemplate: jest.fn(() => '')
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn()
}));

jest.mock('../../../lib/parameters/infra-parameter-catalog', () => {
  const actual = jest.requireActual('../../../lib/parameters/infra-parameter-catalog');
  return {
    ...actual,
    getInfraParameterCatalog: jest.fn(() => {
      throw new Error('simulated catalog load failure');
    })
  };
});

const fs = require('fs');
const realFs = jest.requireActual('fs');
const catalogModule = require('../../../lib/parameters/infra-parameter-catalog');
const secretsEnsure = require('../../../lib/core/secrets-ensure');

describe('secrets-ensure catalog failure fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    catalogModule.clearInfraParameterCatalogCache();
    fs.existsSync.mockImplementation((p) => realFs.existsSync(p));
    fs.readFileSync.mockImplementation((filepath, enc) => {
      const s = String(filepath);
      if (s.includes('infra.parameter.yaml') || s.includes('infra-parameter.schema.json')) {
        return realFs.readFileSync(filepath, enc);
      }
      return '';
    });
  });

  it('getInfraSecretKeysForUpInfra returns relaxed YAML key list when catalog load throws', () => {
    const keys = secretsEnsure.getInfraSecretKeysForUpInfra();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('postgres-passwordKeyVault');
    expect(keys).toContain('databases-miso-controller-1-passwordKeyVault');
    expect(keys).toEqual([...keys].sort());
  });

  it('isSecretKeyAllowedEmpty uses relaxed YAML when catalog load throws', () => {
    expect(secretsEnsure.isSecretKeyAllowedEmpty('redis-passwordKeyVault')).toBe(true);
    expect(secretsEnsure.isSecretKeyAllowedEmpty('postgres-passwordKeyVault')).toBe(false);
  });

  it('INFRA_SECRET_KEYS getter still resolves from disk when catalog object is unavailable', () => {
    const keys = secretsEnsure.INFRA_SECRET_KEYS;
    expect(keys).toContain('redis-url');
    expect(keys).toContain('keycloak-internal-server-url');
  });
});
