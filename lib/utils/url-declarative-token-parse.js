/**
 * Declarative url:// token shape parsing (plan 122/124).
 * Single module for suffix lists and parseUrlToken — avoids drift with tests.
 *
 * @fileoverview parseUrlToken only; no URL expansion
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Current-app tokens (no appKey prefix).
 * @type {readonly { id: string, kind: 'public'|'internal', surface: 'full'|'host'|'vdir' }[]}
 */
const DECLARATIVE_URL_EXACT_TOKENS = Object.freeze([
  { id: 'host-public', kind: 'public', surface: 'host' },
  { id: 'host-internal', kind: 'internal', surface: 'host' },
  { id: 'host-private', kind: 'internal', surface: 'host' },
  { id: 'vdir-public', kind: 'public', surface: 'vdir' },
  { id: 'vdir-internal', kind: 'internal', surface: 'vdir' },
  { id: 'vdir-private', kind: 'internal', surface: 'vdir' },
  { id: 'public', kind: 'public', surface: 'full' },
  { id: 'internal', kind: 'internal', surface: 'full' },
  { id: 'private', kind: 'internal', surface: 'full' }
]);

/**
 * Cross-app suffixes (longest match first). App key is token prefix before suffix.
 * @type {readonly { suffix: string, kind: 'public'|'internal', surface: 'full'|'host'|'vdir' }[]}
 */
const DECLARATIVE_URL_CROSS_APP_SUFFIXES = Object.freeze([
  { suffix: '-host-public', kind: 'public', surface: 'host' },
  { suffix: '-host-internal', kind: 'internal', surface: 'host' },
  { suffix: '-host-private', kind: 'internal', surface: 'host' },
  { suffix: '-vdir-public', kind: 'public', surface: 'vdir' },
  { suffix: '-vdir-internal', kind: 'internal', surface: 'vdir' },
  { suffix: '-vdir-private', kind: 'internal', surface: 'vdir' }
]);

const URL_TOKEN_EXACT = new Map(DECLARATIVE_URL_EXACT_TOKENS.map((d) => [d.id, { kind: d.kind, surface: d.surface }]));

/**
 * @param {string} token
 * @returns {{ targetKey: string, kind: 'public'|'internal', surface: 'full'|'host'|'vdir' }}
 */
function parseUrlToken(token) {
  const t = String(token || '').trim();
  const exact = URL_TOKEN_EXACT.get(t);
  if (exact) {
    return { targetKey: '', kind: exact.kind, surface: exact.surface };
  }
  for (const { suffix, kind, surface } of DECLARATIVE_URL_CROSS_APP_SUFFIXES) {
    if (t.endsWith(suffix)) {
      return { targetKey: t.slice(0, -suffix.length), kind, surface };
    }
  }
  if (t.endsWith('-public')) {
    return { targetKey: t.slice(0, -'-public'.length), kind: 'public', surface: 'full' };
  }
  if (t.endsWith('-internal')) {
    return { targetKey: t.slice(0, -'-internal'.length), kind: 'internal', surface: 'full' };
  }
  if (t.endsWith('-private')) {
    return { targetKey: t.slice(0, -'-private'.length), kind: 'internal', surface: 'full' };
  }
  return { targetKey: '', kind: 'public', surface: 'full' };
}

module.exports = {
  DECLARATIVE_URL_EXACT_TOKENS,
  DECLARATIVE_URL_CROSS_APP_SUFFIXES,
  parseUrlToken
};
