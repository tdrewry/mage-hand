import { startWorker } from 'jazz-nodejs';
import { createWebSocketPeer } from "cojson-transport-ws";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { Account, co, z } from "jazz-tools";
// Polyfill WebSocket before loading Jazz
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

const args = process.argv.slice(2);
const options = {
  clients: 10,
  sessionRoot: '',
  url: 'ws://localhost:4200'
};

// Parse basic args --clients=50 --sessionRoot=abc
args.forEach(arg => {
  if (arg.startsWith('--clients=')) options.clients = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--sessionRoot=')) options.sessionRoot = arg.split('=')[1];
  if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
});

if (!options.sessionRoot) {
  console.error("❌ You must provide a --sessionRoot=co_... ID to connect the bots to");
  process.exit(1);
}

console.log(`🚀 Starting Jazz Stress Test`);
console.log(`   Clients: ${options.clients}`);
console.log(`   Session: ${options.sessionRoot}`);
console.log(`   Server : ${options.url}`);

async function spawnClient(index: number) {
  console.log(`[Bot ${index}] Booting...`);
  
  try {
    const crypto = await WasmCrypto.create();
    const peer = createWebSocketPeer({
        id: "upstream",
        websocket: new WebSocket(options.url) as any,
        role: "server",
    });
    
    // Create a throwaway account directly via crypto for this bot
    const account = await Account.create({
        creationProps: { name: `bot-${index}` },
        peers: [peer],
        crypto,
    });
    
    const accountID = account.$jazz.id;
    const agentSecret = account.$jazz.localNode.getCurrentAgent().agentSecret;

    const { worker, waitForConnection } = await startWorker({
      accountID,
      accountSecret: agentSecret,
      syncServer: options.url,
      WebSocket: WebSocket as any,
    });
    
    await waitForConnection();
    console.log(`[Bot ${index}] Connected to server!`);

    // Load the root session dynamically to subscribe to updates using raw cojson 
    // to bypass all jazz-tools schema mismatch issues between node/browser.
    console.log(`[Bot ${index}] Subscribing to ${options.sessionRoot}...`);
    
    // worker._raw.core.node is the underlying LocalNode in cojson
    const localNode = (worker as any)._raw.core.node;
    const root = await localNode.load(options.sessionRoot);
    
    console.log(`[Bot ${index}] Loaded session! Listening for traffic...`);
    
    // Keep the process alive and simulate sporadic activity if we wanted to
    setInterval(() => {
      // Event loop keep-alive
    }, 10000);

  } catch (err) {
    console.error(`[Bot ${index}] Failed to connect:`, err);
  }
}

async function run() {
  for (let i = 0; i < options.clients; i++) {
    spawnClient(i); // Run concurrently rather than blocking sequentially if we want them fast
    // Stagger boots by 500ms to avoid thundering herd memory spikes
    await new Promise(r => setTimeout(r, 500)); 
  }
  console.log(`\n✅ All ${options.clients} bots spawned. Listening for sync traffic...`);
}

run();
