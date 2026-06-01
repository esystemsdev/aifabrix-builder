/**
 * Resolve application key from controller list payloads (manual API tests).
 * GET /environments/{env}/applications/{appKey} expects the application `key`, not row `id`.
 */

'use strict';

/**
 * @param {unknown} listResponse
 * @returns {unknown[]}
 */
function applicationItemsFromListResponse(listResponse) {
  if (!listResponse || typeof listResponse !== 'object') {
    return [];
  }
  const data = listResponse.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    const nested = data.items ?? data.data;
    if (Array.isArray(nested)) {
      return nested;
    }
  }
  return [];
}

/**
 * @param {unknown} item
 * @returns {string|null}
 */
function applicationKeyFromListItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const key = item.key ?? item.appKey ?? item.application;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

module.exports = {
  applicationItemsFromListResponse,
  applicationKeyFromListItem
};
