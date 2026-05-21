/**
 * @fileoverview Parse JSON array and NDJSON record fixture files (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');

/**
 * @param {string} content
 * @returns {Object[]}
 */
function parseNdjsonContent(content) {
  const lines = String(content).split(/\r?\n/);
  const records = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`NDJSON parse error at line ${i + 1}: ${err.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`NDJSON line ${i + 1}: expected a JSON object`);
    }
    records.push(parsed);
  }
  return records;
}

/**
 * @param {string} content
 * @returns {Object[]}
 */
function parseJsonArrayContent(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`JSON parse error: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('JSON file must be a top-level array of objects');
  }
  parsed.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`JSON array index ${index}: expected an object`);
    }
  });
  return parsed;
}

/**
 * Parse a local record fixture file.
 * @param {string} filePath
 * @param {'json'|'ndjson'} format
 * @returns {Object[]}
 */
function parseRecordFile(filePath, format) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (format === 'ndjson') {
    return parseNdjsonContent(content);
  }
  return parseJsonArrayContent(content);
}

/**
 * Rough payload size estimate for dry-run (bytes).
 * @param {Object[]} records
 * @returns {number}
 */
function estimatePayloadBytes(records) {
  return Buffer.byteLength(JSON.stringify(records), 'utf8');
}

module.exports = {
  parseRecordFile,
  parseNdjsonContent,
  parseJsonArrayContent,
  estimatePayloadBytes
};
