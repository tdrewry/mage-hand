// networking/server-local/index.ts
// Boot the local LAN server.

import net from "node:net";
import { LocalRoomServer } from "./roomServer";

function isBindable(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();

    probe.once("error", () => {
      resolve(false);
    });

    probe.listen({ port, host }, () => {
      probe.close(() => resolve(true));
    });
  });
}

async function pickPort(requested: number, hasCustomPort: boolean): Promise<number> {
  if (await isBindable(requested)) return requested;

  if (hasCustomPort) {
    throw new Error(
      `PORT=${requested} is not available on this machine. Try a different port, e.g. PORT=4001 npm run start`
    );
  }

  const fallbackPort = 4001;
  if (await isBindable(fallbackPort)) {
    // eslint-disable-next-line no-console
    console.warn(`[LocalRoomServer] PORT ${requested} is unavailable; using ${fallbackPort} instead.`);
    return fallbackPort;
  }

  throw new Error(
    `Neither default port ${requested} nor fallback ${fallbackPort} is available. Set PORT explicitly.`
  );
}

const requestedPort = Number(process.env.PORT ?? 3001);
const hasCustomPort = process.env.PORT !== undefined;
const dmPassword = process.env.DM_PASSWORD ?? "dm";
const port = await pickPort(requestedPort, hasCustomPort);

// eslint-disable-next-line no-new
new LocalRoomServer({ port, auth: { dmPassword } });
