/**
 * kv://BASH_<NAME> fallback: use process.env.<NAME>, then process.env.BASH_<NAME> (shared BASH_ keys).
 * @fileoverview
 */
'use strict';

/**
 * @param {string} pathStr - Flat kv path (no slashes)
 * @returns {string|undefined}
 */
function resolveBashKvFromProcessEnv(pathStr) {
  if (!pathStr || typeof pathStr !== 'string' || pathStr.includes('/')) return undefined;
  if (!pathStr.startsWith('BASH_')) return undefined;
  const suffix = pathStr.slice(5);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(suffix)) return undefined;
  const pick = k => {
    const raw = process.env[k];
    if (raw === undefined || raw === null) return undefined;
    const t = String(raw).trim();
    return t.length > 0 ? t : undefined;
  };
  return pick(suffix) ?? pick(pathStr);
}

module.exports = { resolveBashKvFromProcessEnv };
