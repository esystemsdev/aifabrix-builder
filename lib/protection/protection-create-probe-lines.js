/**
 * @fileoverview TTY line builders for protection create probes (keeps probe async functions small).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const {
  sectionTitle,
  headerKeyValue,
  metadata,
  formatProgress,
  formatSuccessLine
} = require('../utils/cli-test-layout-chalk');

const SEP = chalk.gray('────────────────────────────────────────');

/**
 * @param {string} key
 * @returns {string[]}
 */
function startDatasourceProbeLines(key) {
  return [sectionTitle('Datasource (dataplane)'), SEP, formatProgress(`Fetching datasource "${key}"…`)];
}

/**
 * @param {string[]} lines
 * @param {Object} row
 * @param {string} key
 * @param {string} dataplaneUrl
 */
function appendDatasourceCoreFields(lines, row, key, dataplaneUrl) {
  lines.push(formatSuccessLine(`Datasource "${key}" found`));
  lines.push(metadata(`Dataplane: ${dataplaneUrl}`));
  lines.push(headerKeyValue('Key:', row.key ?? key));
  lines.push(headerKeyValue('Display name:', row.displayName ?? '—'));
  lines.push(headerKeyValue('System key:', row.systemKey ?? '—'));
  const ver = row.version;
  lines.push(headerKeyValue('Version:', ver !== undefined && ver !== null ? String(ver) : '—'));
  lines.push(headerKeyValue('Enabled:', String(row.enabled !== false)));
}

/**
 * @param {string[]} lines
 * @param {Object} row
 */
function appendDatasourceOptionalTypes(lines, row) {
  if (row.entityType) {
    lines.push(headerKeyValue('Entity type:', String(row.entityType)));
  }
  if (row.resourceType) {
    lines.push(headerKeyValue('Resource type:', String(row.resourceType)));
  }
}

/**
 * @param {string[]} lines
 * @param {Object} row
 */
function appendDatasourceVerboseBlock(lines, row) {
  const pick = ['id', 'key', 'displayName', 'systemKey', 'version', 'enabled', 'entityType', 'resourceType'];
  const extra = {};
  for (const p of pick) {
    if (row[p] !== undefined) {
      extra[p] = row[p];
    }
  }
  lines.push('');
  lines.push(chalk.gray('Verbose (subset):'));
  lines.push(chalk.gray(JSON.stringify(extra, null, 2)));
}

/**
 * @param {string[]} lines
 * @param {Object} row
 * @param {string} key
 * @param {string} dataplaneUrl
 * @param {Object} opts
 */
function appendDatasourceSuccessDetail(lines, row, key, dataplaneUrl, opts) {
  appendDatasourceCoreFields(lines, row, key, dataplaneUrl);
  appendDatasourceOptionalTypes(lines, row);
  if (opts.verbose && row) {
    appendDatasourceVerboseBlock(lines, row);
  }
  lines.push('');
}

/**
 * @param {string} key
 * @returns {string[]}
 */
function startDimensionProbeLines(key) {
  return [
    sectionTitle('Dimension (Controller catalog)'),
    SEP,
    formatProgress(`Fetching dimension "${key}"…`)
  ];
}

/**
 * @param {string[]} lines
 * @param {Object} row
 * @param {string} controllerUrl
 * @param {Object} opts
 */
function appendDimensionSuccessDetail(lines, row, controllerUrl, opts) {
  lines.push(formatSuccessLine(`Dimension "${row.key}" found`));
  lines.push(metadata(`Controller: ${controllerUrl}`));
  lines.push(headerKeyValue('Key:', row.key));
  lines.push(headerKeyValue('Display:', row.displayName ?? '—'));
  lines.push(headerKeyValue('Data type:', row.dataType ?? '—'));
  lines.push(headerKeyValue('Value type:', row.valueType ?? 'static'));
  lines.push(headerKeyValue('Required:', String(row.isRequired === true)));
  if (Array.isArray(row.dimensionValues) && row.dimensionValues.length > 0) {
    lines.push(
      headerKeyValue('Catalog values:', `${row.dimensionValues.length} (static/baseline)`)
    );
  } else if (row.valueType === 'dynamic' || row.valueType === 'both') {
    lines.push(headerKeyValue('Catalog values:', '— (dynamic / projection)'));
  }
  if (opts.verbose && Array.isArray(row.dimensionValues) && row.dimensionValues.length) {
    lines.push('');
    lines.push(chalk.gray('Sample values (first 5):'));
    row.dimensionValues.slice(0, 5).forEach((v) => {
      const val = v && v.value !== undefined && v.value !== null ? String(v.value) : '—';
      const dn = v?.displayName ? ` (${v.displayName})` : '';
      lines.push(chalk.gray(`  ${val}${dn}`));
    });
  }
  lines.push('');
}

module.exports = {
  SEP,
  startDatasourceProbeLines,
  appendDatasourceSuccessDetail,
  startDimensionProbeLines,
  appendDimensionSuccessDetail
};
