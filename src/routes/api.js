import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, verifyProof } from "@semaphore-protocol/proof"

//@typedef {import("@semaphore-protocol/group").MerkleProof} MerkleProof; 
//import type { MerkleProof } from "@semaphore-protocol/group";

/*
Make group on-chain: something with .sol circuit 

Pull group from on-chain 
import { SemaphoreSubgraph } from "@semaphore-protocol/data"
const semaphoreSubgraph = new SemaphoreSubgraph("sepolia")
const { members } = await semaphoreSubgraph.getGroup("42", { members: true })
const group = new Group(members)
*/



// const { privateKey, publicKey, commitment }
/*
const id1 = new Identity(); 

const message = "Hello World"; 
const signature = id1.signMessage(message); 
Identity.verifySignature(message, signature, id1.publicKey); 

const privateKey = id1.export(); 
const id1copy = Identity.import(privateKey); 
*/

const groupIds = {}; // mapping from groupName: groupId  
const groups = {}; // active groups 
const newMembers = {}; // next groups 
const pendingMemberIdentifiers = {}; // next groups: groupId -> { commitment: identifier }
const memberIdentifiers = {}; // active groups: groupId -> { commitment: identifier }
const usedNullifiers = {}; // active groups: groupId -> { nullifier: true }



import express from 'express';
import { parseInteger, parseBigInt, parsePrivateKey, parseMerkleProof, parseSemaphoreProof, validateAdminToken } from '../utils/validation.js';
import { getBearerToken, getIdentifierFromJwt } from '../utils/openid.js'
const router = express.Router();

import 'dotenv/config';
const enforceSameSiteRequests = process.env.NODE_ENV !== 'development' && process.env.ENFORCE_SAME_SITE_REQUESTS === 'true';
const checkerEndpoint = process.env.CHECKER_ENDPOINT;
const messageVal = process.env.MESSAGE_VAL;
const scopeVal = process.env.SCOPE_VAL;
const validateMessageScopeEndpoint = process.env.VALIDATE_MESSAGESCOPE_ENDPOINT;
const openIdIdentifierClaim = process.env.OPENID_IDENTIFIER_CLAIM || 'sub';
const debugIgnoreJwt = isTruthyEnv(process.env.DEBUG_IGNORE_JWT);

function isTruthyEnv(value) {
    if (value === undefined || value === null) {
        return false;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === 'on';
}

async function verifyMessageScope(groupName, message, scope) {
    if (!groupName) {
        return { verified: false, error: 'groupName is required' };
    }

    if (message === undefined || message === null || message === '') {
        return { verified: false, error: 'message is required' };
    }

    if (scope === undefined || scope === null || scope === '') {
        return { verified: false, error: 'scope is required' };
    }

    if (validateMessageScopeEndpoint) {
        let validationResponse;
        try {
            validationResponse = await fetch(validateMessageScopeEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    groupName,
                    message,
                    scope
                })
            });
        } catch (error) {
            console.error('message/scope validation request failed', error);
            return { verified: false, error: 'message/scope validation request failed' };
        }

        let validationResult = null;
        try {
            validationResult = await validationResponse.json();
        } catch (error) {
            validationResult = null;
        }

        if (!validationResponse.ok) {
            return {
                verified: false,
                error: validationResult?.error || 'message/scope validation endpoint rejected request'
            };
        }

        if (validationResult && validationResult.success === false) {
            return {
                verified: false,
                error: validationResult.error || 'message/scope validation endpoint rejected request'
            };
        }

        if (validationResult && typeof validationResult.verified === 'boolean') {
            return validationResult.verified
                ? { verified: true }
                : { verified: false, error: validationResult.error || 'invalid message or scope' };
        }

        if (validationResult && typeof validationResult.success === 'boolean') {
            return validationResult.success
                ? { verified: true }
                : { verified: false, error: validationResult.error || 'invalid message or scope' };
        }

        return { verified: true };
    }

    if (messageVal === undefined && scopeVal === undefined) {
        console.warn("WARNIG: message/scope validation is not configured."); 
        return { verified: true }; 
        //return { verified: false, error: 'message/scope validation is not configured' };
    }

    if (messageVal === undefined || scopeVal === undefined) {
        console.warn("WARNIG: message/scope validation are not both configured."); 
        return { verified: true }; 
        //return { verified: false, error: 'MESSAGE_VAL and SCOPE_VAL must both be configured' };
    }

    if (String(message) !== String(messageVal) || String(scope) !== String(scopeVal)) {
        return { verified: false, error: 'Invalid message or scope' };
    }

    return { verified: true };
}


