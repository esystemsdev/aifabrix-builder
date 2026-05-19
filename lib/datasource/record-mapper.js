/**
 * @fileoverview Map fixture payloads to canonical bulk sync records (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Object} obj
 * @returns {boolean}
 */
function isCanonicalBulkRecord(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.key === 'string' &&
    obj.key.trim().length > 0 &&
    typeof obj.recordType === 'string' &&
    obj.recordType.trim().length > 0 &&
    obj.metadata !== undefined &&
    obj.metadata !== null &&
    typeof obj.metadata === 'object' &&
    !Array.isArray(obj.metadata)
  );
}

/**
 * @param {string[]} primaryKeyFields
 * @param {Object} payload
 * @returns {string}
 */
function buildKeyFromPrimaryKey(primaryKeyFields, payload) {
  if (!primaryKeyFields.length) {
    throw new Error('Datasource primaryKey is empty; provide records with a key field');
  }
  if (primaryKeyFields.length === 1) {
    const field = primaryKeyFields[0];
    const value = payload[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`Missing primary key field '${field}' in record payload`);
    }
    return String(value);
  }
  const parts = [];
  for (const field of primaryKeyFields) {
    const value = payload[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`Missing composite primary key field '${field}' in record payload`);
    }
    parts.push(`${field}=${String(value)}`);
  }
  return parts.join(',');
}

/**
 * @param {Object} datasource
 * @param {Object} payload
 * @returns {import('../api/types/records-bulk.types').ExternalBulkRecord}
 */
function mapPayloadToBulkRecord(datasource, payload) {
  const primaryKey = Array.isArray(datasource.primaryKey) ? datasource.primaryKey : [];
  const recordType =
    typeof datasource.resourceType === 'string' && datasource.resourceType.trim()
      ? datasource.resourceType.trim()
      : 'record';
  const key = buildKeyFromPrimaryKey(primaryKey, payload);
  let displayName = '';
  const labelKey = datasource.labelKey;
  if (Array.isArray(labelKey) && labelKey.length > 0) {
    displayName = labelKey
      .map(field => payload[field])
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
      .map(v => String(v))
      .join(' ');
  } else if (typeof labelKey === 'string' && labelKey.trim() && payload[labelKey] !== undefined && payload[labelKey] !== null) {
    displayName = String(payload[labelKey]);
  }
  const metadata = { ...payload };
  if (metadata.externalId === undefined) {
    metadata.externalId = key;
  }
  return {
    key,
    displayName: displayName || '',
    recordType,
    metadata
  };
}

/**
 * @param {Object[]} rawRecords
 * @param {Object} datasource
 * @returns {import('../api/types/records-bulk.types').ExternalBulkRecord[]}
 */
function normalizeRecordsForBulk(rawRecords, datasource) {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw new Error('Record file is empty after parse');
  }
  return rawRecords.map((row, index) => {
    try {
      if (isCanonicalBulkRecord(row)) {
        const meta = { ...row.metadata };
        if (meta.externalId === undefined) {
          meta.externalId = row.key;
        }
        return {
          key: String(row.key).trim(),
          displayName:
            row.displayName !== undefined && row.displayName !== null
              ? String(row.displayName)
              : '',
          recordType: String(row.recordType).trim(),
          metadata: meta
        };
      }
      return mapPayloadToBulkRecord(datasource, row);
    } catch (err) {
      throw new Error(`Record ${index + 1}: ${err.message}`);
    }
  });
}

module.exports = {
  isCanonicalBulkRecord,
  buildKeyFromPrimaryKey,
  mapPayloadToBulkRecord,
  normalizeRecordsForBulk
};
