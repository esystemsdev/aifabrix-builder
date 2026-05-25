/**
 * @fileoverview Tests for admin-secrets-sync (pro split bundle kv alignment)
 */

'use strict';

jest.mock('../../../lib/core/secrets-ensure');
jest.mock('../../../lib/core/secrets-infra-placeholder-sync');
jest.mock('../../../lib/utils/logger');

const secretsEnsure = require('../../../lib/core/secrets-ensure');
const placeholderSync = require('../../../lib/core/secrets-infra-placeholder-sync');
const {
  syncRequiredKvFromPasswordBundle
} = require('../../../lib/infrastructure/admin-secrets-sync');

describe('admin-secrets-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secretsEnsure.setSecretInStore = jest.fn().mockResolvedValue(undefined);
    secretsEnsure.buildInfraPlaceholderContext = jest.fn().mockReturnValue({});
    placeholderSync.syncLiteralKvSecretsFromCliOverrides = jest.fn().mockResolvedValue(undefined);
  });

  it('split bundle sets keycloak-admin kv to keycloak password, not infra', async() => {
    await syncRequiredKvFromPasswordBundle({
      mode: 'split',
      infra: 'infra-pwd',
      keycloak: 'kc-pwd',
      platform: 'ui-pwd'
    });

    expect(secretsEnsure.setSecretInStore).toHaveBeenCalledWith(
      'keycloak-admin-passwordKeyVault',
      'kc-pwd'
    );
    expect(placeholderSync.syncLiteralKvSecretsFromCliOverrides).toHaveBeenCalledWith(
      { userPassword: 'ui-pwd' },
      expect.any(Object),
      expect.any(Function),
      expect.any(Function)
    );
    expect(secretsEnsure.setSecretInStore).not.toHaveBeenCalledWith(
      'postgres-passwordKeyVault',
      expect.anything()
    );
    expect(secretsEnsure.setSecretInStore).not.toHaveBeenCalledWith(
      'miso-controller-admin-passwordKeyVault',
      expect.anything()
    );
  });

  it('single bundle sets keycloak kv only, not legacy postgres/miso catalog keys', async() => {
    await syncRequiredKvFromPasswordBundle({ mode: 'single', password: 'dev-one' });

    expect(secretsEnsure.setSecretInStore).toHaveBeenCalledWith(
      'keycloak-admin-passwordKeyVault',
      'dev-one'
    );
    expect(secretsEnsure.setSecretInStore).not.toHaveBeenCalledWith(
      'postgres-passwordKeyVault',
      expect.anything()
    );
    expect(secretsEnsure.setSecretInStore).not.toHaveBeenCalledWith(
      'miso-controller-admin-passwordKeyVault',
      expect.anything()
    );
  });
});
