/**
 * @fileoverview Tests for certification merge (schema-shaped object from dataplane artifact).
 */

'use strict';

const {
  buildCertificationFromArtifact,
  pickArtifactForCertificationMerge,
  certificateIdToString
} = require('../../../lib/certification/merge-certification-from-artifact');

describe('certificateIdToString', () => {
  it('returns trimmed string for string id', () => {
    expect(certificateIdToString('  abc  ')).toBe('abc');
  });

  it('reads id from FK object', () => {
    expect(certificateIdToString({ id: 'fk1' })).toBe('fk1');
  });
});

describe('pickArtifactForCertificationMerge', () => {
  it('prefers artifact with publicKey', () => {
    const a = { version: '1', publicKey: '' };
    const b = { version: '2', publicKey: '-----BEGIN' };
    expect(pickArtifactForCertificationMerge([a, b])).toBe(b);
  });

  it('falls back to first artifact', () => {
    const a = { version: '1' };
    const b = { version: '2' };
    expect(pickArtifactForCertificationMerge([a, b])).toBe(a);
  });
});

describe('buildCertificationFromArtifact', () => {
  it('returns null when artifact missing', () => {
    expect(buildCertificationFromArtifact(null, {})).toBeNull();
  });

  it('returns null when no publicKey from artifact or file (RS256)', () => {
    const art = { version: 'v1', issuedBy: 'dp', licenseLevelIssuer: 'L', algorithm: 'RS256' };
    expect(buildCertificationFromArtifact(art, {})).toBeNull();
  });

  it('returns null when artifact has no PEM publicKey (legacy HS256-only artifact)', () => {
    const art = {
      certificateId: 'AIC-20260101-abc123',
      algorithm: 'HS256',
      version: '1.0.0',
      licenseLevelIssuer: 'Dataplane - community edition',
      issuedBy: 'e2e-auto'
    };
    expect(buildCertificationFromArtifact(art, {})).toBeNull();
  });

  it('includes publicKeyFingerprint from artifact when present', () => {
    const fp = `sha256:${'a'.repeat(64)}`;
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      publicKeyFingerprint: fp
    };
    const out = buildCertificationFromArtifact(art, {});
    expect(out.publicKeyFingerprint).toBe(fp);
    expect(out.algorithm).toBe('RS256');
  });

  it('includes contractHash from artifact when present and valid', () => {
    const ch = `sha256:${'f'.repeat(64)}`;
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      contractHash: ch
    };
    const out = buildCertificationFromArtifact(art, {});
    expect(out.contractHash).toBe(ch);
  });

  it('uses integrationHash when contractHash absent on artifact', () => {
    const ch = `sha256:${'0'.repeat(64)}`;
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      integrationHash: ch
    };
    expect(buildCertificationFromArtifact(art, {}).contractHash).toBe(ch);
  });

  it('prefers file contractHash when artifact omits valid hash', () => {
    const ch = `sha256:${'1'.repeat(64)}`;
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      contractHash: 'invalid'
    };
    const ex = { publicKey: 'KEY', issuer: 'x', version: '1', contractHash: ch };
    expect(buildCertificationFromArtifact(art, ex).contractHash).toBe(ch);
  });

  it('omits contractHash when no valid digest on artifact or file', () => {
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      contractHash: 'not-valid'
    };
    const out = buildCertificationFromArtifact(art, {});
    expect(out.contractHash).toBeUndefined();
  });

  it('uses file publicKey when artifact omits it', () => {
    const art = {
      version: '1.0.0',
      issuedBy: 'tester',
      licenseLevelIssuer: 'Fabrix'
    };
    const ex = { publicKey: 'PEM', issuer: 'old', version: '0.9', enabled: false, algorithm: 'RS256' };
    expect(buildCertificationFromArtifact(art, ex)).toEqual({
      enabled: true,
      publicKey: 'PEM',
      algorithm: 'RS256',
      issuer: 'Fabrix',
      version: '1.0.0',
      status: 'passed'
    });
  });

  it('uses artifact publicKey and certificateId as version fallback', () => {
    const art = {
      certificateId: 'cert-99',
      publicKey: 'KEY',
      issuedBy: 'dp'
    };
    const ex = {};
    expect(buildCertificationFromArtifact(art, ex)).toEqual({
      enabled: true,
      publicKey: 'KEY',
      algorithm: 'RS256',
      issuer: 'dp',
      version: 'cert-99',
      status: 'passed'
    });
  });

  it('includes level from artifact certificationLevel (normalized to uppercase)', () => {
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      certificationLevel: 'gold'
    };
    expect(buildCertificationFromArtifact(art, {})).toEqual(
      expect.objectContaining({
        level: 'GOLD',
        status: 'passed'
      })
    );
  });

  it('prefers existing file level over artifact when both set', () => {
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      certificationLevel: 'BRONZE'
    };
    const ex = {
      level: 'PLATINUM',
      publicKey: 'KEY',
      issuer: 'x',
      version: '1',
      algorithm: 'RS256'
    };
    expect(buildCertificationFromArtifact(art, ex).level).toBe('PLATINUM');
  });

  it('preserves not_passed status from existing file', () => {
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      certificationLevel: 'SILVER'
    };
    const ex = {
      status: 'not_passed',
      publicKey: 'KEY',
      issuer: 'x',
      version: '1',
      algorithm: 'RS256'
    };
    expect(buildCertificationFromArtifact(art, ex).status).toBe('not_passed');
  });

  it('ignores invalid existing status and defaults to passed', () => {
    const art = { certificateId: 'c1', publicKey: 'KEY', issuedBy: 'dp' };
    const ex = {
      status: 'bogus',
      publicKey: 'KEY',
      version: '1',
      issuer: 'i',
      algorithm: 'RS256'
    };
    expect(buildCertificationFromArtifact(art, ex).status).toBe('passed');
  });

  it('omits level when certificationLevel is not a known tier', () => {
    const art = {
      certificateId: 'c1',
      publicKey: 'KEY',
      issuedBy: 'dp',
      certificationLevel: 'DIAMOND'
    };
    const out = buildCertificationFromArtifact(art, {});
    expect(out.level).toBeUndefined();
  });
});
