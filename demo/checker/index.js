import express from 'express';

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 3031);
const allowedGroup = process.env.ALLOWED_GROUP || 'demo-users';
const maxIdentitiesPerUser = Number(process.env.MAX_IDENTITIES_PER_USER || 25);

const commitmentsByIdentifier = new Map();

function logEvent(label, value) {
  console.log(`[checker] ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

function sendLoggedJson(res, statusCode, payload) {
  logEvent('response', { statusCode, payload });
  return res.status(statusCode).json(payload);
}

function parseJwtSub(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

app.post('/check', (req, res) => {
  logEvent('request', {
    method: req.method,
    path: req.path,
    headers: {
      authorization: req.get('authorization') || null,
      'content-type': req.get('content-type') || null
    },
    body: req.body
  });

  const { groupName, commitment, identifier } = req.body || {};

  if (!groupName || !commitment || !identifier) {
    return sendLoggedJson(res, 400, { success: false, error: 'missing groupName, commitment, or identifier' });
  }

  if (groupName !== allowedGroup) {
    return sendLoggedJson(res, 403, { success: false, error: 'group is not allowed by checker policy' });
  }

  const authorization = req.get('authorization') || '';
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : null;

  const sub = parseJwtSub(bearer);
  if (!sub) {
    return sendLoggedJson(res, 401, { success: false, error: 'missing or invalid OpenID bearer token' });
  }

  if (sub !== String(identifier)) {
    return sendLoggedJson(res, 403, { success: false, error: 'token subject does not match identifier' });
  }

  const existing = commitmentsByIdentifier.get(sub) || new Set();
  existing.add(String(commitment));

  if (existing.size > maxIdentitiesPerUser) {
    return sendLoggedJson(res, 403, { success: false, error: 'identity limit reached for this account' });
  }

  commitmentsByIdentifier.set(sub, existing);
  return sendLoggedJson(res, 200, { success: true });
});

app.get('/health', (_, res) => {
  return sendLoggedJson(res, 200, { ok: true, allowedGroup, trackedUsers: commitmentsByIdentifier.size });
});

app.listen(port, () => {
  console.log(`Checker listening on http://0.0.0.0:${port}`);
});
