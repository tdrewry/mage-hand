# Ideal Hosting Recommendation for TTRPG Small Groups

**Target Group:** 6–12 players  
**Session Length:** 4–6 hours (weekly or bi-weekly)  
**Map Assets:** 3–6 maps (moderately graphic, approx 5MB–10MB each)

Based on the application's architecture (static React frontend + Jazz.tools CRDT networking), the absolute **most cost-effective and ideal way to host** a game of this scale relies entirely on a **Serverless Setup**. 

## The Ideal Setup

1. **Frontend Hosting (Vercel / Cloudflare Pages / GitHub Pages)**
   - The compiled React application (`dist` folder) consists only of HTML, CSS, Javascript, and base assets. 
   - Deploying directly to Cloudflare Pages or Vercel distributes your frontend across a global CDN.

2. **Durable Sync Layer (Jazz.tools Cloud)**
   - Bypass the cumbersome local `./networking/server-local` WebSocket relay server.
   - Point your frontend build variable `VITE_JAZZ_SYNC_URL` to your free-tier Jazz Cloud Mesh worker URL.

## Cost Estimation & Payload Breakdown

During a heavily active 6-hour session:
- **Map Downloads:** 6 maps × 10MB = 60MB per player. For 12 players, that equates to **~720MB** of static map texture transfer.
- **Durable Operations (Jazz):** Token movements, dice rolls, drawing fog-of-war strokes, tracking initiative. These are micro-JSON byte arrays. A furious 6-hour combat scenario pushes maybe 5-10MB of CRDT payloads across the wire per user.
- **Totals:** Total session bandwidth is under 1 GB per session, distributed across Cloudflare Edge Nodes via Jazz's Mesh.

### Why is this $0.00?
Both Vercel (Frontend) and Jazz.tools (Backend Networking) are built around "Severless Pay-As-You-Go" models.
Because tabletop game nights are incredibly **"spiky"** in terms of compute allocation (zero traffic for 6.5 days, huge traffic for 4 hours), you never rack up persistent server costs compared to renting an always-on VPS ($10/mo) for a node reverse proxy relay.

**Estimated Cost:**  
The usage falls so wildly short of the "Serverless Enterprise Thresholds" (e.g., Vercel's 100GB monthly bandwidth limits, Cloudflare's 10 million worker invokes) that hosting a group of this size is indefinitely **$0.00 / month.**
