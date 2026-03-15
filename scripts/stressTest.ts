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
    
    // Wait for the immediate account creation sync, but don't strictly fail if it's slow
    await account.$jazz.waitForAllCoValuesSync({ timeout: 2000 }).catch(() => {});
    
    console.log(`[Bot ${index}] Connected to server as bot!`);

    // Load the root session dynamically to subscribe to updates using raw cojson 
    // to bypass all jazz-tools schema mismatch issues between node/browser.
    console.log(`[Bot ${index}] Subscribing to ${options.sessionRoot}...`);
    
    // account.$jazz.localNode is the underlying LocalNode in cojson
    const localNode = account.$jazz.localNode;
    
    // Add retry logic for load since server might be under load
    let root;
    for (let attempt = 1; attempt <= 3; attempt++) {
        root = await localNode.load(options.sessionRoot);
        if (root !== "unavailable") break;
        console.warn(`[Bot ${index}] Session unavailable on attempt ${attempt}. Retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
    }

    if (root === "unavailable") {
        throw new Error("Session unavailable from all peers");
    }
    
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
    // Stagger boots by 800ms to avoid thundering herd memory spikes on localhost
    await new Promise(r => setTimeout(r, 800)); 
  }
  console.log(`\n✅ All ${options.clients} bots spawned. Listening for sync traffic...`);
}

run();
