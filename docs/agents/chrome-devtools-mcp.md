# Chrome DevTools MCP (chrome-mcp)

How browser verification works in this environment, and the expected first-connect behaviour. Read this before driving the browser so the failure below is not re-investigated.

## Setup

- The server is configured in `~/.config/opencode/opencode.json` under `mcp.chrome-devtools`: command `chrome-devtools-mcp --browserUrl http://127.0.0.1:9222`, timeout 60000.
- Chrome runs on the **Windows host**. The MCP server runs inside **WSL** and attaches to Chrome's DevTools endpoint at `127.0.0.1:9222`. The user starts Chrome with remote debugging themselves.

## Expected on first connect: it fails, then self-heals

The first connection attempt of a session commonly ends as:

```
✗ chrome-devtools  failed: Connection closed
✓ headroom         connected
✓ serena           connected
```

A few seconds later the same server connects on its own. The opencode log then shows:

```
message="mcp connected" server=chrome-devtools tools=30
```

This failed-then-connected pair repeats every session. It is normal. It is not a Planoo bug and it needs no debugging.

## The short path

1. Treat a first-attempt `Connection closed` as expected, not as a blocker.
2. Check liveness with the cheapest read-only tool, `list_pages`. If it returns tabs, the MCP is usable.
3. If an individual tool call errors, retry it once. The failed first handshake self-heals.
4. If it never comes up, ask the user to (re)open Chrome on Windows with remote debugging on port 9222. Never skip browser verification and never fake auth (see `AGENTS.md`, Development Workflow).

## When it does not self-heal

- Is Chrome running on the Windows host? The MCP only attaches to an existing Chrome, it does not start one.
- Is `chrome-devtools-mcp` on PATH in WSL (`which chrome-devtools-mcp`)?
- Is port 9222 reachable from WSL (`curl -s http://127.0.0.1:9222/json/version`)?

## Do not

Do not re-open the MCP startup investigation. Prior sessions probed `opencode mcp list`, `npx` variants, and manual JSON-RPC handshakes. The observed result is the failed-then-connected pair above, and the fix is to wait and retry.
