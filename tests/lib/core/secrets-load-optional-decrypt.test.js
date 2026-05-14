/**
 * @fileoverview decryptSecretsObject optional-key behavior (real AES; not covered by secrets.test.js mocks)
 */
'use strict';

jest.mock('../../../lib/core/config', () => ({
  getSecretsEncryptionKey: jest.fn()
}));

jest.mock('../../../lib/core/secrets-ensure-infra', () => {
  const actual = jest.requireActual('../../../lib/core/secrets-ensure-infra');
  return {
    ...actual,
    isSecretKeyAllowedEmpty: (key) => {
      if (key === 'mori-controller-api-keyKeyVault') return true;
      if (key === 'miso-controller-jwt-secretKeyVault') return false;
      return actual.isSecretKeyAllowedEmpty(key);
    }
  };
});

const config = require('../../../lib/core/config');
const { encryptSecret } = require('../../../lib/utils/secrets-encryption');
const { decryptSecretsObject } = require('../../../lib/core/secrets-load');

describe('decryptSecretsObject optional catalog keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats undecryptable mori-controller-api-keyKeyVault as empty (optional infra key)', async() => {
    const keyA = 'a'.repeat(64);
    const keyB = 'b'.repeat(64);
    const ciphertext = encryptSecret('mori-api-value', keyA);
    config.getSecretsEncryptionKey.mockResolvedValue(keyB);

    const out = await decryptSecretsObject({
      'mori-controller-api-keyKeyVault': ciphertext,
      'plainKey': 'ok'
    });

    expect(out['mori-controller-api-keyKeyVault']).toBe('');
    expect(out.plainKey).toBe('ok');
  });

  it('still throws for undecryptable required catalog keys', async() => {
    const keyA = 'c'.repeat(64);
    const keyB = 'd'.repeat(64);
    const ciphertext = encryptSecret('jwt-value', keyA);
    config.getSecretsEncryptionKey.mockResolvedValue(keyB);

    await expect(
      decryptSecretsObject({ 'miso-controller-jwt-secretKeyVault': ciphertext })
    ).rejects.toThrow(/Failed to decrypt secret 'miso-controller-jwt-secretKeyVault'/);
  });

  it('includes loaded-from path in required decrypt error when keySources is set', async() => {
    const keyA = 'e'.repeat(64);
    const keyB = 'f'.repeat(64);
    const ciphertext = encryptSecret('jwt-value', keyA);
    config.getSecretsEncryptionKey.mockResolvedValue(keyB);

    await expect(
      decryptSecretsObject(
        { 'miso-controller-jwt-secretKeyVault': ciphertext },
        { keySources: { 'miso-controller-jwt-secretKeyVault': '/home/example/.aifabrix/secrets.local.yaml' } }
      )
    ).rejects.toThrow('encrypted value loaded from: /home/example/.aifabrix/secrets.local.yaml');
  });
});
