import { WebRTCTransport } from "./WebRTCTransport";
import { useNetworkDiagnosticsStore } from "@/stores/networkDiagnosticsStore";
import { toast } from "sonner";

/**
 * Mocks the behavior of the Jazz CRDT `signalingRoom.$jazz`.
 * It provides a `set` to mutate state, and `subscribe` to listen for mutations.
 */
class MockJazzSignalingRoom {
  private state: Record<string, string> = {};
  private listeners: Set<(state: Record<string, string>) => void> = new Set();
  
  // Custom property to mock Jazz connectedUsers structure
  public hostId = "host-bot";

  $jazz = {
    set: (key: string, value: string | undefined) => {
      if (value === undefined) delete this.state[key];
      else this.state[key] = value;
      this.notify();
    },
    delete: (key: string) => {
      delete this.state[key];
      setTimeout(() => this.notify(), 10);
    },
    subscribe: (_deps: any[], cb: (state: Record<string, string>) => void) => {
      this.listeners.add(cb);
      // Immediate initial fire
      setTimeout(() => cb({...this.state}), 0);
      return () => this.listeners.delete(cb);
    }
  };

  private notify() {
    // Clone state so handlers don't accidentally mutate it directly
    const snapshot = { ...this.state };
    // Simulate network delay to prevent synchronous call stack explosions
    setTimeout(() => {
        this.listeners.forEach(cb => cb(snapshot));
    }, 10);
  }
}

/**
 * Runs a standalone simulated WebRTC connection completely in-memory.
 */
export async function runMockSignalingTest() {
  toast.info("Starting Mock Signaling Test...");
  const store = useNetworkDiagnosticsStore.getState();
  store.clearAll();

  // 1. Create the mock Jazz root
  const mockRoom = new MockJazzSignalingRoom();
  const mockConnectedUsers = new MockJazzSignalingRoom();

  const mockSessionRootHost: any = {
    signalingRoom: mockRoom,
    connectedUsers: mockConnectedUsers
  };

  const mockSessionRootClient: any = {
    signalingRoom: mockRoom,
    connectedUsers: mockConnectedUsers
  };

  // 2. Instantiate isolated Transports
  const hostTransport = new WebRTCTransport(mockSessionRootHost, "host-bot", ["host"]);
  const clientTransport = new WebRTCTransport(mockSessionRootClient, "client-bot", ["player"]);

  // 3. Setup test verification promises
  const testCompletion = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Test timed out after 10000ms"));
    }, 10000);

    // Host listens for message from Client
    hostTransport.on("message", (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.t === "ephemeral" && payload.p.kind === "ping") {
           clearTimeout(timeout);
           resolve();
        }
      } catch (e) {}
    });
  });

  try {
    // 4. Connect both Transports
    hostTransport.connect("mock://host");
    clientTransport.connect("mock://client");

    // 5. Simulate Client joining the Jazz session (triggering the Host to initiate offer)
    mockConnectedUsers.$jazz.set("client-bot", JSON.stringify({ status: "connected" }));

    // 6. Wait for DataChannels to open, then fire payload
    let payloadSent = false;
    const interval = setInterval(() => {
       const clientState = useNetworkDiagnosticsStore.getState().peers["host-bot"];
       if (clientState?.stage === "datachannel_open" && !payloadSent) {
          payloadSent = true;
          // Send from Client to Host
          clientTransport.send(JSON.stringify({ 
             t: "ephemeral", 
             userId: "client-bot", 
             p: { kind: "ping", data: "hello from mock client" } 
          }));
       }
    }, 100);

    await testCompletion;
    clearInterval(interval);

    hostTransport.close();
    clientTransport.close();
    
    toast.success("Mock Signaling Test PASSED! DataChannel is verified.");
    console.log("[MockSignaling] Success!");
    
  } catch (error: any) {
    hostTransport.close();
    clientTransport.close();
    toast.error(`Mock Signaling Test FAILED: ${error.message}`);
    console.error("[MockSignaling] Failed", error);
  }
}
