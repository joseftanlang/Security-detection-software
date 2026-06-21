# untye-testapi-v0

testing API (not deployed on blockchain yet) 

using expressJS

## Connecting to it from other containers 
```wget -qO- http://testapi-testapi-1:2026/```


# Setup 

```bash
npm install
npm run dev
```


# API Overview 

## TLDR 

Do set `ADMIN_TOKEN` when using admin endpoints, and set `OPENID_IDENTIFIER_CLAIM` for OpenID integration, with `CHECKER_ENDPOINT` to have control over issuance of verification certificates. For verifying proofs, if required, set `MESSAGE_VAL` and `SCOPE_VAL` to standardize verifications more and check duplication with a nullifier. Or, set `VALIDATE_MESSAGESCOPE_ENDPOINT` for more finegrained control

Note the delay in user's ability to verify their proofs; it is recommended to automatically add all users to a new batch daily by default, to provide maximum privacy. For the privacy guarantees, allowing the user to call the public endpoints (listed below) is necessary. 

### Endpoints needing admin token 
The endpoints that need admin token are: 

- `newgroup`
- `nextbatch`
- `getgroupidx`
- `getgroupidxwithgid`

### OpenID identifier and checker endpoint 
The protocol has integration with the OpenID standard, obtaining user identities from the JWTs issued. The `OPENID_IDENTIFIER_CLAIM` environment variable should be set to follow yours. 

#### To set rules for adding members to groups 
Set the environment variable `CHECKER_ENDPOINT` as an endpoint to your server to decide whether a user can have their identity be added to a group or not. Whenever each user makes such a request to the `/addtogroup` API, it will call your `CHECKER_ENDPOINT` with a POST request containing the JSON body `{ "groupName": "...", "commitment": "...", "identifier": "..." }`.

The API format of `CHECKER_ENDPOINT` is:
- `POST <CHECKER_ENDPOINT>`
- Request JSON body: `{ "groupName": "...", "commitment": "...", "identifier": "..." }`
- Response JSON: `{ "success": true }` or `{ "success": false, "error": "..." }`

### Current Batch and Next Batch in each Group 

For each group, there'll be a current batch and next batch. Everytime a user's identity requests to be added to a group, they will be added to the next batch and they cannot yet verify themselves. Only when the admin triggers `/nextbatch`, then every entry in the Current Batch is cleared, and the Next Batch becomes the Current one, and the users can use their identity to verify themselves. This encourages batch issuance; without batch issuance with a sufficiently large atch, users can be potentially traced by timestamp and it may be a privacy concern. 

### Public endpoints 
To ensure the clientside handler for this protocol can be standardized across implementations, the following endpoints must be made available to the public: 
- `/addtogroup` 
- `/getmerkleproof` 
- `/grouproot`
- `/verifymessagescope`
- `/verifyproof`  
- `/newidentity`, `/recoveridentity`, and `/generateproof` must also not be edited 

### Verifying proofs 
See "POST `/verifyproof` below. 

## Methods 

## Public functions 

### GET `/newidentity`, POST `/recoveridentity`, and POST `/generateproof` 
These are public methods providing mathematical utilities crucial to the protocol. These are cryptographic steps that, strictly speaking, are doable by other parties, and must not be changed as they are standards of the protocol. 

#### GET `/newidentity`

`/newidentity` takes in no parameters.

- Request JSON: none
- Response JSON: `{ "privateKey": [<32 bytes>], "publicKey": "...", "commitment": "..." }`

#### POST `/recoveridentity`

`/recoveridentity` takes in the Semaphore user private key.

- Request body parameters: `privateKey` (array of ints from 0-255) 
- Response JSON: `{ "privateKey": [<32 bytes>], "publicKey": "...", "commitment": "..." }`

#### POST `/generateproof`

`/generateproof` requres the POST request's body to contain `privateKey`, `merkleProof`, `message`, and `scope`. The message and scope used for verification is expected to be communicated to the public through other means.

- Request JSON body: `{ "privateKey": [...], "merkleProof": { "root": "...", "leaf": "...", "index": 0, "siblings": ["..."] }, "message": "...", "scope": "..." }`
- Response JSON: a Semaphore proof, `{ "merkleTreeDepth": 0, "merkleTreeRoot": "...", "nullifier": "...", "message": "...", "scope": "...", "points": [...] }`

### POST `/verifyproof` 

`/verifyproof` requires the POST request's body to contain the keys `groupName`, and `proof`; where `proof` is in the format of a Semaphore proof in JSON. The requirements of the proof's `message` and `scope` can be set through the environment variables `MESSAGE_VAL`, `SCOPE_VAL` to the single right value, or setting the `VALIDATE_MESSAGESCOPE_ENDPOINT` to point to your own custom endpoint that takes the message and scope of validation and returns a validation result. This setting can also be communicated to the public lest verifiers want to run verification themselves. 

The API format of `VALIDATE_MESSAGESCOPE_ENDPOINT` is: 
- `POST <VALIDATE_MESSAGESCOPE_ENDPOINT>`
- Request JSON body: `{ "groupName": "...", "message": "...", "scope": "..." }`
- Response JSON: `{ "verified": true }` or `{ "verified": false, "error": "..." }`

### POST `/verifymessagescope`

`/verifymessagescope` requires the POST request's body to contain the keys `groupName`, `message`, and `scope`. It uses the same validation rules as `/verifyproof`, but skips the Semaphore proof itself.

### POST `/addtogroup` 
This is called by the user, to ensure the clientside handler is standardized across different implementations. However, one can use `CHECKER_ENDPOINT` , as well as the OpenID Integration from `OPENID_IDENTIFIER_CLAIM` , to control the issuance of certificates. See "OpenID identifier and checker endpoint" section in TL;DR for details 

### GET `/getmerkleproof` 
This is also called by the user, and should never be denied for users with valid JWTs. 

### GET `/grouproot` 
This is also a public method, but is called by the verifier instead. This is used to verify that the verification proof is not expired and not faked, by ensuring its root matches the current group's rot. 

This is called by setting `groupName` as a query parameter. 

## Admin methods overview 

### GET `newgroup`
This is the method to create a group. Make a GET request to `/newgroup` with `groupName` and `admin_token` 

### GET `nextbatch`

### GET `getgroupidx` and `getgroupidxwithgid`
These are mostly endpoints to provide cryptographic utilities on the admin's side, for any tracing or debugging purposes. Both these methods take the admin token and the user's identity commitment, but `getgroupidx` will take the group name while `getgroupidxwithgid` will use the groupId instead. 

# MAJOR TODOs 
- use real blockchain instead of simulated  
- when checking admin token, use challenge-response or time-gated methods 
