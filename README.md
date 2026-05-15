# untye-testapi-v0

testing API (not deployed on blockchain yet) 

using expressJS

## Connecting to it from other containers 
```wget -qO- http://testapi-testapi-1:2026/```

TODO to be ultraparanoid probably make there a secret needed for connection

## Setup 

```bash
npm install
npm run dev
```

## Endpoints (incomplete) 

- `GET /` — health / welcome message
- `GET /api/echo?msg=hello` — returns `{ "echo": "hello" }`
- `POST /api/echo` — echoes JSON body
