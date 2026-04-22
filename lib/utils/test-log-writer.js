/**
 * Test log writer - writes debug logs to integration/<systemKey>/logs/
 * Sanitization (tokens, secrets) is done by dataplane before responses are returned.
 *
 * @fileoverview Write test request/response logs for debugging
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Prepare object for JSON serialization (handles circular refs)
 * @param {*} obj - Object to prepare
 * @param {Set} [seen] - Set of seen object references (for circular refs)
 * @returns {*} Copy safe for JSON.stringify
 */
function sanitizeForLog(obj, seen = new Set()) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeForLog(item, seen));
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = sanitizeForLog(value, seen);
  }
  return out;
}

/**
 * Write test log to integration/<systemKey>/logs/<logType>-<timestamp>.json
 * @async
 * @param {string} appKey - Integration folder name under integration/ (used for path)
 * @param {Object} data - Log data (request, response) - will be sanitized
 * @param {string} [logType] - Log type prefix (default: test-integration)
 * @param {string} [integrationBaseDir] - Base dir for integration (default: cwd/integration)
 * @returns {Promise<string>} Path to written file
 * @throws {Error} If write fails
 */
async function writeTestLog(appKey, data, logType = 'test-integration', integrationBaseDir) {
  const baseDir = integrationBaseDir || path.join(process.cwd(), 'integration');
  const logsDir = path.join(baseDir, appKey, 'logs');
  await fs.mkdir(logsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${logType}-${timestamp}.json`;
  const filePath = path.join(logsDir, filename);
  const sanitized = sanitizeForLog(data);
  await fs.writeFile(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
  return filePath;
}

module.exports = {
  sanitizeForLog,
  writeTestLog
};
