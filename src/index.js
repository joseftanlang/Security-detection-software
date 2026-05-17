import express from 'express';
import apiRouter from './routes/api.js';
import http from 'http';

const app = express();
const port = process.env.PORT || 2026;
const productionRedirectBase = 'https://untye.forms.uiutech.xyz/s/';

app.use(express.json());

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLoginPage(formId) {
  const safeFormId = escapeHtml(formId);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Untye login</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3efe7;
      --panel: #fffaf2;
      --text: #1f1a17;
      --muted: #6c6258;
      --accent: #1f5d54;
      --accent-strong: #123b35;
      --border: rgba(31, 26, 23, 0.12);
      --shadow: 0 24px 70px rgba(31, 26, 23, 0.14);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(31, 93, 84, 0.16), transparent 28%),
        radial-gradient(circle at right 20%, rgba(210, 140, 88, 0.18), transparent 26%),
        linear-gradient(180deg, #fbf7f0 0%, #efe8dc 100%);
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .frame {
      width: min(100%, 520px);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      padding: 32px;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 12px;
      color: var(--muted);
      margin: 0 0 12px;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 1;
      letter-spacing: -0.04em;
    }

    p {
      margin: 14px 0 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .form-meta {
      margin-top: 18px;
      display: grid;
      gap: 8px;
    }

    .badge {
      width: fit-content;
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(31, 93, 84, 0.08);
      color: var(--accent-strong);
      font-size: 0.9rem;
      font-weight: 650;
    }

    .card {
      margin-top: 28px;
      padding: 20px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.64);
      border: 1px solid var(--border);
      backdrop-filter: blur(8px);
    }

    label {
      display: block;
      font-weight: 650;
      margin-bottom: 8px;
    }

    input {
      width: 100%;
      border: 1px solid rgba(31, 26, 23, 0.16);
      border-radius: 16px;
      padding: 14px 16px;
      font: inherit;
      background: white;
      color: var(--text);
    }

    input:focus {
      outline: 3px solid rgba(31, 93, 84, 0.18);
      border-color: rgba(31, 93, 84, 0.5);
    }

    .hint {
      margin-top: 10px;
      font-size: 0.92rem;
      color: var(--muted);
    }

    .hint code {
      font-family: inherit;
      background: rgba(31, 26, 23, 0.08);
      padding: 0.12rem 0.35rem;
      border-radius: 999px;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 18px;
      align-items: center;
      flex-wrap: wrap;
    }

    button {
      appearance: none;
      border: 0;
      background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      color: white;
      border-radius: 999px;
      padding: 13px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 30px rgba(31, 93, 84, 0.24);
    }

    button:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    .status {
      min-height: 1.4em;
      color: var(--muted);
      font-size: 0.95rem;
    }

    .result {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.92rem;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main class="frame">
    <p class="eyebrow">Untye form gate</p>
    <h1>Enter with a user ID</h1>
    <div class="form-meta">
      <div class="badge">Form <strong>${safeFormId}</strong></div>
      <p>
        Use a unique user ID in the format <code>U1234567890</code>.
        The ID should be unique.
      </p>
    </div>

    <section class="card">
      <form id="login-form">
        <label for="userId">User ID</label>
        <input id="userId" name="userId" type="text" autocomplete="off" spellcheck="false" placeholder="U1234567890" required minlength="11" maxlength="11" />
        <div class="hint">Format: <code>U</code> + 10 digits, for example <code>U1234567890</code>. Keep it unique.</div>
        <div class="actions">
          <button id="submitButton" type="submit">Continue</button>
          <div id="status" class="status" aria-live="polite"></div>
        </div>
        <div id="result" class="result" hidden></div>
      </form>
    </section>
  </main>

  <script>
    const formId = ${JSON.stringify(formId)};
    const form = document.getElementById('login-form');
    const userIdInput = document.getElementById('userId');
    const status = document.getElementById('status');
    const result = document.getElementById('result');
    const submitButton = document.getElementById('submitButton');

    userIdInput.value = 'U1234567890';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userId = userIdInput.value.trim();
      if (!userId) {
        status.textContent = 'User ID is required.';
        return;
      }

      //console.log(userId); 
      //console.log(/^U\\d{10}$/.test(userId)); 
      if (! (/^U\\d{10}$/.test(userId)) ) {
        status.textContent = 'Use the format U1234567890.';
        userIdInput.focus();
        userIdInput.select();
        return;
      }

      submitButton.disabled = true;
      status.textContent = 'Creating identity and proof...';
      result.hidden = true;
      result.textContent = '';

      try {
        const identityResponse = await fetch('/api/newidentity');
        if (!identityResponse.ok) throw new Error('newidentity failed');
        const identity = await identityResponse.json();

        const addGroupResponse = await fetch('/api/addtogroup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: 0, commitment: identity.commitment })
        });
        if (!addGroupResponse.ok) throw new Error('addtogroup failed');

        const merkleResponse = await fetch('/api/getmerkleproof?groupId=0&commitment=' + encodeURIComponent(identity.commitment));
        if (!merkleResponse.ok) {
          const errorBody = await merkleResponse.text();
          if (errorBody.includes('invalid uid') || errorBody.includes('member not in group')) {
            throw new Error('invalid uid');
          }
          throw new Error(errorBody || 'getmerkleproof failed');
        }
        const merkleProof = await merkleResponse.json();

        const message = String(Date.now());
        const scope = formId + userId;

        const proofResponse = await fetch('/api/generateproof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privateKey: identity.privateKey,
            merkleProof,
            message,
            scope
          })
        });

        if (!proofResponse.ok) {
          const errorBody = await proofResponse.text();
          throw new Error(errorBody || 'generateproof failed');
        }

        const proof = await proofResponse.json();
        const redirectUrl = new URL(${JSON.stringify(productionRedirectBase)} + encodeURIComponent(formId));
        redirectUrl.searchParams.set('proof', JSON.stringify(proof));

        status.textContent = 'Proof created. Redirecting...';
        window.location.href = redirectUrl.toString();
      } catch (error) {
        status.textContent = 'Submission failed: ' + error.message;
        result.hidden = false;
        result.textContent = error.message === 'invalid uid'
          ? 'That user ID is invalid or has not been added to the group yet.'
          : 'Please try another unique user ID or retry once the API is available.';
      } finally {
        submitButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function requestJson(portNumber, path) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: portNumber,
      path,
      method: 'GET',
      headers: {
        Origin: `http://127.0.0.1:${portNumber}`,
        Referer: `http://127.0.0.1:${portNumber}/`
      }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body);
          return;
        }

        reject(new Error(`request failed with status ${response.statusCode}: ${body}`));
      });
    });

    request.on('error', reject);
    request.end();
  });
}

app.get('/', (req, res) => {
  const { formId } = req.query;

  if (!formId || typeof formId !== 'string' || !formId.trim()) {
    return res.status(400).send('formId is required');
  }

  return res.send(renderLoginPage(formId.trim()));
});

app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);

  const bootstrapCount = Number(process.env.BOOTSTRAP_GROUPS || '0');
  if (Number.isInteger(bootstrapCount) && bootstrapCount > 0) {
    (async () => {
      for (let i = 0; i < bootstrapCount; i += 1) {
        await requestJson(port, '/api/newgroup');
      }
      console.log(`Bootstrapped ${bootstrapCount} groups`);
    })().catch((error) => {
      console.error('Group bootstrap failed', error);
    });
  }
});

export default app;
