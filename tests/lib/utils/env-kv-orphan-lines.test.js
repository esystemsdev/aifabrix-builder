/**
 * @fileoverview Tests for env-kv-orphan-lines
 */

const { commentOrphanKvEnvLines } = require('../../../lib/utils/env-kv-orphan-lines');

describe('env-kv-orphan-lines', () => {
  it('comments active KV lines not in expected set', () => {
    const content = [
      'KV_HUBSPOT_DEMO_TOKEN=kv://hubspot-demo/token',
      'KV_HUBSPOT_DEMO_APIKEY=kv://hubspot-demo/apiKey',
      'PORT=3600',
      ''
    ].join('\n');
    const { content: out, changed } = commentOrphanKvEnvLines(
      content,
      new Set(['KV_HUBSPOT_DEMO_TOKEN', 'PORT'])
    );
    expect(changed).toBe(true);
    expect(out).toMatch(/^KV_HUBSPOT_DEMO_TOKEN=/m);
    expect(out).toMatch(/^# KV_HUBSPOT_DEMO_APIKEY=/m);
    expect(out).toMatch(/^PORT=3600/m);
  });
});
