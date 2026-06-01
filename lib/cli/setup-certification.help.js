/**
 * @fileoverview Help text for Enterprise AI Certification CLI commands (plan 150.0).
 */

'use strict';

const VERIFY_OPERATIONS_HELP_AFTER = `
Examples:
  $ aifabrix verify-operations hubspot
  $ aifabrix verify-operations hubspot -v
  $ aifabrix verify-operations hubspot --no-sync

Notes:
  - Orchestrates validate → test → test-integration → test-e2e for the system.
  - Default output shows Operational Readiness % and OPERATIONS VERIFIED/FAILED only.
  - -v / --verbose adds readiness breakdown and verification step checklist at the end.
  - -v does not enable upload sidecar logs or inner E2E poll spinners (use aifabrix upload -v for upload detail).
  - Low-level commands (validate, test, test-integration, test-e2e) remain for debugging.
  - Upload governance scenario packs before verify-governance: aifabrix upload <systemKey>
`;

const VERIFY_TRUST_HELP_AFTER = `
Examples:
  $ aifabrix verify-trust hubspot
  $ aifabrix verify-trust hubspot -v --revalidate
  $ aifabrix verify-trust hubspot --no-sync --json

Notes:
  - For one datasource: aifabrix datasource verify-trust <datasourceKey>
  - Does not call external vendor APIs (use verify-operations / test-e2e for connectivity).
  - Local integration files are published before run unless --no-sync.
`;

const VERIFY_GOVERNANCE_HELP_AFTER = `
Examples:
  $ aifabrix verify-governance hubspot
  $ aifabrix verify-governance hubspot -v
  $ aifabrix verify-governance hubspot --pack scenarios/default.yaml

Notes:
  - Default: runs persisted scenario packs from the dataplane (upload via aifabrix upload).
  - --pack is an authoring override only; product path uses DB packs per datasource.
  - Does not call vendor APIs (use verify-operations for connectivity).
  - Requires governance:evaluate on the operator token (see permissions.md).
`;

const LIFECYCLE_HELP_AFTER = `
Examples:
  $ aifabrix lifecycle hubspot
  $ aifabrix lifecycle hubspot -v
  $ aifabrix lifecycle hubspot --run
  $ aifabrix lifecycle hubspot --run --no-sync

Notes:
  - Default: certification report only (GET persisted pillar results from dataplane).
  - --run executes missing verify steps, then prints the report (publishes local files first unless --no-sync).
  - Recommended order: upload → verify-operations → verify-trust → verify-governance → lifecycle
  - Tier is never inflated — incomplete pillars show NOT VERIFIED and actionable recommendations.
`;

module.exports = {
  VERIFY_OPERATIONS_HELP_AFTER,
  VERIFY_TRUST_HELP_AFTER,
  VERIFY_GOVERNANCE_HELP_AFTER,
  LIFECYCLE_HELP_AFTER
};
