interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Chile Government Procurement MCP — Mercado Público / ChileCompra (keyless-ish).
 *
 * Wraps the public Mercado Público API at api.mercadopublico.cl, which exposes
 * every public tender ("licitación") published on Chile's national procurement
 * platform. Covers searching the daily/active tender list and fetching the full
 * detail of a single tender (buyer, estimated amount, line items, dates).
 *
 * The API requires a `ticket` query param. This pack ships the public ChileCompra
 * test ticket as a fallback but reads an optional override from `args._apiKey`
 * (injected by the gateway when a platform ticket is configured). The shared test
 * ticket is heavily rate-limited by ChileCompra — expect intermittent throttling.
 *
 * All tools return shaped, LLM-friendly objects (not raw API passthrough) and
 * never throw — fetch/parse failures resolve to { error }.
 */


const BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';
// Public ChileCompra test ticket (rate-limited; used only when no override given).
const DEFAULT_TICKET = 'F8537A18-6766-4DEF-9E59-426B4FEE2844';

const tools: McpToolExport['tools'] = [
  {
    name: 'chile_search_tenders',
    description:
      "Search Chile government procurement tenders (licitaciones) from Mercado Público / ChileCompra, the official Chilean public-procurement platform. By default returns tenders published TODAY. Pass estado=\"activas\" for all currently OPEN tenders, or fecha=\"ddmmyyyy\" (e.g. \"01072026\") for tenders published on a specific day. Returns each tender's código (CodigoExterno), name, status, and closing date. Use chile_get_tender with a código for full detail (buyer, amount, line items).",
    inputSchema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          description:
            'Optional tender-status filter. Use "activas" for all currently open tenders. Other accepted values include "publicada", "cerrada", "desierta", "adjudicada", "revocada", "suspendida". Omit for today\'s tenders.',
        },
        fecha: {
          type: 'string',
          description:
            'Optional publication date in ddmmyyyy format (e.g. "01072026" for 1 July 2026). Omit for today. Mutually exclusive with estado — if both given, fecha wins.',
        },
        limit: {
          type: ['number', 'string'],
          description: 'Max tenders to return (default 25, max 200). The result count column reflects the full API total.',
        },
      },
    },
  },
  {
    name: 'chile_get_tender',
    description:
      'Get the full detail of a single Chile government tender (licitación) from Mercado Público / ChileCompra by its código (CodigoExterno, e.g. "1002772-63-LP26"). Returns the tender name, description, status, buyer organisation/unit/region, estimated amount and currency, key dates (closing, publication, award), and the list of line items (product, category, quantity, unit). Get códigos from chile_search_tenders.',
    inputSchema: {
      type: 'object',
      properties: {
        codigo: {
          type: 'string',
          description: 'Tender código / CodigoExterno, e.g. "1002772-63-LP26".',
        },
      },
      required: ['codigo'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Read an optional gateway-injected platform ticket, then strip it from args.
  const ticket = strArg((args as any)._apiKey) ?? DEFAULT_TICKET;
  delete (args as any)._apiKey;
  try {
    switch (name) {
      case 'chile_search_tenders':
        return await searchTenders(args, ticket);
      case 'chile_get_tender':
        return await getTender(args, ticket);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchTenders(args: Record<string, unknown>, ticket: string): Promise<unknown> {
  const limit = Math.min(Math.max(intArg(args.limit) ?? 25, 1), 200);
  const params = new URLSearchParams();
  const fecha = strArg(args.fecha);
  const estado = strArg(args.estado);
  if (fecha) params.set('fecha', fecha);
  else if (estado) params.set('estado', estado.toLowerCase());
  params.set('ticket', ticket);

  const data = (await ccGet(`/licitaciones.json?${params.toString()}`)) as {
    Cantidad?: number;
    Listado?: any[];
  };
  const listado = data.Listado ?? [];
  const tenders = listado.slice(0, limit).map((t) => ({
    codigo: t.CodigoExterno,
    name: t.Nombre,
    status: t.Estado ?? statusLabel(t.CodigoEstado),
    status_code: t.CodigoEstado,
    closing_date: t.FechaCierre ?? null,
    ...(t.Comprador?.NombreOrganismo ? { buyer: t.Comprador.NombreOrganismo } : {}),
  }));
  return {
    filter: fecha ? { fecha } : estado ? { estado } : { fecha: 'today' },
    total: data.Cantidad ?? tenders.length,
    returned: tenders.length,
    tenders,
  };
}

async function getTender(args: Record<string, unknown>, ticket: string): Promise<unknown> {
  const codigo = strArg(args.codigo);
  if (!codigo) throw new Error('chile_get_tender requires "codigo" — a tender CodigoExterno like "1002772-63-LP26".');
  const params = new URLSearchParams({ codigo, ticket });
  const data = (await ccGet(`/licitaciones.json?${params.toString()}`)) as { Listado?: any[] };
  const t = (data.Listado ?? [])[0];
  if (!t) return { error: 'tender not found', codigo };

  const c = t.Comprador ?? {};
  const f = t.Fechas ?? {};
  const items = (t.Items?.Listado ?? []).map((it: any) => ({
    correlativo: it.Correlativo,
    product: it.NombreProducto,
    category: it.Categoria,
    description: it.Descripcion,
    quantity: it.Cantidad,
    unit: it.UnidadMedida,
  }));

  return {
    codigo: t.CodigoExterno,
    name: t.Nombre,
    description: t.Descripcion ?? null,
    status: t.Estado ?? statusLabel(t.CodigoEstado),
    status_code: t.CodigoEstado,
    type: t.Tipo ?? null,
    currency: t.Moneda ?? null,
    estimated_amount: t.MontoEstimado ?? null,
    buyer: {
      organism: c.NombreOrganismo ?? null,
      unit: c.NombreUnidad ?? null,
      region: c.RegionUnidad ?? null,
      comuna: c.ComunaUnidad ?? null,
      address: c.DireccionUnidad ?? null,
      contact: c.NombreUsuario ?? null,
    },
    dates: {
      closing: t.FechaCierre ?? null,
      publication: f.FechaPublicacion ?? null,
      questions_deadline: f.FechaFinal ?? null,
      award: f.FechaAdjudicacion ?? null,
    },
    item_count: t.Items?.Cantidad ?? items.length,
    items,
  };
}

// CodigoEstado → Spanish status label (values kept in Spanish per convention).
function statusLabel(code: unknown): string | null {
  switch (code) {
    case 5:
      return 'Publicada';
    case 6:
      return 'Cerrada';
    case 7:
      return 'Desierta';
    case 8:
      return 'Adjudicada';
    case 18:
      return 'Revocada';
    case 19:
      return 'Suspendida';
    default:
      return null;
  }
}

async function ccGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`Mercado Público API: ${res.status} ${body}`.trim());
  }
  return res.json();
}

function strArg(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function intArg(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Math.trunc(Number(v));
  return undefined;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
