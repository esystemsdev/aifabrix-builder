/**
 * @fileoverview Tests for datasource-test-run-capability-scope.js
 */

const { analyzeCapabilityScope } = require('../../../lib/utils/datasource-test-run-capability-scope');

describe('datasource-test-run-capability-scope', () => {
  it('not violated when no capability requested', () => {
    expect(analyzeCapabilityScope({ capabilities: [{ key: 'a' }, { key: 'b' }] }, undefined)).toEqual({
      violated: false
    });
    expect(analyzeCapabilityScope({ capabilities: [{ key: 'a' }, { key: 'b' }] }, '')).toEqual({
      violated: false
    });
    expect(analyzeCapabilityScope({ capabilities: [{ key: 'a' }, { key: 'b' }] }, '   ')).toEqual({
      violated: false
    });
  });

  it('not violated when at most one row', () => {
    expect(analyzeCapabilityScope({}, 'read')).toEqual({ violated: false });
    expect(analyzeCapabilityScope({ capabilities: [] }, 'read')).toEqual({ violated: false });
    expect(analyzeCapabilityScope({ capabilities: [{ key: 'read' }] }, 'read')).toEqual({
      violated: false
    });
  });

  it('violated when multiple rows and capability requested', () => {
    const r = analyzeCapabilityScope(
      { capabilities: [{ key: 'read' }, { key: 'write' }] },
      'read'
    );
    expect(r.violated).toBe(true);
    expect(r.count).toBe(2);
    expect(r.message).toContain('--capability "read"');
    expect(r.message).toContain('read, write');
    expect(r.message).toContain('server returned 2');
  });
});
