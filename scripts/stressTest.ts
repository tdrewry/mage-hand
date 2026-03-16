import { createWebSocketPeer } from "cojson-transport-ws";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { Account, co, z } from "jazz-tools";
// Polyfill WebSocket before loading Jazz
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

// --- MOCK WebRTC Environment ---
let globalWebRTCMessages = 0;
let globalJazzOperations = 0;

class MockRTCDataChannel {
    readyState = "open";
    onmessage: ((ev: any) => void) | null = null;
    send(data: string) {
        globalWebRTCMessages++;
    }
}
(global as any).RTCSessionDescription = class MockRTCSessionDescription {
    type: string; sdp: string;
    constructor(init: any) { this.type = init.type; this.sdp = init.sdp; }
};
(global as any).RTCIceCandidate = class MockRTCIceCandidate {
    candidate: string; sdpMid: string; sdpMLineIndex: number;
    constructor(init: any) { this.candidate = init.candidate; this.sdpMid = init.sdpMid; this.sdpMLineIndex = init.sdpMLineIndex; }
    toJSON() { return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex }; }
};
(global as any).RTCPeerConnection = class MockRTCPeerConnection {
    connectionState = "connected";
    signalingState = "stable";
    onicecandidate: any = null;
    onconnectionstatechange: any = null;
    ondatachannel: any = null;
    
    mockDc = new MockRTCDataChannel();

    createDataChannel(label: string) { return this.mockDc; }
    async createOffer() { return { type: "offer", sdp: "mock-offer" }; }
    async createAnswer() { return { type: "answer", sdp: "mock-answer" }; }
    async setLocalDescription(desc: any) {}
    async setRemoteDescription(desc: any) {}
    async addIceCandidate(cand: any) {}
};
// ------------------------------------------------

// Note: To fully stress-test WebRTC P2P in Node, a wrtc or node-webrtc polyfill
// is required. For now, this script focuses on the Jazz CRDT dual-path baseline.
import { JazzMapObject, JazzTextureEntry } from '../src/lib/jazz/schema.js';

const args = process.argv.slice(2);
const options = {
  clients: 10,
  sessionRoot: '',
  url: 'ws://localhost:4200'
};

// Parse basic args --clients=50 --sessionRoot=abc --role=host
args.forEach(arg => {
  if (arg.startsWith('--clients=')) options.clients = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--sessionRoot=')) options.sessionRoot = arg.split('=')[1];
  if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
  if (arg.startsWith('--role=')) (options as any).role = arg.split('=')[1];
});

if (!options.sessionRoot && (options as any).role !== 'creator') {
  console.error("❌ You must provide a --sessionRoot=co_... ID to connect the bots to");
  process.exit(1);
}

const isHostBot = (options as any).role === 'host';
console.log(`🚀 Starting Jazz Stress Test (${isHostBot ? 'HOST MODE' : 'CLIENT MODE'})`);
console.log(`   Clients: ${options.clients}`);
console.log(`   Session: ${options.sessionRoot}`);
console.log(`   Server : ${options.url}`);

