/**
 * @fileoverview Helpers for protection TTY formatters (keeps display module under limits).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const {
  sectionTitle,
  headerKeyValue,
  formatStatusKeyValue,
  formatBlockingError,
  formatSuccessLine,
  formatWarningLine
} = require('../utils/cli-test-layout-chalk');

const SEP = chalk.gray('────────────────────────────────────────');

/**
 * @param {Object} row
 * @returns {string}
 */
function taskStableCode(row) {
  return String(row?.errorCode || row?.stableCode || row?.taskId || 'ISSUE');
}

/**
 * @param {string[]} lines
 * @param {Object[]} rows
 * @param {'FAIL'|'WARN'|'PASS'} status
 * @param {Object} opts
 */
function appendTaskRows(lines, rows, status, opts = {}) {
  const cap = opts.verbose ? rows.length : Math.min(rows.length, opts.maxIssues || 10);
  const filtered = rows.filter((r) => String(r?.status || '').toUpperCase() === status);
  if (!filtered.length) {
    return;
  }
  const title =
    status === 'FAIL'
      ? 'Validation issues:'
      : status === 'WARN'
        ? 'Warnings:'
        : 'Checks passed:';
  lines.push(sectionTitle(title));
  for (let i = 0; i < Math.min(cap, filtered.length); i += 1) {
    const row = filtered[i];
    const code = taskStableCode(row);
    const msg = row?.message ? String(row.message) : '';
    const prefix = status === 'FAIL' ? '✖' : status === 'WARN' ? '⚠' : '✔';
    const lineFn = status === 'WARN' ? formatWarningLine : (t) => t;
    lines.push(lineFn(`  ${prefix} ${code} ${msg}`.trim()));
    if (row?.hint) {
      lines.push(chalk.gray(`      hint: ${row.hint}`));
    }
    if (row?.schemaPath) {
      lines.push(chalk.gray(`      path: ${row.schemaPath}`));
    }
  }
}

/**
 * @param {string[]} lines
 * @param {Object} meta
 */
function appendProtectionReportHeader(lines, meta) {
  if (meta.protectionKey) {
    lines.push(headerKeyValue('Protection:', meta.protectionKey));
  }
  if (meta.datasourceKey) {
    lines.push(headerKeyValue('Datasource:', meta.datasourceKey));
  }
}

/**
 * @param {string[]} lines
 * @param {Object} sim
 */
function appendSimulationSection(lines, sim) {
  lines.push(sectionTitle('Simulation:'));
  if (sim.recordsSampled !== undefined && sim.recordsSampled !== null) {
    lines.push(`  Records sampled: ${sim.recordsSampled}`);
  }
  if (sim.grantsProjected !== undefined && sim.grantsProjected !== null) {
    lines.push(`  Grants projected: ${sim.grantsProjected}`);
  }
  if (sim.unresolvedPrincipals !== undefined && sim.unresolvedPrincipals !== null) {
    lines.push(`  Unresolved principals: ${sim.unresolvedPrincipals}`);
  }
}

/**
 * @param {string[]} lines
 * @param {number} failCount
 * @param {number} warnCount
 * @param {Object} opts
 */
function appendValidationSummarySection(lines, failCount, warnCount, opts) {
  lines.push(sectionTitle('Summary:'));
  if (failCount > 0 || (opts.warningsAsErrors && warnCount > 0)) {
    lines.push(formatBlockingError('Validation failed'));
    lines.push(headerKeyValue('Overall:', 'Failed'));
    return;
  }
  lines.push(formatSuccessLine('Validation passed'));
  lines.push(headerKeyValue('Overall:', warnCount > 0 ? 'Warnings' : 'OK'));
}

/**
 * @param {string[]} lines
 * @param {Object[]} results
 * @param {Object} opts
 * @param {string} okLabel
 */
function appendBatchResultRows(lines, results, okLabel) {
  for (const row of results) {
    if (row.ok) {
      lines.push(`${row.datasourceKey}`);
      lines.push(formatSuccessLine(`  ${okLabel}`));
    } else {
      lines.push(`${row.datasourceKey}`);
      lines.push(formatBlockingError(`  ${row.error || 'Failed'}`));
    }
    lines.push('');
  }
}

