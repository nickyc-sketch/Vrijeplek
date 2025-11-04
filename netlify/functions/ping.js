import { withCORS } from './_cors.js';

export const handler = withCORS(async () => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
});
