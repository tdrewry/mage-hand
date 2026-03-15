# Mage-Hand Setup & Deployment Guide

This guide covers how to run Mage-Hand locally with multiplayer support enabled, how to validate your setup, and recommendations for deploying to the cloud.

## Local Development Setup

Because Mage-Hand is a localized-first application, you can run the app without any networking overhead. However, to test multiplayer synchronization locally, you need to run both the frontend and a local instance of the Jazz Sync Server.

### 1. Start the Frontend
In your first terminal, run the Vite development server:
```bash
npm install
npm run dev
```
This will start the React application on `http://localhost:8080` (or whichever port Vite automatically assigns).

### 2. Start the Local Jazz Sync Server
In a second terminal, start the local Jazz sync node:
```bash
npm run dev:jazz
```
This runs `npx jazz-run sync --port 4200`, which stands up an in-memory Jazz sync server on `ws://localhost:4200`. This server relays standard CoValue updates between your local browser windows.

## Validating the Setup

Once both processes are running, you can validate the multiplayer synchronization:

1.  **Open two instances:** Open your browser and navigate to the local Vite URL (e.g., `http://localhost:8080`) in two separate windows or tabs.
2.  **Enable Jazz Transport:** By default, the app may not be actively syncing unless you tell it to. In the application settings or multiplayer lobby tab of the UI, ensure that your transport method is set to **Jazz**. (You should momentarily see a toast notification if the handshake fails; no notification usually means success).
3.  **Test Synchronization:**
    *   In Window 1, drag a token on the tabletop, draw a wall, or place an effect.
    *   Instantly look at Window 2. The changes should replicate with virtually zero latency.
    *   Open the console (F12) to monitor any `[jazz-bridge]` debug logs if you suspect issues with specific entities (like textures waiting on FileStream).

## Cloud Deployment Suggestions

When you are ready to share Mage-Hand with your party, you need to deploy the application. Since the architecture decouples the frontend UI from the State/Sync server, they are deployed separately.

### 1. Frontend (Static App)
Since Mage-Hand relies on IndexedDB and Zustand for local state, and Vite for building, it produces a pure static Single Page Application (SPA).

*   **Vercel / Netlify (Preferred):** Highly recommended. Simply connect your GitHub repository to either service. Set your build command to `npm run build` and output directory to `dist/`. These services natively support Single Page Application routing, meaning `react-router` paths resolve without 404 errors.
*   **Cloudflare Pages:** Also an excellent, high-performance edge network choice for Vite apps that supports native SPA routing.
*   **GitHub Pages (Alternative):** A viable, free option built right into your repository. Note that GitHub Pages does not natively support SPA routes (like navigating directly to `/session/123`). This requires a workaround, such as the included `public/404.html` redirect script, which catches 404 errors and funnels them back to `index.html`. While this works locally and functionally, it can be slightly fragile for search-engine crawlers and link-previews in chat applications.

*Note: Ensure your web host handles Client-Side Routing correctly (i.e., routing all non-asset requests to `index.html`), though React Router in Hash mode or standard mode usually is handled gracefully by these providers.*

### 2. Jazz Sync Server (Multiplayer)
Deploying the Jazz backend means moving away from the `jazz-run sync` local instance.

*   **Jazz Cloud (Managed):** The easiest path is to use the managed [Jazz Cloud](https://jazz.tools/). You will need to obtain an API key/project ID and insert that into your environment variables. 
    *   Change the default peer URL in `src/lib/jazz/provider.tsx` (or `.env` file via `VITE_JAZZ_SYNC_URL`) to point to the Jazz Cloud mesh (like `wss://cloud.jazz.tools/...`).
*   **Self-Hosting on Railway/Render:** If you prefer to self-host your sync server, you can deploy a Node.js instance running `@jazz-tools/sync-server`. Services like [Railway.app](https://railway.app/) or [Render](https://render.com/) are excellent for easily deploying WebSocket-reliant Node applications.
    *   Ensure that the deployed Service URL starts with `wss://` and you feed this to the `VITE_JAZZ_SYNC_URL` environment variable for your frontend build.

## Important Note on Storage Limits
Currently, heavy assets (like 4K map backgrounds) are managed via local IndexedDB storage to avoid destroying Jazz's quick state-sync payload size. When playing via Cloud, remind players that massive textures will sync via Jazz FileStreams and might take longer to appear on slow connections initially before caching locally.
