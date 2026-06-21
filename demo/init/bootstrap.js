const apiBase = process.env.API_BASE_URL || 'http://api:2026';
const adminToken = process.env.ADMIN_TOKEN || '29rhufsd93rqo8ehf9283oheqi';
const groupName = process.env.DEMO_GROUP_NAME || 'demo-users';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApi() {
  for (;;) {
    try {
      const res = await fetch(`${apiBase}/api/echo?msg=boot`);
      if (res.ok) {
        console.log('API is reachable');
        return;
      }
    } catch {
      // Ignore and retry.
    }

    console.log('Waiting for API...');
    await sleep(2000);
  }
}

async function createDemoGroup() {
  const url = new URL(`${apiBase}/api/newgroup`);
  url.searchParams.set('groupName', groupName);
  url.searchParams.set('admin_token', adminToken);

  const res = await fetch(url);
  const body = await res.text();

  if (!res.ok) {
    if (body.includes('already') || body.includes('exists')) {
      console.log('Group already exists, continuing');
      return;
    }

    throw new Error(`newgroup failed (${res.status}): ${body}`);
  }

  console.log(`Demo group ready: ${groupName}`);
}

async function activateBatch() {
  const url = new URL(`${apiBase}/api/nextbatch`);
  url.searchParams.set('groupName', groupName);
  url.searchParams.set('admin_token', adminToken);

  const res = await fetch(url);
  const body = await res.text();

  if (!res.ok) {
    console.error(`nextbatch failed (${res.status}): ${body}`);
    return;
  }

  console.log(`Batch activated for ${groupName}`);
}

async function main() {
  await waitForApi();
  await createDemoGroup();

  // Keep rolling the batch so new user identities become usable in the demo.
  /*for (;;) {
    await activateBatch();
    await sleep(batchIntervalSeconds * 1000);
  }*/
}

main().catch((error) => {
  console.error('Bootstrap service failed:', error);
  process.exit(1);
});
