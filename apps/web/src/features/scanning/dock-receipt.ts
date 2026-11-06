import type { PurchaseOrderLineSummary, PurchaseReceiptInput } from '@mystock/contracts';

/** One unit captured at the dock: a serial and, when the box carries both codes, its IMEI. */
export interface DockSerial {
  serialNumber: string;
  imei?: string;
}

export interface DockLine {
  /** Units counted for a quantity line. A serialized line counts its collected serials instead. */
  quantity: number;
  serials: DockSerial[];
}

/** What has been scanned since the last post, keyed by purchase order line id. */
export type DockState = Record<string, DockLine>;

export type CollectOutcome = 'quantity' | 'serial' | 'imei' | 'duplicate' | 'full';

const IMEI_PATTERN = /^[0-9]{14,17}$/;

export function remainingQuantity(line: PurchaseOrderLineSummary): number {
  return line.quantityOrdered - line.quantityReceived;
}

export function unitsOf(line: PurchaseOrderLineSummary, dock: DockLine | undefined): number {
  if (!dock) return 0;
  return line.isSerialized ? dock.serials.length : dock.quantity;
}

function isEmpty(dock: DockLine): boolean {
  return dock.quantity <= 0 && dock.serials.length === 0;
}

/** An entry only exists while it holds something, so the dock never shows a zero line. */
function commit(
  state: DockState,
  line: PurchaseOrderLineSummary,
  next: DockLine,
  outcome: Exclude<CollectOutcome, 'full'>,
): [DockState, CollectOutcome] {
  if (unitsOf(line, next) > remainingQuantity(line)) return [state, 'full'];

  const pruned = Object.fromEntries(
    Object.entries({ ...state, [line.id]: next }).filter(
      ([lineId, dock]) => lineId !== line.id || !isEmpty(dock),
    ),
  );
  return [pruned, isEmpty(next) ? 'quantity' : outcome];
}

/** One hardware read of a quantity product adds one unit. */
export function collectUnit(
  state: DockState,
  line: PurchaseOrderLineSummary,
): [DockState, CollectOutcome] {
  const current = state[line.id];
  return commit(
    state,
    line,
    { quantity: (current?.quantity ?? 0) + 1, serials: current?.serials ?? [] },
    'quantity',
  );
}

/**
 * A serialized unit arrives as `SN`, as `SN|IMEI`, or as a bare IMEI that belongs to
 * the serial read just before it: a phone box carries both codes and the operator
 * scans whichever faces up.
 */
export function collectSerial(
  state: DockState,
  line: PurchaseOrderLineSummary,
  rawCode: string,
): [DockState, CollectOutcome] {
  const code = rawCode.trim();
  const current = state[line.id];
  const serials = current?.serials ?? [];
  const last = serials.at(-1);

  if (last && last.imei === undefined && IMEI_PATTERN.test(code)) {
    return commit(
      state,
      line,
      {
        quantity: current?.quantity ?? 0,
        serials: [...serials.slice(0, -1), { ...last, imei: code }],
      },
      'imei',
    );
  }

  const [serialNumber, imei = ''] = code.split('|').map((part) => part.trim());
  if (!serialNumber) return [state, 'duplicate'];
  if (serials.some((entry) => entry.serialNumber.toLowerCase() === serialNumber.toLowerCase())) {
    return [state, 'duplicate'];
  }

  return commit(
    state,
    line,
    {
      quantity: current?.quantity ?? 0,
      serials: [...serials, imei ? { serialNumber, imei } : { serialNumber }],
    },
    'serial',
  );
}

export function dropSerial(
  state: DockState,
  line: PurchaseOrderLineSummary,
  index: number,
): DockState {
  const current = state[line.id];
  if (!current) return state;
  const serials = current.serials.filter((_, position) => position !== index);
  const [next] = commit(state, line, { quantity: current.quantity, serials }, 'serial');
  return next;
}

/** The typed override, for a case of twenty cables that is not worth twenty reads. */
export function setUnits(
  state: DockState,
  line: PurchaseOrderLineSummary,
  value: string,
): [DockState, CollectOutcome] {
  const normalized = value.trim().replace(',', '.');
  const quantity = Number(normalized);
  const current = state[line.id];

  if (normalized === '' || !Number.isFinite(quantity) || quantity < 0) {
    return commit(state, line, { quantity: 0, serials: current?.serials ?? [] }, 'quantity');
  }

  return commit(
    state,
    line,
    { quantity: Math.round(quantity * 10_000) / 10_000, serials: current?.serials ?? [] },
    'quantity',
  );
}

export function clearLine(state: DockState, lineId: string): DockState {
  return Object.fromEntries(Object.entries(state).filter(([id]) => id !== lineId));
}

export function buildReceipt(
  state: DockState,
  lines: PurchaseOrderLineSummary[],
): PurchaseReceiptInput {
  return {
    lines: lines.flatMap((line) => {
      const dock = state[line.id];
      const quantity = unitsOf(line, dock);
      if (!dock || quantity <= 0) return [];

      return line.isSerialized
        ? [{ lineId: line.id, quantity, serials: dock.serials }]
        : [{ lineId: line.id, quantity }];
    }),
  };
}

export function dockTotals(state: DockState, lines: PurchaseOrderLineSummary[]) {
  let open = 0;
  let units = 0;
  let serials = 0;

  for (const line of lines) {
    const dock = state[line.id];
    const quantity = unitsOf(line, dock);
    if (!dock || quantity <= 0) continue;

    open += 1;
    units += quantity;
    serials += dock.serials.length;
  }

  return { open, units, serials };
}
