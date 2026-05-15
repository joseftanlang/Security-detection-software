export function parseInteger(raw, name = 'value', { required = true } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: `${name} is required` };
    return { value: null };
  }

  const n = Number(raw);
  if (!Number.isInteger(n)) return { error: `${name} must be an integer` };

  return { value: n };
}

export function parseBigInt(raw, name = 'value', { required = true } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: `${name} is required` };
    return { value: null };
  }

  try {
    const b = BigInt(raw);
    return { value: b };
  } catch (e) {
    return { error: `invalid bigint ${name}` };
  }
}

export function parsePrivateKey(raw, name = 'privateKey', { required = true } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: `${name} is required` };
    return { value: null };
  }

  // Accept Uint8Array or an Array of numbers
  if (raw instanceof Uint8Array) {
    if (raw.length !== 32) return { error: `${name} must contain 32 bytes` };
    for (let i = 0; i < raw.length; i++) {
      const n = raw[i];
      if (!Number.isInteger(n) || n < 0 || n > 255) return { error: `${name} must only contain integers 0-255` };
    }
    return { value: raw };
  }

  if (!Array.isArray(raw)) return { error: `${name} must be an array` };

  if (raw.length !== 32) return { error: `${name} must contain 32 bytes` };

  const valid = raw.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
  if (!valid) return { error: `${name} must only contain integers 0-255` };

  return { value: new Uint8Array(raw) };
}


export function parseMerkleProof(raw, name = 'merkleProof', { required = true } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: `${name} is required` };
    return { value: null };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: `${name} must be an object` };
  }

  const { root, leaf, index, siblings } = raw;

  if (root === undefined || root === null || root === '') {
    return { error: 'root is required' };
  }

  if (leaf === undefined || leaf === null || leaf === '') {
    return { error: 'leaf is required' };
  }

  if (!Number.isInteger(index) || index < 0) {
    return { error: 'index must be a non-negative integer' };
  }

  if (!Array.isArray(siblings)) {
    return { error: 'siblings must be an array' };
  }

  try {
    const parsedRoot = BigInt(root);
    const parsedLeaf = BigInt(leaf);
    const parsedSiblings = siblings.map(sibling => BigInt(sibling));

    return {
      value: {
        root: parsedRoot,
        leaf: parsedLeaf,
        index,
        siblings: parsedSiblings
      }
    };
  } catch (error) {
    return { error: `${name} must contain valid bigint strings` };
  }
}


export function parseSemaphoreProof(raw, name = 'semaphoreProof', { required = true } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: `${name} is required` };
    return { value: null };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: `${name} must be an object` };
  }

  const {
    merkleTreeDepth,
    merkleTreeRoot,
    nullifier,
    message,
    scope,
    points
  } = raw;

  if (!Number.isInteger(merkleTreeDepth) || merkleTreeDepth < 0) {
    return { error: 'merkleTreeDepth must be a non-negative integer' };
  }

  if (merkleTreeRoot === undefined || merkleTreeRoot === null || merkleTreeRoot === '') {
    return { error: 'merkleTreeRoot is required' };
  }

  if (nullifier === undefined || nullifier === null || nullifier === '') {
    return { error: 'nullifier is required' };
  }

  if (message === undefined || message === null || message === '') {
    return { error: 'message is required' };
  }

  if (scope === undefined || scope === null || scope === '') {
    return { error: 'scope is required' };
  }

  if (!Array.isArray(points)) {
    return { error: 'points must be an array' };
  }

  try {
    const parsed = {
      merkleTreeDepth,
      merkleTreeRoot: merkleTreeRoot, //BigInt(merkleTreeRoot),
      nullifier: nullifier, //BigInt(nullifier),
      message: message, //BigInt(message),
      scope: scope, //BigInt(scope),
      points: points //points.map(p => BigInt(p))
    };

    return { value: parsed };
  } catch (err) {
    return { error: `${name} contains invalid bigint strings` };
  }
}