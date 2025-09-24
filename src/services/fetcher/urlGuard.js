import { createValidationError } from '../../utils/errors/AppError.js';
import config from '../../config/config.js';

const PRIVATE_IPV4_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] }
];

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function withinRange(value, range) {
  for (let i = 0; i < 4; i += 1) {
    if (value[i] < range.start[i]) return false;
    if (value[i] > range.end[i]) return false;
  }
  return true;
}

function isIPv4(host) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isPrivateIPv4(host) {
  if (!isIPv4(host)) return false;
  const octets = host.split('.').map(Number);
  if (octets.some(octet => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }
  return PRIVATE_IPV4_RANGES.some(range => withinRange(octets, range));
}

function hostMatchesList(host, list) {
  return list.some(entry => host === entry || host.endsWith(`.${entry}`));
}

export function assertUrlAllowed(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw createValidationError('source.url must be a valid absolute URL', { cause: err });
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!['http:', 'https:'].includes(protocol)) {
    throw createValidationError('Only http and https protocols are supported');
  }
  if (config.security.enforceHttps && protocol !== 'https:') {
    throw createValidationError('Only https URLs are allowed for this service');
  }

  const host = parsed.hostname.toLowerCase();

  if (!config.security.allowLocalhost && LOOPBACK_HOSTS.has(host)) {
    throw createValidationError('Loopback or localhost URLs are not allowed');
  }

  if (isPrivateIPv4(host)) {
    throw createValidationError('Private network IPs are not allowed');
  }

  if (config.security.blockedHosts.length && hostMatchesList(host, config.security.blockedHosts)) {
    throw createValidationError('URL host is explicitly blocked', { host });
  }

  if (config.security.allowedHosts.length && !hostMatchesList(host, config.security.allowedHosts)) {
    throw createValidationError('URL host is not in the allowlist', { host });
  }

  return {
    origin: parsed.origin,
    host,
    protocol,
    href: parsed.href
  };
}

export default assertUrlAllowed;
