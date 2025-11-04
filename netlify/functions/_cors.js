const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app'
];

export function withCORS(handler) {
  return async (event, context) => {
    const origin = event.headers.origin || '';
    const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': allow,
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Credentials': 'true',
          'Vary': 'Origin'
        },
        body: ''
      };
    }

    const resp = await handler(event, context, allow);
    // zorg dat handler altijd {statusCode, headers, body} teruggeeft
    resp.headers = {
      ...(resp.headers || {}),
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    };
    return resp;
  };
}
