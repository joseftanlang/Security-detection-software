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

const groups = {};



import express from 'express';
import { parseInteger, parseBigInt, parsePrivateKey, parseMerkleProof, parseSemaphoreProof } from '../utils/validation.js';
const router = express.Router();

const enforceSameSiteRequests = process.env.NODE_ENV !== 'development' && process.env.ENFORCE_SAME_SITE_REQUESTS === 'true';

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

// IDENTITY 
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

// GROUP
router.get("/newgroup", (req, res) => { // TODO groupid can be like formid 
    // TODO: Use Semaphore.sol and its groupid instead; will also make sure it's persistent 
    const groupId = Object.keys(groups).length;
    groups[groupId] = new Group();

    res.json({
        groupId: groupId
    });
});

router.get('/grouproot', (req, res) => {
    const { value: groupId, error } = parseInteger(req.query.groupId, 'groupId');
    if (error) {
        return res.status(400).json({ success: false, error });
    }

    if (!(groupId in groups)) {
        return res.status(400).json({
            success: false,
            error: 'group does not exist'
        });
    }

    res.json({ root: groups[groupId].root.toString() });
});

router.post('/addtogroup', async (req, res) => {
    try {
        const { groupId, commitment } = req.body;

        // validate groupId
        const { value: parsedGroupId, error: intError } = parseInteger(groupId, 'groupId');
        if (intError) {
            return res.status(400).json({ success: false, error: intError });
        }

        if (!(parsedGroupId in groups)) {
            return res.status(400).json({ success: false, error: 'group does not exist' });
        }

        // validate commitment
        const { value: commitmentBigInt, error: bigIntError } = parseBigInt(commitment, 'commitment');
        if (bigIntError) {
            return res.status(400).json({ success: false, error: bigIntError });
        }

        // FINALLY ADD 
        //console.log(groupId);
        //console.log(commitmentBigInt);

        groups[parsedGroupId].addMember(commitment);

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

router.get('/getgroupidx', (req, res) => {
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

router.get('/getmerkleproof', (req, res) => {
    // groupId and commitment 
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


// PROOF 
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

router.post("/verifyproof", async (req, res) => {
    // TODO ONCE IT'S ON-CHAIN CHECK THAT ROOT IS CORRECT 
    const {value: sproof, error} = parseSemaphoreProof(req.body); 
    if (error) {
        return res.status(400).json({success:false, error}); 
    }
    console.log(sproof); 
    res.json({
        verified: await verifyProof(sproof) 
    }); 
})

router.get('/echo', (req, res) => {
    const msg = req.query.msg || null;
    res.json({ echo: msg });
});

router.post('/echo', (req, res) => {
    res.json({ echo: req.body });
});

export default router;
