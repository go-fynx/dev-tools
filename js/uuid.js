/**
 * UUID utility logic
 * Uses crypto.randomUUID() for v4, uuid lib (CDN) for v1 and v5
 */

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace for dev-tools

/**
 * Generate UUID v4 using native crypto API
 * @returns {string}
 */
function generateUUIDv4() {
  return crypto.randomUUID();
}

/**
 * Generate UUID v1 (timestamp-based) - requires uuid lib
 * @returns {string}
 */
function generateUUIDv1() {
  if (typeof uuid !== 'undefined' && uuid.v1) {
    return uuid.v1();
  }
  return generateUUIDv4();
}

/**
 * Validate UUID format (canonical: 8-4-4-4-12 hex)
 * @param {string} str
 * @returns {boolean}
 */
function isValidUUID(str) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && regex.test(str.trim());
}

/**
 * String to UUID v5 (deterministic, namespace-based)
 * @param {string} str - Input string
 * @returns {string|null} - UUID or null if uuid lib not loaded
 */
function stringToUUID(str) {
  if (typeof uuid !== 'undefined' && uuid.v5) {
    return uuid.v5(str.trim(), UUID_NAMESPACE);
  }
  return null;
}

/**
 * UUID to canonical string (validate and normalize)
 * @param {string} str - UUID string (any format)
 * @returns {string|null} - Lowercase canonical format or null if invalid
 */
function uuidToString(str) {
  const trimmed = str.trim().toLowerCase();
  if (!isValidUUID(trimmed)) return null;
  return trimmed;
}
