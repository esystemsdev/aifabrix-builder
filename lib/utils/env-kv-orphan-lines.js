/**
 * Comment active KV_* env lines that are not in the expected key set (stale auth vars).
 *
 * @fileoverview Shared orphan KV line handling for env.template repair and resolve merge
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Comments active KV_* lines whose env key is not in the expected set.
 *
 * @param {string} content - .env or env.template content
 * @param {Set<string>|Map<string, unknown>} expectedKeys - Keys that should stay active
 * @returns {{ content: string, changed: boolean }}
 */
function commentOrphanKvEnvLines(content, expectedKeys) {
  const expected =
    expectedKeys instanceof Set ? expectedKeys : new Set(expectedKeys.keys());
  const changedRef = { value: false };
  const out = (content || '').split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !/^KV_/i.test(trimmed)) {
      return line;
    }
    const key = line.substring(0, eq).trim();
    if (expected.has(key)) {
      return line;
    }
    changedRef.value = true;
    return `${line.match(/^\s*/)[0]}# ${trimmed}`;
  });
  const joined = out.join('\n');
  const normalized = joined.length > 0 && !joined.endsWith('\n') ? `${joined}\n` : joined;
  return { content: normalized, changed: changedRef.value };
}

module.exports = { commentOrphanKvEnvLines };
