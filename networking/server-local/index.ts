// networking/server-local/index.ts
// Boot the local LAN server.

import { LocalRoomServer } from "./roomServer";

const port = Number(process.env.PORT ?? 3001);
const dmPassword = process.env.DM_PASSWORD ?? "dm";

// eslint-disable-next-line no-new
new LocalRoomServer({ port, auth: { dmPassword } });
