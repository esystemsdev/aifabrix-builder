/**
 * Local-only: fs-real-sync load + shipped fixtures; order-sensitive under default CI worker.
 *
 * @fileoverview protection validate-local AJV
 */

'use strict';

const { validateProtectionManifestLocal } = require('../../../../lib/protection/validate-local');
const { loadProtectionManifest } = require('../../../../lib/protection/load');
const { hubspotCompaniesFixturePath } = require('../../../lib/protection/protection-test-fixtures');

describe('protection validate-local (local)', () => {
  it('passes valid fixture', () => {
    const manifest = loadProtectionManifest(hubspotCompaniesFixturePath());
    const result = validateProtectionManifestLocal(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails invalid manifest shape', () => {
    const result = validateProtectionManifestLocal({ kind: 'Protection' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('allows grant without valueType', () => {
    const manifest = loadProtectionManifest(hubspotCompaniesFixturePath());
    expect(validateProtectionManifestLocal(manifest).valid).toBe(true);
  });

  it('rejects unknown grant valueType enum', () => {
    const manifest = loadProtectionManifest(hubspotCompaniesFixturePath());
    manifest.spec.rules[0].grants[0].valueType = 'invalid';
    const result = validateProtectionManifestLocal(manifest);
    expect(result.valid).toBe(false);
  });
});
