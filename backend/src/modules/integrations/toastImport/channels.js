const CANONICAL = new Set(['dine_in', 'takeout', 'delivery', 'third_party', 'direct_online', 'unknown']);

const DEFAULT_PATTERNS = {
  third_party: [
    'doordash',
    'door dash',
    'uber eats',
    'ubereats',
    'grubhub',
    'grub hub',
    'chownow',
    'chow now',
    'postmates',
    'ezcater',
  ],
  direct_online: [
    'online ordering',
    'toast online',
    'online -',
    'online takeout',
    'online delivery',
  ],
  delivery: [
    'toast delivery',
    'in-house delivery',
    'in house delivery',
    'delivery',
  ],
  takeout: [
    'takeout',
    'take out',
    'take-out',
    'to go',
    'togo',
    'pick up',
    'pickup',
    'pick-up',
    'curbside',
    'phone order',
    'call in',
  ],
  dine_in: [
    'dine in',
    'dine-in',
    'dining room',
    'table service',
    'eat in',
  ],
};

function mapChannel(raw, customMap = {}) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return 'unknown';

  for (const [canonical, patterns] of Object.entries(customMap || {})) {
    if (!CANONICAL.has(canonical) || canonical === 'unknown') continue;
    if ((patterns || []).some((p) => text.includes(String(p).toLowerCase()))) return canonical;
  }

  // Prefer more specific marketplace / online before generic "delivery".
  for (const key of ['third_party', 'direct_online', 'delivery', 'takeout', 'dine_in']) {
    if (DEFAULT_PATTERNS[key].some((p) => text.includes(p))) return key;
  }

  if (['dine_in', 'takeout', 'delivery', 'third_party', 'direct_online'].includes(text)) return text;
  return 'unknown';
}

module.exports = { mapChannel, DEFAULT_PATTERNS, CANONICAL };
