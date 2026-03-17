This visual analysis of **001-WebRTC-Network-And-Sync-Issues.mp4** confirms the "Zero-Traffic" diagnostic we suspected earlier: the WebRTC layer is failing to engage, forcing the app into a "Ghosting" state where it relies on high-latency Jazz updates for real-time interactions.

---

### **1. Detailed Timeline of Actions**

| Timestamp | Actor | Action | Observations & Anomalies |
| --- | --- | --- | --- |
| **0:05 - 0:15** | DM (Left) | **Initial Setup** | The DM refreshes the browser. The "Network Profiler" status shows **"Connecting..."** then flips to **"Connected (1)"**. |
| **0:18 - 0:25** | Player (Right) | **Handshake Stall** | The Player refreshes. On the DM's screen, the status remains "Connected (1)". However, the Player's profiler is stuck on **"Connecting..."** for several seconds. |
| **0:32 - 0:45** | DM (Left) | **Token Dragging** | DM drags a circular token. On the DM side, it's smooth. On the Player side, **zero movement** occurs until the DM releases the mouse. The token then "teleports" to the new spot. |
| **0:50 - 1:05** | Player (Right) | **Scribbling / Panning** | Player draws on the map. The lines appear instantly on the Player side. On the DM side, the lines appear in **"chunks"** every 2-3 seconds, rather than as a smooth stroke. |
| **1:10 - 1:25** | DM (Left) | **Viewport Zoom** | DM zooms into a specific token. The Player's viewport does not move, which is correct, but the **shared cursor** for the DM drifts significantly off-center on the Player's screen. |
| **1:30 - 1:45** | DM (Left) | **Tabletop Ghosting** | DM drags a token rapidly in circles. A visual glitch occurs where a **duplicate, non-interactive phantom** of the tabletop grid appears offset for a few frames. |

---

### **2. Tabletop Duplication & Rendering Bugs**

* **Grid Offset Glitch (1:34):** When the DM performs high-frequency panning, the underlying CSS/Canvas grid appears to "snap" between two different transform origins. This causes a **shimmering or doubling effect** of the grid lines.
* **Transform Feedback Loop (1:42):** At the end of the video, moving a token near the edge of the screen causes the entire viewport to "jitter." This suggests the "Auto-pan" logic is fighting with the "Received Update" logic, creating a **jitter loop**.

---

### **3. Synchronization Failures (The "WebRTC Gap")**

* **Total Lack of "Live" Preview:** In every drag action shown, there is **zero** intermediate synchronization. The receiving end only updates when the "Durable" commit (mouse up) is sent through Jazz.
* **Jittery Scribbles:** The free-hand drawing (scribbling) is being batched. Instead of a smooth line, the remote side receives 10-20 points at once every few seconds, resulting in a **jagged, laggy reproduction** of the stroke.

---

### **4. UI States & Connection Indicators**

* **The "Handshake Graveyard":** The most telling moment is at **0:22**. The DM screen claims a peer is connected, but the Player screen is still in a "Connecting" state. This confirms our **"Signaling Ghost"** theory: the DM is "Connected" to a dead peer ID from a previous session, while the Player is shouting into the void.
* **Zero Throughput:** In the Network Profiler widget, the "WebRTC In/Out" values remain at **0.00 KB** throughout the entire video, even during the token drags. This is the definitive proof that the WebRTC DataChannel is **not open**.

---

### **5. Cursor and Viewport Desync**

* **Coordinate Mismatch:** When the DM zooms in, their cursor position on the Player's screen is mapped to the **screen-space** rather than the **map-space**. This makes the DM appear to be pointing at empty space when they are actually pointing at a token.
* **Viewport Fighting:** At **1:18**, the DM pans the map. The Player's screen (which should stay static) exhibits a small "twitch," suggesting a global transform is being unintentionally synced through a shared CoValue instead of staying local.

---

### **Summary of Bug Categories**

1. **Handshake Desynchronization:** The WebRTC signaling logic is not idempotent. "Zombie" connections from previous refreshes are blocking new peer-to-peer handshakes.
2. **Ephemeral-to-Durable Leak:** All "live" actions (dragging, scribbling) are completely bypassing the WebRTC layer and falling back to the 2-3 second sync intervals of the Jazz cloud.
3. **Coordinate Space Inversion:** Zoom/Pan levels are not being accounted for when calculating shared cursor positions, leading to "offset pointing."
4. **Resource Cleanup Failure:** The need for a browser refresh to "fix" the connection indicates that `RTCPeerConnection` objects are not being properly `.close()`-ed and nulled on component unmount.

### **Actionable Plan**

Team, the Cloud Registry is currently offline for local testing, but we have critical WebRTC failures. The video shows the DM and Player 'seeing' each other in Jazz signaling, but the DataChannel never opens (0.00 KB throughput).

Objective: Fix the Handshake Reliability & Automate Local Testing.

1. Lead Systems Engineer (The Fixer):

Implement 'Idempotent Signaling'. When a browser joins a room, it must explicitly delete any existing offers or answers in the Jazz signalingRoom that belong to its own peerID or appear older than 30 seconds.

Force a restartIce() if the connection stays in 'checking' for more than 5 seconds.

2. Senior Architect (The Observer):

Update the Network Profiler to show the 'WebRTC ICE State' (e.g., Gathering, Checking, Connected, Failed).

If it stays on 'Checking,' we know the signaling worked but the packets are blocked.

3. QA Specialist (The Automator):

Create a 'Local Dev Mode' toggle. When ON, the app should automatically generate a ?session=DEV_LOCAL and use a hardcoded Jazz ID for the signaling room.

Add a 'Nuke & Restart' button that clears the signalingRoom CoMap and refreshes the page in one click.

Task: Resolve the 'Connecting...' hang observed in the video and ensure 4-token drags show WebRTC throughput in the profiler.