/**
 * @fileoverview Tests for persisting resolved kv:// values to local secrets
 */

'use strict';

jest.mock('../../../lib/utils/local-secrets', () => ({
  saveLocalSecret: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('../../../lib/utils/remote-secrets-loader', () => ({
  loadConfiguredSharedSecretsStore: jest.fn().mockResolvedValue(null)
}));

jest.mock('../../../lib/core/secrets-load', () => ({
  decryptSecretsObject: jest.fn(async(obj) => obj)
}));

const { saveLocalSecret } = require('../../../lib/utils/local-secrets');
const { loadConfiguredSharedSecretsStore } = require('../../../lib/utils/remote-secrets-loader');
const { materializeResolvedKvSecretsToUserLocal } = require('../../../lib/utils/secrets-materialize-local');

describe('materializeResolvedKvSecretsToUserLocal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadConfiguredSharedSecretsStore.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes keys when local is empty and merged map has values', async() => {
    jest.spyOn(require('../../../lib/utils/secrets-utils'), 'loadPrimaryUserSecrets').mockReturnValue({});

    const merged = { 'postgres-passwordKeyVault': 'from-remote' };
    const template = 'DATABASE_URL=kv://postgres-passwordKeyVault\n';

    const keys = await materializeResolvedKvSecretsToUserLocal(template, merged, null, {});

    expect(keys).toEqual(['postgres-passwordKeyVault']);
    expect(saveLocalSecret).toHaveBeenCalledWith('postgres-passwordKeyVault', 'from-remote');
  });

  it('skips when local already has non-empty value', async() => {
    jest.spyOn(require('../../../lib/utils/secrets-utils'), 'loadPrimaryUserSecrets').mockReturnValue({
      'postgres-passwordKeyVault': 'already-local'
    });

    const merged = { 'postgres-passwordKeyVault': 'from-remote' };
    const template = 'DATABASE_URL=kv://postgres-passwordKeyVault\n';

    const keys = await materializeResolvedKvSecretsToUserLocal(template, merged, null, {});

    expect(keys).toEqual([]);
    expect(saveLocalSecret).not.toHaveBeenCalled();
  });

  it('honors skipMaterializeKvToLocal', async() => {
    jest.spyOn(require('../../../lib/utils/secrets-utils'), 'loadPrimaryUserSecrets').mockReturnValue({});

    const merged = { 'postgres-passwordKeyVault': 'from-remote' };
    const template = 'DATABASE_URL=kv://postgres-passwordKeyVault\n';

    await materializeResolvedKvSecretsToUserLocal(template, merged, null, { skipMaterializeKvToLocal: true });

    expect(saveLocalSecret).not.toHaveBeenCalled();
  });

  it('does not write keys already present on the configured shared store', async() => {
    jest.spyOn(require('../../../lib/utils/secrets-utils'), 'loadPrimaryUserSecrets').mockReturnValue({});
    loadConfiguredSharedSecretsStore.mockResolvedValue({
      'azure-client-idKeyVault': 'same-as-shared'
    });

    const merged = { 'azure-client-idKeyVault': 'same-as-shared' };
    const template = 'AZURE_CLIENT_ID=kv://azure-client-idKeyVault\n';

    const keys = await materializeResolvedKvSecretsToUserLocal(template, merged, null, {});

    expect(keys).toEqual([]);
    expect(saveLocalSecret).not.toHaveBeenCalled();
  });
});
