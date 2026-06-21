const STORAGE_PREFIX = 'untye.demo.v1';

const jwtInput = document.getElementById('jwtInput');
const loginBtn = document.getElementById('loginBtn');
const demoTokenBtn = document.getElementById('demoTokenBtn');
const userSummary = document.getElementById('userSummary');
const groupInput = document.getElementById('groupInput');
const messageInput = document.getElementById('messageInput');
const scopeInput = document.getElementById('scopeInput');
const createIdentityBtn = document.getElementById('createIdentityBtn');
const refreshBtn = document.getElementById('refreshBtn');
const actionStatus = document.getElementById('actionStatus');
const adminTokenInput = document.getElementById('adminTokenInput');
const adminGroupInput = document.getElementById('adminGroupInput');
const nextBatchBtn = document.getElementById('nextBatchBtn');
const rootBtn = document.getElementById('rootBtn');
const adminStatus = document.getElementById('adminStatus');
const rootSummary = document.getElementById('rootSummary');
const identityList = document.getElementById('identityList');
const identityCount = document.getElementById('identityCount');

const state = {
  token: localStorage.getItem(`${STORAGE_PREFIX}.token`) || '',
  sub: localStorage.getItem(`${STORAGE_PREFIX}.sub`) || '',
  identities: []
};

function decodePayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT must have 3 dot-separated parts');
  }

  const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(payloadJson);
}

function fakeJwt(sub) {
  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ sub, iss: 'voidauth-demo', aud: 'untye-demo', iat: Math.floor(Date.now() / 1000) });
  return `${header}.${payload}.`;
}

function identityStorageKey() {
  return `${STORAGE_PREFIX}.identities.${state.sub}`;
}

function loadIdentities() {
  if (!state.sub) {
    state.identities = [];
    return;
  }

  const saved = localStorage.getItem(identityStorageKey());
  state.identities = saved ? JSON.parse(saved) : [];
}

function persistIdentities() {
  if (!state.sub) {
    return;
  }

  localStorage.setItem(identityStorageKey(), JSON.stringify(state.identities));
}

