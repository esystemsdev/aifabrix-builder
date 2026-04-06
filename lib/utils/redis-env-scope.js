/**
 * Adjust Redis DB index in resolved .env content when environment-scoped resources are effective.
 *
 * @fileoverview REDIS_DB and redis:// URL path segment (plan 117)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Set pathname /dbIndex for redis(s) URLs.
 *
 * @param {string} urlStr - redis:// or rediss:// URL
 * @param {number} dbIndex - logical DB (0–15 typical)
 * @returns {string}
 */
function setRedisUrlDbIndex(urlStr, dbIndex) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  try {
    const u = new URL(urlStr.trim());
    if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') {
      return urlStr;
    }
    u.pathname = `/${dbIndex}`;
    return u.toString();
  } catch {
    return urlStr;
  }
}

/**
 * Apply Redis DB index to REDIS_DB= and REDIS_URL= lines when effective.
 *
 * @param {string} content - .env text
 * @param {number|null} dbIndex - from redisDbIndexForScopedRunEnv; skip if null
 * @returns {string}
 */
function applyRedisDbIndexToEnvContent(content, dbIndex) {
  if (dbIndex === null || dbIndex === undefined || typeof content !== 'string') {
    return content;
  }
  const lines = content.split('\n');
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return line;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (key === 'REDIS_DB') {
      return `${key}=${dbIndex}`;
    }
    if (key === 'REDIS_URL' && value && !value.startsWith('kv://')) {
      return `${key}=${setRedisUrlDbIndex(value, dbIndex)}`;
    }
    return line;
  });
  return out.join('\n');
}

module.exports = { applyRedisDbIndexToEnvContent, setRedisUrlDbIndex };
