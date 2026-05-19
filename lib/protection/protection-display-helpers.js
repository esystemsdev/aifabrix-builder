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
  metadata,
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
 * Stacked label + value (wraps long protection keys and hashes cleanly).
 * @param {string[]} lines
 * @param {string} label
 * @param {string|number|null|undefined} value
 */
function appendProtectionShowField(lines, label, value) {
  const text =
    value === null || value === undefined || String(value).trim() === '' ? '—' : String(value);
  lines.push(chalk.gray(label));
  lines.push(`  ${chalk.bold.white(text)}`);
}

/**
 * @param {string[]} lines
 * @param {string} title
 */
function appendProtectionShowSection(lines, title) {
  lines.push('');
  lines.push(sectionTitle(title));
  lines.push(SEP);
}

/**
 * @param {string|undefined|null} iso
 * @returns {string}
 */
function formatProtectionShowTimestamp(iso) {
  if (!iso || String(iso).trim() === '' || iso === '—') {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso);
  }
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

/**
 * @param {string|undefined|null} hash
 * @param {boolean} [verbose]
 * @returns {string}
 */
function formatProtectionShowHash(hash, verbose) {
  if (!hash || String(hash).trim() === '') {
    return '—';
  }
  const s = String(hash);
  if (verbose || s.length <= 24) {
    return s;
  }
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

/**
 * @param {string[]} lines
 * @param {Object} status
 * @param {Object} manifest
 */
function appendProtectionShowProjectionSection(lines, status, manifest) {
  const grants = Array.isArray(status?.grants) ? status.grants : [];
  const staticCount = grants.filter((g) => g.effectiveValueType === 'static').length;
  const dynamicCount = grants.filter((g) => g.effectiveValueType === 'dynamic').length;
  const ruleCount = Array.isArray(manifest?.spec?.rules) ? manifest.spec.rules.length : 0;
  const grantTotal = status?.grantCount ?? grants.length;
  const projectionAt =
    status?.lastProjectionRunAt || status?.lastSuccessfulProjectionRunAt || '—';

  appendProtectionShowSection(lines, 'Projection cache');
  appendProtectionShowField(
    lines,
    'Last run',
    formatProtectionShowTimestamp(projectionAt === '—' ? null : projectionAt)
  );
  appendProtectionShowField(lines, 'Rules in manifest', String(ruleCount));
  appendProtectionShowField(
    lines,
    'Grants materialized',
    `${grantTotal} (${staticCount} static, ${dynamicCount} dynamic)`
  );
  appendProtectionShowField(
    lines,
    'Dynamic values materialized',
    String(status?.dynamicValueCount ?? '—')
  );
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 * @param {Object} [opts]
 */
function appendProtectionShowHeader(lines, payload, opts = {}) {
  const { manifest, status } = payload;
  const datasourceKey = protectionShowDatasourceKey(manifest, status);
  const enabled = manifest?.enabled !== false;
  const protectionKey = manifest?.key || status?.protectionKey || '—';
  const revision = String(manifest?.currentRevision ?? status?.currentRevision ?? '—');
  const configHash = manifest?.configHash || status?.configHash || null;
  const lastUpload = manifest?.lastDeployedAt || status?.lastDeployedAt || null;

  lines.push(chalk.bold.white(datasourceKey));
  lines.push(SEP);
  appendProtectionShowField(lines, 'Status', enabled ? 'Enabled' : 'Disabled');

  appendProtectionShowSection(lines, 'Manifest');
  appendProtectionShowField(lines, 'Protection key', protectionKey);
  appendProtectionShowField(lines, 'Datasource', datasourceKey);
  appendProtectionShowField(lines, 'Revision', revision);

  appendProtectionShowSection(lines, 'Deployment');
  appendProtectionShowField(lines, 'Last upload', formatProtectionShowTimestamp(lastUpload));
  appendProtectionShowField(
    lines,
    'Content hash',
    formatProtectionShowHash(configHash, opts.verbose === true)
  );
  if (opts.verbose && configHash) {
    appendProtectionShowField(lines, 'Content hash (full)', configHash);
  }

  appendProtectionShowProjectionSection(lines, status, manifest);
}

/**
 * @param {string[]} lines
 * @param {Object} payload
 */
function appendProtectionShowContextFooter(lines, payload) {
  const environment = payload.environment || '—';
  const dataplaneUrl = payload.dataplaneUrl || '';
  lines.push('');
  if (dataplaneUrl) {
    lines.push(metadata(`Environment: ${environment} · Dataplane: ${dataplaneUrl}`));
  } else {
    lines.push(metadata(`Environment: ${environment}`));
  }
}

/**
 * @param {string[]} lines
 * @param {Object} status
 * @param {Object} manifest
 * @deprecated Use appendProtectionShowProjectionSection via appendProtectionShowHeader
 */
function appendProtectionShowCounts(lines, status, manifest) {
  appendProtectionShowProjectionSection(lines, status, manifest);
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

/**
 * @param {Object} row
 * @returns {string}
 */
function protectionListCardTitle(row) {
  return String(row?.datasourceKey || row?.displayName || row?.key || '—').trim() || '—';
}

/**
 * @param {string[]} lines
 * @param {Object} row
 * @param {Object} [opts]
 */
function appendProtectionListCard(lines, row, opts = {}) {
  lines.push(chalk.bold(protectionListCardTitle(row)));
  lines.push(SEP);
  lines.push(headerKeyValue('Protection key:', row?.key ?? '—'));
  lines.push(headerKeyValue('Datasource:', row?.datasourceKey ?? '—'));
  lines.push(headerKeyValue('Display name:', row?.displayName ?? '—'));
  lines.push(headerKeyValue('Enabled:', formatProtectionEnabledLabel(row?.enabled)));
  lines.push(
    headerKeyValue('Revision:', String(row?.currentRevision ?? row?.revision ?? '—'))
  );
  if (opts.verbose && row?.lastDeployedAt) {
    lines.push(headerKeyValue('Last deployed:', row.lastDeployedAt));
  }
  lines.push('');
}

/**
 * @param {string[]} lines
 * @param {Object[]} items
 * @param {Object} [opts]
 */
function appendProtectionListCards(lines, items, opts = {}) {
  for (const row of items) {
    appendProtectionListCard(lines, row, opts);
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

  appendProtectionListCards(lines, items, opts);
  appendProtectionListMetaFooter(lines, meta, items.length);
}

function appendProtectionShowVerboseGrants(lines, grants) {
  appendProtectionShowSection(lines, 'Grants by rule');
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
  appendProtectionShowContextFooter,
  appendProtectionShowCounts,
  appendProtectionShowVerboseGrants,
  formatProtectionShowHash,
  formatProtectionShowTimestamp,
  appendProtectionListTable,
  formatProtectionEnabledLabel,
  formatStatusKeyValue
};
