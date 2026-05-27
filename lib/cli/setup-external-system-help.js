/**
 * @fileoverview Help-after blocks for external system lifecycle CLI commands.
 */

'use strict';

const UPLOAD_HELP_AFTER = `
Examples:
  # Publish integration/<systemKey>/ to the dataplane (typical lab flow after validate + resolve)
  $ aifabrix upload hubspot-demo
  $ aifabrix upload hubspot-demo --verbose
  $ aifabrix upload hubspot-demo --probe

  # Build and validate payload only (no API calls)
  $ aifabrix upload hubspot-demo --dry-run

  # Short summary after publish
  $ aifabrix upload hubspot-demo --minimal

  # Protection manifests (integration/.protection/ at repo root)
  $ aifabrix upload .protection
  $ aifabrix upload .protection --warnings-as-errors --no-sync

Notes:
  - Requires login (aifabrix auth status).
  - Reads files under integration/<systemKey>/ (system JSON, datasources, credentials).
  - --probe runs dataplane runtime checks after publish (slower; common in Session 1).
  - test-e2e and test-integration publish local files first by default; use --no-sync on those commands to skip.
  - After dimension/FK edits on active datasources, use --force (or test-e2e / test-integration / datasource test-* with --sync --force).
  - For one datasource only: aifabrix datasource upload <datasourceKey>
`;

const DOWNLOAD_HELP_AFTER = `
Examples:
  # Pull an existing system from the dataplane into integration/<systemKey>/
  $ aifabrix download hubspot-demo
  $ aifabrix download hubspot-demo --format yaml

  # Preview without writing files
  $ aifabrix download hubspot-demo --dry-run

Notes:
  - Requires login and a system that already exists on the dataplane.
  - Overwrite prompts apply when integration/<systemKey>/ already exists (--force for README).
`;

const DELETE_HELP_AFTER = `
Examples:
  # Remove system and datasources from the dataplane
  $ aifabrix delete hubspot-demo
  $ aifabrix delete hubspot-demo --yes

Notes:
  - Does not delete local files under integration/<systemKey>/.
  - Use when cleaning up test systems or fixing upload schema overlap (then re-run wizard).
`;

module.exports = {
  UPLOAD_HELP_AFTER,
  DOWNLOAD_HELP_AFTER,
  DELETE_HELP_AFTER
};
