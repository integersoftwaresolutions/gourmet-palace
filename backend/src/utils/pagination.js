/**
 * Shared list pagination for API query params.
 * Use from any list endpoint so page/limit/total behavior stays consistent.
 */

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

/**
 * @param {Record<string, unknown>} query
 * @param {{ defaultLimit?: number, maxLimit?: number, maxPage?: number }} [options]
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit ?? 25;
  const maxLimit = options.maxLimit ?? 100;
  const maxPage = options.maxPage ?? 10000;
  const page = Math.min(maxPage, toPositiveInt(query.page, 1));
  const limit = Math.min(maxLimit, toPositiveInt(query.limit, defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * @param {{ page: number, limit: number, total: number }} input
 * @returns {{ page: number, limit: number, total: number, totalPages: number, hasNext: boolean, hasPrev: boolean }}
 */
function paginationMeta({ page, limit, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / limit);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    limit,
    total: safeTotal,
    totalPages,
    hasNext: totalPages > 0 && safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

/**
 * Attach pagination fields beside a named collection key.
 * @param {string} key
 * @param {unknown[]} items
 * @param {{ page: number, limit: number, total: number }} paging
 */
function paginatedResult(key, items, paging) {
  return {
    [key]: items,
    ...paginationMeta(paging),
  };
}

module.exports = { parsePagination, paginationMeta, paginatedResult };
