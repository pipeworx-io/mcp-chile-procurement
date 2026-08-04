# mcp-chile-procurement

Chile Government Procurement MCP — Mercado Público / ChileCompra (keyless-ish).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Chile Procurement data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