function setToken(token) {
  const payload = decodePayload(token);
  if (!payload.sub) {
    throw new Error('JWT payload must include sub');
  }

  state.token = token;
  state.sub = String(payload.sub);

  localStorage.setItem(`${STORAGE_PREFIX}.token`, token);
  localStorage.setItem(`${STORAGE_PREFIX}.sub`, state.sub);

  loadIdentities();
  render();
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${state.token}`
  };
}

function setStatus(message) {
  actionStatus.textContent = message;
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(json.error || `Request failed with status ${response.status}`);
  }

  return json;
}

function calculateScope(template, groupName, sub) {
  return template.replace('{group}', groupName).replace('{sub}', sub);
}

async function createTempIdentity() {
  if (!state.token || !state.sub) {
    throw new Error('Login first with an OpenID JWT');
  }

  const groupName = groupInput.value.trim();
  if (!groupName) {
    throw new Error('Group name is required');
  }

  const identity = await apiJson('/api/newidentity');

  await apiJson('/api/addtogroup', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ groupName, commitment: identity.commitment })
  });

  state.identities.unshift({
    id: crypto.randomUUID(),
    groupName,
    commitment: identity.commitment,
    privateKey: identity.privateKey,
    createdAt: new Date().toISOString(),
    status: 'pending',
    statusDetail: 'Queued for next batch',
    everActive: false,
    merkleProof: null,
    lastProof: null,
    lastVerification: null,
    lastCheckedAt: null
  });

  persistIdentities();
  render();
}

async function refreshIdentityStatus(identity) {
  const query = new URLSearchParams({ groupName: identity.groupName, commitment: identity.commitment });

  try {
    const merkleProof = await apiJson(`/api/getmerkleproof?${query}`, {
      headers: {
        Authorization: `Bearer ${state.token}`
      }
    });

    identity.status = 'active';
    identity.statusDetail = 'Can generate proof';
    identity.everActive = true;
    identity.merkleProof = merkleProof;
    identity.lastKnownRoot = merkleProof.root;
  } catch (error) {
    const expired = identity.everActive || identity.status === 'active' || identity.status === 'expired';

    if (expired) {
      identity.status = 'expired';
      identity.statusDetail = 'No longer in current batch';
    } else {
      identity.status = 'pending';
      identity.statusDetail = error.message || 'Queued for next batch';
    }
  }

  identity.lastCheckedAt = new Date().toISOString();
}

async function refreshAllStatuses() {
  if (!state.token || !state.sub) {
    throw new Error('Login first with an OpenID JWT');
  }

  for (const identity of state.identities) {
    await refreshIdentityStatus(identity);
  }

  persistIdentities();
  render();
}

async function generateProofFor(identityId) {
  const identity = state.identities.find((item) => item.id === identityId);
  if (!identity) {
    throw new Error('Identity not found');
  }

  if (identity.status !== 'active' || !identity.merkleProof) {
    throw new Error('Identity is not active yet. Refresh statuses after next batch.');
  }

  const message = messageInput.value.trim();
  const scope = calculateScope(scopeInput.value.trim(), identity.groupName, state.sub);

  const proof = await apiJson('/api/generateproof', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      privateKey: identity.privateKey,
      merkleProof: identity.merkleProof,
      message,
      scope
    })
  });

  identity.lastProof = proof;
  identity.lastProofAt = new Date().toISOString();
  identity.lastVerification = null;
  persistIdentities();
  render();
}

async function verifyProofFor(identityId) {
  const identity = state.identities.find((item) => item.id === identityId);
  if (!identity) {
    throw new Error('Identity not found');
  }

  if (!identity.lastProof) {
    throw new Error('Generate a proof first');
  }

  const verification = await apiJson('/api/verifyproof', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      groupName: identity.groupName,
      proof: identity.lastProof
    })
  });

  identity.lastVerification = {
    verified: Boolean(verification.verified),
    checkedAt: new Date().toISOString(),
    error: verification.error || null
  };
  persistIdentities();
  render();
}

function getAdminGroupName() {
  return adminGroupInput.value.trim() || groupInput.value.trim();
}

async function refreshCurrentRoot() {
  const groupName = getAdminGroupName();
  if (!groupName) {
    throw new Error('Admin group name is required');
  }

  const result = await apiJson(`/api/grouproot?groupName=${encodeURIComponent(groupName)}`);
  rootSummary.textContent = `Current root for ${groupName}: ${result.root}`;
}

async function advanceNextBatch() {
  const groupName = getAdminGroupName();
  const adminToken = adminTokenInput.value.trim();

  if (!groupName) {
    throw new Error('Admin group name is required');
  }

  if (!adminToken) {
    throw new Error('Admin token is required');
  }

  await apiJson(`/api/nextbatch?groupName=${encodeURIComponent(groupName)}&admin_token=${encodeURIComponent(adminToken)}`);
  await refreshCurrentRoot().catch(() => {
    rootSummary.textContent = `Next batch activated for ${groupName}`;
  });
  await refreshAllStatuses();
}

function render() {
  jwtInput.value = state.token;
  userSummary.textContent = state.sub ? `Signed in as sub: ${state.sub}` : 'Not signed in';

  identityCount.textContent = `${state.identities.length} identities`;

  if (!state.identities.length) {
    identityList.innerHTML = '<p class="meta">No temporary identities yet.</p>';
    return;
  }

  identityList.innerHTML = '';

  for (const identity of state.identities) {
    const card = document.createElement('article');
    card.className = 'identity-card';

    const title = document.createElement('p');
    title.className = 'identity-title';
    title.textContent = `${identity.groupName} / ${identity.commitment.slice(0, 18)}...`;

    const created = document.createElement('p');
    created.className = 'identity-meta';
    created.textContent = `Created: ${new Date(identity.createdAt).toLocaleString()}`;

    const status = document.createElement('span');
    status.className = `status status-${identity.status || 'pending'}`;
    status.textContent = (identity.status || 'pending').toUpperCase();

    const detail = document.createElement('p');
    detail.className = 'identity-meta';
    detail.textContent = identity.statusDetail || '';

    const actions = document.createElement('div');
    actions.className = 'row';

    const generateBtn = document.createElement('button');
    generateBtn.className = 'btn';
    generateBtn.textContent = 'Generate proof';
    generateBtn.disabled = identity.status !== 'active';
    generateBtn.addEventListener('click', async () => {
      setStatus('Generating proof...');
      try {
        await generateProofFor(identity.id);
        setStatus('Proof generated for selected identity');
      } catch (error) {
        setStatus(error.message);
      }
    });

    actions.appendChild(generateBtn);

    const verifyBtn = document.createElement('button');
    verifyBtn.className = 'btn btn-ghost';
    verifyBtn.textContent = 'Verify proof';
    verifyBtn.disabled = !identity.lastProof;
    verifyBtn.addEventListener('click', async () => {
      setStatus('Verifying proof...');
      try {
        await verifyProofFor(identity.id);
        setStatus('Proof verification completed');
      } catch (error) {
        setStatus(error.message);
      }
    });

    actions.appendChild(verifyBtn);

    if (identity.lastProof) {
      const proofMeta = document.createElement('p');
      proofMeta.className = 'identity-meta';
      proofMeta.textContent = `Proof ready at ${new Date(identity.lastProofAt).toLocaleString()} | nullifier=${identity.lastProof.nullifier}`;
      card.appendChild(proofMeta);
    }

    if (identity.lastVerification) {
      const verificationMeta = document.createElement('p');
      verificationMeta.className = 'identity-meta';
      verificationMeta.textContent = identity.lastVerification.verified
        ? `Verification: success at ${new Date(identity.lastVerification.checkedAt).toLocaleString()}`
        : `Verification: failed at ${new Date(identity.lastVerification.checkedAt).toLocaleString()}${identity.lastVerification.error ? ` | ${identity.lastVerification.error}` : ''}`;
      card.appendChild(verificationMeta);
    }

    card.appendChild(title);
    card.appendChild(created);
    card.appendChild(status);
    card.appendChild(detail);
    card.appendChild(actions);
    identityList.appendChild(card);
  }
}

loginBtn.addEventListener('click', () => {
  try {
    setToken(jwtInput.value.trim());
    setStatus('Token accepted');
  } catch (error) {
    setStatus(error.message);
  }
});

demoTokenBtn.addEventListener('click', () => {
  const token = fakeJwt(`demo-user-${Math.floor(Math.random() * 10000)}`);
  try {
    setToken(token);
    setStatus('Demo token generated and applied');
  } catch (error) {
    setStatus(error.message);
  }
});

createIdentityBtn.addEventListener('click', async () => {
  setStatus('Creating temporary identity and queuing membership...');
  try {
    await createTempIdentity();
    setStatus('Identity created and added to next batch');
  } catch (error) {
    setStatus(error.message);
  }
});

refreshBtn.addEventListener('click', async () => {
  setStatus('Refreshing identity statuses...');
  try {
    await refreshAllStatuses();
    setStatus('Statuses refreshed');
  } catch (error) {
    setStatus(error.message);
  }
});

nextBatchBtn.addEventListener('click', async () => {
  adminStatus.textContent = 'Advancing batch...';
  try {
    await advanceNextBatch();
    adminStatus.textContent = 'Batch advanced successfully';
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

rootBtn.addEventListener('click', async () => {
  adminStatus.textContent = 'Refreshing current root...';
  try {
    await refreshCurrentRoot();
    adminStatus.textContent = 'Current root refreshed';
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

if (state.token) {
  try {
    setToken(state.token);
  } catch {
    localStorage.removeItem(`${STORAGE_PREFIX}.token`);
    localStorage.removeItem(`${STORAGE_PREFIX}.sub`);
  }
}

adminTokenInput.value = localStorage.getItem(`${STORAGE_PREFIX}.adminToken`) || '';
adminGroupInput.value = localStorage.getItem(`${STORAGE_PREFIX}.adminGroup`) || adminGroupInput.value;

adminTokenInput.addEventListener('input', () => {
  localStorage.setItem(`${STORAGE_PREFIX}.adminToken`, adminTokenInput.value);
});

adminGroupInput.addEventListener('input', () => {
  localStorage.setItem(`${STORAGE_PREFIX}.adminGroup`, adminGroupInput.value);
});

render();
