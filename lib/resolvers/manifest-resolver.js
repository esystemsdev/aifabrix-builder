/**
 * Shared remote manifest lookup helpers (dataplane).
 *
 * This module does not decide *when* to fetch; callers can treat failures as
 * \"not authenticated\" or \"remote unavailable\" depending on their UX needs.
 *
 * @fileoverview Remote manifest fetch helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { resolveDataplaneAndAuth } = require('../commands/upload');
const { getExternalSystemConfig } = require('../api/external-systems.api');
const { getDatasourceConfig } = require('../api/datasources-core.api');

/**
 * @param {any} maybeEnvelope
 * @returns {{ isFailure: boolean, status: number, errorType: string|undefined, message: string|undefined }}
 */
function unwrapApiFailure(maybeEnvelope) {
  if (!maybeEnvelope || typeof maybeEnvelope !== 'object') {
    return { isFailure: false, status: 0, errorType: undefined, message: undefined };
  }

  if (maybeEnvelope.success !== false) {
    return { isFailure: false, status: 0, errorType: undefined, message: undefined };
  }

  return {
    isFailure: true,
    status: Number(maybeEnvelope.status) || 0,
    errorType: maybeEnvelope.errorType,
    message: maybeEnvelope.error || maybeEnvelope.formattedError || maybeEnvelope.message
  };
}

/**
 * @param {{ status: number, errorType: string|undefined, message: string|undefined }} failure
 * @returns {string|undefined}
 */
function failureCodeFrom(failure) {
  if (failure.errorType === 'notfound' || failure.status === 404) return 'not_found';
  if (/Authentication required\./i.test(String(failure.message || ''))) return 'not_authenticated';
  return undefined;
}

/**
 * Fetch running manifest for one external system key (includes dataSources[]).
 *
 * @param {string} systemKey
 * @param {{ silent?: boolean }} [opts]
 * @returns {Promise<{ ok: true, dataplaneUrl: string, authConfig: Object, manifest: any } | { ok: false, error: string, code?: string }>}
 */
async function tryFetchRunningManifest(systemKey, opts = {}) {
  try {
    const { dataplaneUrl, authConfig } = await resolveDataplaneAndAuth(String(systemKey || '').trim(), {
      silent: opts.silent === true
    });
    const res = await getExternalSystemConfig(dataplaneUrl, systemKey, authConfig);
    const manifest = res?.data?.data ?? res?.data ?? res;
    return { ok: true, dataplaneUrl, authConfig, manifest };
  } catch (e) {
    const msg = e?.message || String(e);
    const code = /Authentication required\./i.test(msg) ? 'not_authenticated' : undefined;
    return { ok: false, error: msg, code };
  }
}

/**
 * @param {any} runningManifest
 * @param {string} datasourceKey
 * @returns {any|null}
 */
function findDatasourceInRunningManifest(runningManifest, datasourceKey) {
  const dsKey = String(datasourceKey || '').trim();
  const dataSources = runningManifest?.dataSources;
  if (!Array.isArray(dataSources)) return null;
  return dataSources.find((d) => d && d.key === dsKey) || null;
}

module.exports = {
  tryFetchRunningManifest,
  findDatasourceInRunningManifest,
  /**
   * Fetch one datasource config by key/id using dataplane auth resolved from a systemKey.
   *
   * This is useful for cross-system FK target validation because datasource keys are globally unique.
   *
   * @param {string} systemKey - any system key usable for auth resolution
   * @param {string} datasourceKey - datasource key to fetch config for
   * @param {{ silent?: boolean }} [opts]
   * @returns {Promise<{ ok: true, datasourceConfig: any } | { ok: false, error: string, code?: string }>}
   */
  async tryFetchDatasourceConfig(systemKey, datasourceKey, opts = {}) {
    try {
      const trimmedSystemKey = String(systemKey || '').trim();
      const trimmedDatasourceKey = String(datasourceKey || '').trim();

      const { dataplaneUrl, authConfig } = await resolveDataplaneAndAuth(trimmedSystemKey, {
        silent: opts.silent === true
      });

      const res = await getDatasourceConfig(dataplaneUrl, trimmedDatasourceKey, authConfig);
      const outerFailure = unwrapApiFailure(res);
      if (outerFailure.isFailure) {
        return {
          ok: false,
          error: outerFailure.message || `Failed to fetch datasource config: ${trimmedDatasourceKey}`,
          code: failureCodeFrom(outerFailure)
        };
      }

      const cfg = res?.data?.data ?? res?.data ?? res;
      const innerFailure = unwrapApiFailure(cfg);
      if (innerFailure.isFailure) {
        return {
          ok: false,
          error: innerFailure.message || `Failed to fetch datasource config: ${trimmedDatasourceKey}`,
          code: failureCodeFrom(innerFailure)
        };
      }

      return { ok: true, datasourceConfig: cfg };
    } catch (e) {
      const msg = e?.message || String(e);
      const code = /Authentication required\./i.test(msg) ? 'not_authenticated' : undefined;
      return { ok: false, error: msg, code };
    }
  }
};