/**
 * @param {string[]} lines
 * @param {number} passed
 * @param {number} failed
 * @param {string} okMessage
 */
function appendBatchSummary(lines, passed, failed, okMessage) {
  lines.push(sectionTitle('Summary:'));
  if (failed > 0) {
    lines.push(formatBlockingError(`${passed} passed, ${failed} failed`));
    lines.push(headerKeyValue('Overall:', 'Failed'));
    return;
  }
  lines.push(formatSuccessLine(okMessage));
  lines.push(headerKeyValue('Overall:', 'OK'));
}

/**
 * @param {Object} manifest
 * @param {Object} status
 * @returns {string}
 */
function protectionShowDatasourceKey(manifest, status) {
  return manifest?.datasourceKey || status?.datasourceKey || '—';
}

/**
 * @param {string[]} lines
 * @param {Object} manifest
 * @param {Object} status
 */
function appendProtectionShowManifestLines(lines, manifest, status) {
  lines.push(headerKeyValue('Enabled:', manifest?.enabled === false ? 'no' : 'yes'));
  lines.push(headerKeyValue('Datasource:', protectionShowDatasourceKey(manifest, status)));
  lines.push(headerKeyValue('Protection key:', manifest?.key || status?.protectionKey || '—'));
  lines.push(headerKeyValue('Version:', String(manifest?.currentRevision ?? status?.currentRevision ?? '—')));
  lines.push(headerKeyValue('Content hash:', manifest?.configHash || status?.configHash || '—'));
  lines.push(headerKeyValue('Last upload:', manifest?.lastDeployedAt || status?.lastDeployedAt || '—'));
  const projectionAt =
    status?.lastProjectionRunAt || status?.lastSuccessfulProjectionRunAt || '—';
  lines.push(headerKeyValue('Last projection run:', projectionAt));
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 */
function appendProtectionShowHeader(lines, payload) {
  const { manifest, status, environment, dataplaneUrl } = payload;
  lines.push(sectionTitle(`Protection: ${protectionShowDatasourceKey(manifest, status)}`));
  lines.push(SEP);
  lines.push(headerKeyValue('Environment:', environment || '—'));
  lines.push(headerKeyValue('Dataplane:', dataplaneUrl || '—'));
  lines.push('');
  appendProtectionShowManifestLines(lines, manifest, status);
}

/**
 * @param {string[]} lines
 * @param {Object} status
 * @param {Object} manifest
 */
function appendProtectionShowCounts(lines, status, manifest) {
  const grants = Array.isArray(status?.grants) ? status.grants : [];
  const staticCount = grants.filter((g) => g.effectiveValueType === 'static').length;
  const dynamicCount = grants.filter((g) => g.effectiveValueType === 'dynamic').length;
  const ruleCount = Array.isArray(manifest?.spec?.rules) ? manifest.spec.rules.length : 0;
  lines.push(headerKeyValue('Rules:', `${ruleCount} total`));
  lines.push(
    headerKeyValue(
      'Grants (cached):',
      `${status?.grantCount ?? grants.length} (static: ${staticCount}, dynamic: ${dynamicCount})`
    )
  );
  lines.push(headerKeyValue('Dynamic values (cached):', String(status?.dynamicValueCount ?? '—')));
}

/**
 * @param {string[]} lines
 * @param {Object[]} grants
 */
/**
 * @param {boolean|undefined} enabled
 * @returns {string}
 */
function formatProtectionEnabledLabel(enabled) {
  if (enabled === true) {
    return 'yes';
  }
  if (enabled === false) {
    return 'no';
  }
  return '—';
}

const PROTECTION_LIST_COL = {
  KEY_WIDTH: 24,
  DS_WIDTH: 26,
  DISPLAY_WIDTH: 26,
  ENABLED_WIDTH: 8,
  REV_WIDTH: 8
};

/**
 * @returns {number}
 */
function protectionListSeparatorLength() {
  const c = PROTECTION_LIST_COL;
  return c.KEY_WIDTH + c.DS_WIDTH + c.DISPLAY_WIDTH + c.ENABLED_WIDTH + c.REV_WIDTH;
}

/**
 * @param {string[]} lines
 */
function appendProtectionListHeader(lines) {
  const c = PROTECTION_LIST_COL;
  const header =
    'Key'.padEnd(c.KEY_WIDTH) +
    'Datasource'.padEnd(c.DS_WIDTH) +
    'Display'.padEnd(c.DISPLAY_WIDTH) +
    'Enabled'.padEnd(c.ENABLED_WIDTH) +
    'Revision'.padEnd(c.REV_WIDTH);
  lines.push(chalk.gray(header));
  lines.push(chalk.gray('-'.repeat(protectionListSeparatorLength())));
}

/**
 * @param {Object} row
 * @returns {string}
 */
function formatProtectionListRow(row) {
  const c = PROTECTION_LIST_COL;
  const key = String(row?.key ?? '—')
    .padEnd(c.KEY_WIDTH)
    .slice(0, c.KEY_WIDTH);
  const datasource = String(row?.datasourceKey ?? '—')
    .padEnd(c.DS_WIDTH)
    .slice(0, c.DS_WIDTH);
  const display = String(row?.displayName ?? '—')
    .padEnd(c.DISPLAY_WIDTH)
    .slice(0, c.DISPLAY_WIDTH);
  const enabled = formatProtectionEnabledLabel(row?.enabled)
    .padEnd(c.ENABLED_WIDTH)
    .slice(0, c.ENABLED_WIDTH);
  const revision = String(row?.currentRevision ?? row?.revision ?? '—')
    .padEnd(c.REV_WIDTH)
    .slice(0, c.REV_WIDTH);
  return `${key}${datasource}${display}${enabled}${revision}`;
}

/**
 * @param {string[]} lines
 * @param {Object[]} items
 * @param {Object} [opts]
 */
function appendProtectionListRows(lines, items, opts = {}) {
  for (const row of items) {
    lines.push(formatProtectionListRow(row));
    if (opts.verbose && row?.lastDeployedAt) {
      lines.push(chalk.gray(`  Last deployed: ${row.lastDeployedAt}`));
    }
  }
}

/**
 * @param {string[]} lines
 * @param {Object} meta
 * @param {number} shown
 */
function appendProtectionListMetaFooter(lines, meta, shown) {
  if (!meta || typeof meta.totalItems !== 'number') {
    return;
  }
  const page = meta.currentPage ?? 1;
  const pageSize = meta.pageSize ?? shown;
  lines.push(
    chalk.gray(`  Showing ${shown} of ${meta.totalItems} (page ${page}, pageSize ${pageSize})`)
  );
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @param {Object} [opts]
 */
function appendProtectionListTable(lines, payload, opts = {}) {
  const environment = payload.environment || 'dev';
  const dataplaneUrl = payload.dataplaneUrl || '';
  const items = Array.isArray(payload.items) ? payload.items : [];
  const meta = payload.meta || null;

  lines.push(
    sectionTitle(
      `Protection manifests in ${environment} environment${dataplaneUrl ? ` (${dataplaneUrl})` : ''}:`
    )
  );
  lines.push('');

  if (!items.length) {
    lines.push(chalk.gray('  No protection manifests found.\n'));
    return;
  }

  appendProtectionListHeader(lines);
  appendProtectionListRows(lines, items, opts);
  lines.push('');
  appendProtectionListMetaFooter(lines, meta, items.length);
}

function appendProtectionShowVerboseGrants(lines, grants) {
  lines.push('');
  lines.push(sectionTitle('Grants by rule (-v):'));
  const byRule = new Map();
  for (const g of grants) {
    const rk = g.projectionRuleKey || '—';
    if (!byRule.has(rk)) {
      byRule.set(rk, []);
    }
    byRule.get(rk).push(g);
  }
  for (const [ruleKey, grantRows] of byRule) {
    lines.push(`  ${ruleKey}`);
    for (const g of grantRows) {
      lines.push(
        chalk.gray(`    ${g.dimensionKey} → ${g.effectiveValueType || g.valueType || '—'}`)
      );
    }
  }
}

module.exports = {
  taskStableCode,
  appendTaskRows,
  appendProtectionReportHeader,
  appendSimulationSection,
  appendValidationSummarySection,
  appendBatchResultRows,
  appendBatchSummary,
  appendProtectionShowHeader,
  appendProtectionShowCounts,
  appendProtectionShowVerboseGrants,
  appendProtectionListTable,
  formatProtectionEnabledLabel,
  formatStatusKeyValue
};
