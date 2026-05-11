/**
 * Scan env-style content for unique kv:// path segments (comments skipped).
 * @fileoverview Keeps secrets-helpers under max-lines
 */

'use strict';

const KV_REF_PATTERN = /kv:\/\/([a-zA-Z0-9_\-/]+)/g;

function isCommentOrEmptyLine(line) {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function collectUniqueKvPathStrings(content) {
  const seen = new Set();
  const out = [];
  if (!content || typeof content !== 'string') {
    return out;
  }
  for (const line of content.split('\n')) {
    if (isCommentOrEmptyLine(line)) continue;
    let match;
    KV_REF_PATTERN.lastIndex = 0;
    while ((match = KV_REF_PATTERN.exec(line)) !== null) {
      const pathStr = match[1];
      if (!seen.has(pathStr)) {
        seen.add(pathStr);
        out.push(pathStr);
      }
    }
  }
  return out;
}

module.exports = {
  collectUniqueKvPathStrings
};
