export function getBearerToken(req) {
    const authorization = req.get('authorization');
    if (!authorization) {
        return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
        return null;
    }

    return token;
}

function base64UrlToUtf8(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
}

export function getIdentifierFromJwt(jwt, claimName = process.env.OPENID_IDENTIFIER_CLAIM || 'sub') {
    if (!jwt || typeof jwt !== 'string') {
        return { error: 'missing OpenID JWT' };
    }

    const parts = jwt.split('.');
    if (parts.length !== 3) {
        return { error: 'invalid JWT format' };
    }

    try {
        const payload = JSON.parse(base64UrlToUtf8(parts[1]));
        const identifier = payload[claimName];

        if (identifier === undefined || identifier === null || identifier === '') {
            return { error: `JWT does not contain identifier claim '${claimName}'` };
        }

        return { value: String(identifier) };
    } catch (error) {
        return { error: 'invalid JWT payload' };
    }
}
