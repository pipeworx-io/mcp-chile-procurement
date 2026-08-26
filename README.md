# mcp-chile-procurement

Chile Government Procurement MCP — Mercado Público / ChileCompra (keyless-ish).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `chile_search_tenders` | Search Chile government procurement tenders (licitaciones) from Mercado Público / ChileCompra, the official Chilean public-procurement platform. By default returns tenders published TODAY. Pass estado="activas" for all currently OPEN tenders, or fecha="ddmmyyyy" (e.g. "01072026") for tenders published on a specific day. Returns each tender's código (CodigoExterno), name, status, and closing date. Use chile_get_tender with a código for full detail (buyer, amount, line items). |
| `chile_get_tender` | Get the full detail of a single Chile government tender (licitación) from Mercado Público / ChileCompra by its código (CodigoExterno, e.g. "1002772-63-LP26"). Returns the tender name, description, status, buyer organisation/unit/region, estimated amount and currency, key dates (closing, publication, award), and the list of line items (product, category, quantity, unit). Get códigos from chile_search_tenders. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "chile-procurement": {
      "url": "https://gateway.pipeworx.io/chile-procurement/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/chile-procurement/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Chile Procurement data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