async function spawnClient(index: number) {
  console.log(`[Bot ${index}] Booting...`);
  
  try {
    const crypto = await WasmCrypto.create();
    
    // Track outbound bytes for this bot
    let outboundBytes = 0;
    
    const ws = new WebSocket(options.url);
    if (isHostBot) {
        // Intercept sending messages to count outbound bytes
        const originalSend = ws.send;
        ws.send = function(data: any) {
            if (data) {
                if (typeof data === 'string') {
                    outboundBytes += Buffer.byteLength(data, 'utf8');
                } else if (data instanceof ArrayBuffer) {
                    outboundBytes += data.byteLength;
                } else if (ArrayBuffer.isView(data)) {
                    outboundBytes += data.byteLength;
                } else if (Buffer.isBuffer(data)) {
                    outboundBytes += data.length;
                } else if (data.length) {
                    outboundBytes += data.length;
                }
            }
            return originalSend.apply(this, [data] as any);
        };
        
        // Log host outbound metrics periodically
        setInterval(() => {
            console.log(`\n================================`);
            console.log(`📊 HOST METRICS (Bot ${index})`);
            console.log(`   Outbound Sync: ${(outboundBytes / 1024 / 1024).toFixed(2)} MB`);
            const totalOps = globalWebRTCMessages + globalJazzOperations;
            const ratio = totalOps > 0 ? ((globalWebRTCMessages / totalOps) * 100).toFixed(1) : "0.0";
            console.log(`   WebRTC Messages (Ephemeral): ${globalWebRTCMessages}`);
            console.log(`   Jazz Operations (Durable):   ${globalJazzOperations}`);
            console.log(`   Ephemeral Ratio:             ${ratio}%`);
            console.log(`================================\n`);
        }, 10000);
    }

    const peer = createWebSocketPeer({
        id: "upstream",
        websocket: ws as any,
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
    
    const mockWebRtcChannel = new MockRTCDataChannel();
    
    const dragState = {
        tokenId: null as string | null,
        targetX: 0,
        targetY: 0,
        ticks: 0
    };
    
    // Add retry logic for load since server might be under load
    let root: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
        root = await localNode.load(options.sessionRoot as any);
        if (root !== "unavailable") break;
        console.warn(`[Bot ${index}] Session unavailable on attempt ${attempt}. Retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
    }

    if (root === "unavailable") {
        throw new Error("Session unavailable from all peers");
    }
    
    console.log(`[Bot ${index}] Loaded session! Listening for traffic...`);
    
    // Simulate WebRTC Signaling interaction (Phase 1 Dual-Path)
    try {
        const signalingRoomId = root.get("signalingRoom");
        if (signalingRoomId) {
            const signalingRoom = await localNode.load(signalingRoomId as any);
            if (signalingRoom && signalingRoom !== "unavailable") {
                // If this is the host, announce presence in the signaling room
                if (isHostBot) {
                    (signalingRoom as any).set("hostId", peer.id, "trusting");
                } 
                // We mock the signaling handshake simply confirming connection open
            }
        }
    } catch (e: any) {
        // Non-fatal, older sessions might not have signalingRoom yet
    }
    
    // Keep the process alive and simulate sporadic activity to stress the mesh network
    setInterval(async () => {
        try {
            if (isHostBot) {
                // Host Bot: Simulate DM actions by spawning/moving/deleting Durable Objects
                // We'll spam MapObjects to isolate them from Token jitter
                const mapObjListId = root.get("mapObjects");
                if (mapObjListId) {
                    const mapObjCoList = await localNode.load(mapObjListId as any) as any;
                    if (mapObjCoList) {
                        let group = root.$jazz?.owner;
                        if (!group && (account as any)._owner) group = (account as any)._owner;
                        if (!group) group = account;
                        
                        if (group) {
                            // Use the actual JazzMapObject schema from the application so it is typed properly
                            // This ensures the CoList can recognize and index it correctly without throwing NaN
                            const newMapNode = await JazzMapObject.create({
                                objectId: `stress-obj-${index}-${Date.now()}`,
                                mapId: 'stress-map',
                                shape: 'wall',
                                category: 'wall',
                                positionX: Math.random() * 1000,
                                positionY: Math.random() * 1000,
                                width: 100,
                                height: 100,
                                rotation: 0,
                                fillColor: 'transparent',
                                strokeColor: '#ef4444',
                                strokeWidth: 2,
                                opacity: 1,
                                castsShadow: false,
                                blocksMovement: true,
                                blocksVision: true,
                                revealedByLight: false,
                                wallPointsJson: JSON.stringify([{x: 0, y:0}, {x: 100, y:100}])
                            }, { owner: group });

                            try {
                                if (mapObjCoList.$jazz && typeof mapObjCoList.$jazz.push === 'function') {
                                    mapObjCoList.$jazz.push(newMapNode);
                                } else if (typeof mapObjCoList.push === 'function') {
                                    mapObjCoList.push(newMapNode);
                                } else if (mapObjCoList._raw && typeof mapObjCoList._raw.append === 'function') {
                                    mapObjCoList._raw.append((newMapNode as any).id, undefined, "trusting");
                                } else if (typeof mapObjCoList.append === 'function') {
                                    mapObjCoList.append((newMapNode as any).id, undefined, "trusting");
                                } else {
                                    throw new Error("Could not find append/push method on CoList proxy");
                                }
                                globalJazzOperations++;
                                console.log(`[Bot ${index}] Spawned & pushed MapObject DO: ${newMapNode.objectId}`);
                            } catch (e: any) {
                                console.warn(`[Bot ${index}] Failed to append DO: ${e.message}`);
                            }
                            
                            // Also spawn a fake FileStream to stress STR traffic on the sync server
                            const texturesListId = root.get("textures");
                            if (texturesListId) {
                                const texturesCoList = await localNode.load(texturesListId as any) as any;
                                if (texturesCoList) {
                                    // Make a dummy 2KB blob with random noise to guarantee a unique hash in textureSync
                                    const dummyData = new Uint8Array(2000);
                                    for (let b = 0; b < dummyData.length; b++) dummyData[b] = Math.floor(Math.random() * 256);
                                    const blob = new Blob([dummyData], { type: "image/png" });
                                    const fileStream = await co.fileStream().createFromBlob(blob as any, { owner: group as any });
                                    const fileStreamId = 
                                        (fileStream as any)?.$jazz?.id ??
                                        (fileStream as any)?.id ??
                                        (fileStream as any)?._raw?.id;

                                    if (fileStreamId) {
                                        const entry = await JazzTextureEntry.create({
                                            hash: `stress-hash-${index}-${Date.now()}`,
                                            mimeType: 'image/png',
                                            fileStreamId: fileStreamId as string
                                        }, { owner: group });
                                        
                                        try {
                                            if (texturesCoList.$jazz && typeof texturesCoList.$jazz.push === 'function') {
                                                texturesCoList.$jazz.push(entry);
                                            } else if (typeof texturesCoList.push === 'function') {
                                                texturesCoList.push(entry);
                                            } else if (texturesCoList._raw && typeof texturesCoList._raw.append === 'function') {
                                                texturesCoList._raw.append((entry as any).id, undefined, "trusting");
                                            } else if (typeof texturesCoList.append === 'function') {
                                                texturesCoList.append((entry as any).id, undefined, "trusting");
                                            }
                                            globalJazzOperations++;
                                            console.log(`[Bot ${index}] Spawned FileStream (STR): ${fileStreamId}`);
                                        } catch(e: any) {}
                                    }
                                }
                            }
                            
                            // Every 10 iterations, delete the old ones so we don't bleed memory
                            if (typeof mapObjCoList.asArray === 'function') {
                               const objs = mapObjCoList.asArray();
                               if (objs.length > 50) {
                                  // Jazz CoList doesn't have a splice yet, so we just let them pile up 
                                  // in a real test we'd soft-delete them or clear the session
                               }
                            }
                            return; // Host loop success
                        }
                    }
                }
            } else {
                // Client Bot: Simulate DRAGGING a token (ephemeral updates) then COMMITTING (durable update)
                const tokensListId = root.get("tokens");
                if (tokensListId) {
                    const tokensCoList = await localNode.load(tokensListId as any) as any;
                    if (tokensCoList && typeof tokensCoList.asArray === 'function') {
                        const tokensArray = tokensCoList.asArray();
                        if (tokensArray.length > 0) {
                            
                            if (!dragState.tokenId) {
                                // 20% chance to start dragging a token each tick
                                if (Math.random() < 0.2) {
                                    dragState.tokenId = tokensArray[Math.floor(Math.random() * tokensArray.length)];
                                    dragState.targetX = (Math.random() * 10 - 5);
                                    dragState.targetY = (Math.random() * 10 - 5);
                                    dragState.ticks = 0;
                                } else {
                                    return; // Idling this tick
                                }
                            }
                            
                            if (dragState.tokenId) {
                                const tokenObj = await localNode.load(dragState.tokenId as any) as any;
                                if (tokenObj && typeof tokenObj.get === 'function') {
                                    const currentX = (tokenObj.get("x") as number) || 0;
                                    const currentY = (tokenObj.get("y") as number) || 0;
                                    
                                    dragState.ticks++;
                                    
                                    if (dragState.ticks < 10) {
                                        // 🏎️ SEND EPHEMERAL VIA WEBRTC
                                        const newX = currentX + dragState.targetX * dragState.ticks;
                                        const newY = currentY + dragState.targetY * dragState.ticks;
                                        
                                        mockWebRtcChannel.send(JSON.stringify({ 
                                            t: "ephemeral", 
                                            p: { kind: "token.position.sync", data: { positions: [{ tokenId: dragState.tokenId, x: newX, y: newY }] } }
                                        }));
                                    } else {
                                        // 💾 COMMITTED DURABLE UPDATE TO JAZZ
                                        tokenObj.set("x", currentX + dragState.targetX * 10, "trusting");
                                        tokenObj.set("y", currentY + dragState.targetY * 10, "trusting");
                                        globalJazzOperations++;
                                        console.log(`[Bot ${index}] Dropped Token DO: ${dragState.tokenId}`);
                                        dragState.tokenId = null;
                                    }
                                    return; // Jitter success!
                                } else {
                                    dragState.tokenId = null;
                                }
                            }
                        }
                    }
                }
            }
            
            // Fallback: Just write to the root CoMap to broadcast a state change if no tokens exist
            root.set(`stressBot_${index}_ping`, Date.now(), "trusting");
            globalJazzOperations++;
        } catch (e: any) {
            console.warn(`[Bot ${index}] Failed to ping:`, e.message);
        }
    }, isHostBot ? 500 : (1000 + Math.random() * 2000)); // Host is 2x faster than clients

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
