// src/lib/logger.js
// Lightweight logger (no extra dependency). Set LOG_LEVEL=debug for more noise.

const LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const enabled = {
  debug: LEVEL === 'debug',
  info: LEVEL === 'debug' || LEVEL === 'info',
  warn: true,
  error: true
};

export const logger = {
  debug: (...a) => enabled.debug && console.debug('[debug]', ...a),
  info:  (...a) => enabled.info  && console.log('[info ]', ...a),
  warn:  (...a) => enabled.warn  && console.warn('[warn ]', ...a),
  error: (...a) => enabled.error && console.error('[error]', ...a)
};

export function withReqId(ctx = {}) {
  const id = Math.random().toString(36).slice(2, 10);
  return { ...ctx, reqId: id };
}
