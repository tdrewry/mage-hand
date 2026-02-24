# Local LAN Room Server (Node + ws)

This folder provides a minimal room authority server for local hosting on a LAN.

It speaks the same JSON protocol as the future Cloudflare Durable Object implementation.

## Install

From this directory:

```bash
npm i
```

## Run

```bash
npm run start
```

By default:
- Port: `3001` (auto-falls back to `4001` if `3001` is blocked on your machine)
- DM password: `dm`

You can override:

```bash
PORT=4001 DM_PASSWORD=mysecret npm run start
```


## Connect from clients

In your VTT client:
- **Server URL**: `ws://<host-lan-ip>:<port>` (use the port shown in server startup logs)
- **Session Code**: (any string; creates/joins that room)
- **Username**: any
- **Password**: `dm` to get the `dm` role (full permissions), otherwise you will be `player`.

## Notes

- This server keeps state in memory and drops it when the last client disconnects.
- It provides basic catch-up via an in-memory op log.
- It is meant for development and LAN play; not hardened for internet exposure.
