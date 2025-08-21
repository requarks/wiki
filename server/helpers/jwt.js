const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

/**
 * Function to get the signing key for a specific token.
 * @param {Object} header - JWT header containing the `kid`.
 * @returns {Promise<string>} - Resolves with the signing key.
 */
function getSigningKey(header, jwksUri) {
    return new Promise((resolve, reject) => {
        const client = jwksClient({ jwksUri });
        client.getSigningKey(header.kid, (err, key) => {
            if (err) {
                return reject('Error getting signing key:' + err);
            }
            const signingKey = key.getPublicKey();
            resolve(signingKey);
        });
    });
}

/**
 * Verifies a JWT token using a public key from JWKS.
 * @param {string} token - The JWT token to verify.
 * @param {Object} conf - Configuration object containing `issuer` and `clientId`.
 * @returns {Promise<Object>} - Resolves with the decoded token if verification is successful.
 */
async function verifyJwt(token, conf) {
    try {
        const decodedHeader = jwt.decode(token, { complete: true });
        if (!decodedHeader || !decodedHeader.header) {
            throw new Error('JWT verification failed: Invalid token header');
        }
        const signingKey = await getSigningKey(decodedHeader.header, conf.jwksUri);
        const decoded = jwt.verify(token, signingKey, {
            algorithms: conf.algorithms || ['RS256'],
            issuer: conf.issuer,
            audience: conf.clientId
        });
        return decoded;
    } catch (err) {
        throw new Error('JWT verification failed: ' + err.message);
    }
}

module.exports = {
    verifyJwt
};