function isSameSiteRequest(req) {
    const host = req.get('host');
    const origin = req.get('origin');

    if (origin && host) {
        try {
            const actual = new URL(origin);
            if (actual.host === host) {
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    const referer = req.get('referer');
    if (referer && host) {
        try {
            const actual = new URL(referer);
            if (actual.host === host) {
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    const secFetchSite = req.get('sec-fetch-site');
    return secFetchSite === 'same-origin' || secFetchSite === 'same-site';
}

router.use((req, res, next) => {
    if (!enforceSameSiteRequests) {
        return next();
    }

    if (isSameSiteRequest(req)) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'API requests must come from this site'
    });
});


// FOR PUBLIC -----------------------------------------------------------------------------
router.get('/newidentity', (req, res) => {
    const identity = new Identity();

    //console.log(identity.commitment); 

    res.json({
        privateKey: Array.from(identity.privateKey),
        publicKey: identity.publicKey.toString(),
        commitment: identity.commitment.toString()
    });
});

router.post('/recoveridentity', (req, res) => {
    const { privateKey } = req.body;

    const { value: privateKeyUint8, error } = parsePrivateKey(privateKey, 'privateKey');
    if (error) {
        return res.status(400).json({
            error
        });
    }

    const identity = new Identity(privateKeyUint8);

    res.json({
        privateKey: Array.from(identity.privateKey),
        publicKey: identity.publicKey.toString(),
        commitment: identity.commitment.toString()
    });
});


router.post('/addtogroup', async (req, res) => {
    // accessible to public since it's supposed to be possible to be fully open source 
    // but gated by environment variable 
    try {
        const { groupName, commitment } = req.body;
        let openIdJwt = null;
        let identifier = '__debug__';

        //console.log("DEBUGIGNOREJWT: "+debugIgnoreJwt); 

        if (!debugIgnoreJwt) {
            openIdJwt = getBearerToken(req);

            if (!openIdJwt) {
                return res.status(401).json({ success: false, error: 'missing bearer token' });
            }

            const { value: parsedIdentifier, error: identifierError } = getIdentifierFromJwt(openIdJwt, openIdIdentifierClaim);
            if (identifierError) {
                return res.status(401).json({ success: false, error: identifierError });
            }

            identifier = parsedIdentifier;
        }

        if (!(groupName in groupIds)) {
            return res.status(400).json({ success: false, error: 'group does not exist' });
        }

        //console.log("FOUND GROUP"); 

        const groupId = groupIds[groupName];

        // validate commitment
        const { value: commitmentBigInt, error: bigIntError } = parseBigInt(commitment, 'commitment');
        if (bigIntError) {
            return res.status(400).json({ success: false, error: bigIntError });
        }

        // FINALLY ADD 
        //console.log(groupId);
        //console.log(commitmentBigInt);

        if (checkerEndpoint) {
            let checkerResponse;
            const checkerHeaders = {
                'Content-Type': 'application/json'
            };

            if (openIdJwt) {
                checkerHeaders.Authorization = `Bearer ${openIdJwt}`;
            }

            try {
                checkerResponse = await fetch(checkerEndpoint, {
                    method: 'POST',
                    headers: checkerHeaders,
                    body: JSON.stringify({
                        groupName,
                        commitment: commitmentBigInt.toString(),
                        identifier
                    })
                });
            } catch (error) {
                console.error('checker request failed', error);
                return res.status(502).json({ success: false, error: 'checker request failed' });
            }

            let checkerResult = null;
            try {
                checkerResult = await checkerResponse.json();
            } catch (error) {
                checkerResult = null;
            }

            if (!checkerResponse.ok) {
                return res.status(403).json({
                    success: false,
                    error: checkerResult?.error || 'checker rejected request'
                });
            }

            if (checkerResult && checkerResult.success === false) {
                return res.status(403).json({
                    success: false,
                    error: checkerResult.error || 'checker rejected request'
                });
            }
        }

        // add to group 
        if (!(groupId in newMembers)) {
            newMembers[groupId] = [];
        }
        newMembers[groupId].push(commitmentBigInt);
        //console.log(newMembers[groupId]);

        if (!(groupId in pendingMemberIdentifiers)) {
            pendingMemberIdentifiers[groupId] = {};
        }

        const commitmentKey = commitmentBigInt.toString();
        const existingIdentifier = pendingMemberIdentifiers[groupId][commitmentKey];
        if (existingIdentifier && existingIdentifier !== identifier) {
            return res.status(409).json({ success: false, error: 'commitment already registered to another identifier' });
        }
        pendingMemberIdentifiers[groupId][commitmentKey] = identifier;

        return res.json({
            success: true
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            error: 'internal server error'
        });
    }
});

router.get('/getmerkleproof', (req, res) => {
    // groupName and commitment 
    const { groupName } = req.query; 
    let identifier = '__debug__';

    if (!debugIgnoreJwt) {
        const openIdJwt = getBearerToken(req);

        if (!openIdJwt) {
            return res.status(401).json({ success: false, error: 'missing bearer token' });
        }

        const { value: parsedIdentifier, error: identifierError } = getIdentifierFromJwt(openIdJwt, openIdIdentifierClaim);
        if (identifierError) {
            return res.status(401).json({ success: false, error: identifierError });
        }

        identifier = parsedIdentifier;
    }

    const { value: commitmentBigInt, error: bigIntError } = parseBigInt(req.query.commitment, 'commitment');
    if (bigIntError) return res.status(400).json({ success: false, error: bigIntError }); 

    if (!(groupName in groupIds)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const groupId = groupIds[groupName]; 
    const commitmentKey = commitmentBigInt.toString();
    if (!debugIgnoreJwt) {
        const registeredIdentifier = memberIdentifiers[groupId]?.[commitmentKey];

        if (!registeredIdentifier) {
            return res.status(403).json({
                success: false,
                error: 'no identifier registered for this commitment'
            });
        }

        if (registeredIdentifier !== identifier) {
            return res.status(403).json({
                success: false,
                error: 'JWT identifier does not match registered commitment owner'
            });
        }
    }

    const idx = groups[groupId].indexOf(commitmentBigInt); 
    if (idx == -1) {
        return res.status(400).json({
            success: false, 
            error: "member not in group"
        }); 
    }

    // TODO if making a from idx function, check for idx in range; if ultraparanoid can check here too 
    const mp = groups[groupId].generateMerkleProof(idx); 

    // console.log(mp); 
    /*{
    root: 15161378342949141752395282539110223214589649232326294045396729782542315671775n,
    leaf: 14528486626039523308524645267564531416533886482896506427650484919781872075640n,
    index: 1,
    siblings: [
        18688753239228936951450492615029330361875419342883686476459632946627361994809n
    ]
    }*/

    res.send(
        JSON.stringify(
            mp,
            (key, value) => (typeof value === "bigint" ? value.toString() : value),
            2
        )
    );

    /*res.json({ 
        root: mp.root.toString(), 
        leaf: mp.leaf.toString(), 
        index: mp.index, 
        siblings: [

        ]
    });*/
}); 


router.post('/generateproof', async (req, res) => {
    const { privateKey, merkleProof, message, scope } = req.body;

    const { value: privateKeyUint8, error } = parsePrivateKey(privateKey, 'privateKey');
    if (error) {
        return res.status(400).json({
            success: false, 
            error
        });
    }

    const identity = new Identity(privateKeyUint8);

    const { value: parsedMerkleProof, merror } = parseMerkleProof(merkleProof, 'merkleProof'); 
    if (merror) {
        return res.status(400).json({
            success: false, 
            error: merror
        });
    }


    //console.log(parsedMerkleProof); 
    
    const semaphoreProof = await generateProof(identity, parsedMerkleProof, message, scope, ); 
    //console.log("SEMAPHOREPROOF"); 
    //console.log(semaphoreProof); 

    res.json(semaphoreProof); // as it already returns as strings 
});



// FOR VERIFIERS ------------------------------------------------------------------------------------
// group 
router.get('/grouproot', (req, res) => {
    const { groupName, error } = req.query;


    if (!(groupName in groupIds)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const groupId = groupIds[groupName]; 

    if (!(groupId in groups)) {
        return res.status(400).json({
            success: false,
            error: 'group has no members'
        });
    }

    res.json({ success: true, root: groups[groupId].root.toString() });
});

router.post("/verifyproof", async (req, res) => {
    const { groupName } = req.body; 
    if (!(groupName in groupIds)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const {value: sproof, error} = parseSemaphoreProof(req.body.proof); 
    if (error) {
        return res.status(400).json({success:false, error}); 
    }

    const messageScopeResult = await verifyMessageScope(groupName, sproof.message, sproof.scope);
    if (!messageScopeResult.verified) {
        return res.status(400).json({
            verified: false,
            error: messageScopeResult.error || 'Invalid or Expired proof'
        });
    }

    //console.log(sproof); 

    // check that root is correct 
    if (sproof.merkleTreeRoot != groups[groupIds[groupName]].root) {
        console.log("ROOT MISMATCH"); 
        console.log(sproof.merkleTreeRoot); 
        console.log(groups[groupIds[groupName]].root); 
        return res.status(400).json({verified:false, error:"Invalid or Expired proof"})
    }

    const groupId = groupIds[groupName];
    const nullifierKey = String(sproof.nullifier);
    //console.log(usedNullifiers); 
    if (usedNullifiers[groupId]?.[nullifierKey]) {
        return res.status(400).json({
            verified: false,
            error: 'nullifier already used'
        });
    }

    const verified = await verifyProof(sproof);
    if (verified) {
        if (!(groupId in usedNullifiers)) {
            usedNullifiers[groupId] = {};
        }
        usedNullifiers[groupId][nullifierKey] = true;
    }

    res.json({
        verified
    }); 
})

router.post('/verifymessagescope', async (req, res) => {
    const { groupName, message, scope } = req.body;
    if (!(groupName in groupIds)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const messageScopeResult = await verifyMessageScope(groupName, message, scope);
    if (!messageScopeResult.verified) {
        return res.status(400).json(messageScopeResult);
    }

    return res.json(messageScopeResult);
})



// PRIVATE ADMIN -------------------------------------------------------------------------------------------
router.get("/newgroup", (req, res) => { 

    const { error: adminTokenError } = validateAdminToken(req);
    if (adminTokenError) {
        return res.status(401).json({
            success: false,
            error: adminTokenError
        });
    }

    const { groupName } = req.query;
    //console.log("CREATING GROUP " + groupName);

    // TODO: Use Semaphore.sol and its groupid instead; will also make sure it's persistent 
    const groupId = Object.keys(groupIds).length;

    groupIds[groupName] = groupId 
    
    //groups[groupId] = new Group(); // but no need for this initialization as it's in updatebatch 

    res.json({
        groupId: groupId
    });
});


function handleNextBatch(req, res) {
    const { error: adminTokenError } = validateAdminToken(req);
    if (adminTokenError) {
        return res.status(401).json({
            success: false,
            error: adminTokenError
        });
    }

    const { groupName } = req.query 

    if (!(groupName in groupIds)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const groupId = groupIds[groupName]; 
    const pendingMembers = newMembers[groupId] || [];

    //console.log("UPDATING GROUP "+groupName); 
    groups[groupId] = new Group(); 

    for (const commitment of pendingMembers) {
        groups[groupId].addMember(commitment); 
        //console.log("ADDED "+commitment); 
    }

    // Replace active identifier mapping with the new batch and clear pending state.
    memberIdentifiers[groupId] = { ...(pendingMemberIdentifiers[groupId] || {}) };
    newMembers[groupId] = [];
    pendingMemberIdentifiers[groupId] = {};
    usedNullifiers[groupId] = {};
    //console.log(usedNullifiers); 

    res.json({success:true})
}

router.get('/nextbatch', handleNextBatch);


router.get('/getgroupidx', (req, res) => {
    /// NOT TO BE CONFUSED WITH GROUPID 
    const { error: adminTokenError } = validateAdminToken(req);
    if (adminTokenError) {
        return res.status(401).json({
            success: false,
            error: adminTokenError
        });
    }

    const { groupName } = req.query 

    const { value: commitmentBigInt, error: bigIntError } = parseBigInt(req.query.commitment, 'commitment');
    if (bigIntError) return res.status(400).json({ success: false, error: bigIntError });

    if (!(groupName in groupIds)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const idx = groups[groupIds[groupName]].indexOf(commitmentBigInt); 
    //console.log(idx); 
    if (idx == -1) {
        return res.status(400).json({
            success: false, 
            error: "invalid uid"
        }); 
    }

    res.json({ idx: idx });
});

router.get('/getgroupidxwithgid', (req, res) => {
    /// NOT TO BE CONFUSED WITH GROUPID 
    const { error: adminTokenError } = validateAdminToken(req);
    if (adminTokenError) {
        return res.status(401).json({
            success: false,
            error: adminTokenError
        });
    }

    const { value: groupId, error: intError } = parseInteger(req.query.groupId, 'groupId');
    if (intError) return res.status(400).json({ success: false, error: intError });

    const { value: commitmentBigInt, error: bigIntError } = parseBigInt(req.query.commitment, 'commitment');
    if (bigIntError) return res.status(400).json({ success: false, error: bigIntError });

    if (!(groupId in groups)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    const idx = groups[groupId].indexOf(commitmentBigInt); 
    //console.log(idx); 
    if (idx == -1) {
        return res.status(400).json({
            success: false, 
            error: "invalid uid"
        }); 
    }

    res.json({ idx: idx });
});






router.get('/echo', (req, res) => {
    const msg = req.query.msg || null;
    res.json({ echo: msg });
});

router.post('/echo', (req, res) => {
    res.json({ echo: req.body });
});

export default router;
