// src/lib/slackRetry.js
// Tiny helper to call Slack Web API with rate-limit & transient error handling.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function slackCall(fn, args = {}, { tries = 5, baseMs = 300 } = {}) {
  let attempt = 0;
  // Note: fn is a bound Slack Web API method like client.chat.postMessage
  while (true) {
    try {
      return await fn(args);
    } catch (e) {
      const err = e?.data?.error || e?.code || e?.message || 'unknown';

      // Respect Slack's retry-after header if present
      if (e?.data?.retryAfter) {
        const wait = Math.ceil(Number(e.data.retryAfter) * 1000);
        await sleep(wait);
      } else if (
        ['ratelimited', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(err) &&
        attempt < tries - 1
      ) {
        const backoff = Math.min(5000, baseMs * Math.pow(2, attempt));
        await sleep(backoff);
      } else {
        throw e;
      }
    }
    attempt++;
  }
}

// (Optional) default export if you ever want to `import retry from ...`
export default { slackCall };
