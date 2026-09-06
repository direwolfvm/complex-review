/**
 * Minimal stand-in for the Supabase PostgREST client.
 *
 * The real client exposes a chainable builder that is also awaitable, so the same
 * object has to satisfy `await supabase.from(t).select().eq(...)` and
 * `await supabase.from(t).insert(x).select().single()`. This records what each chain
 * asked for and hands it to a responder, which lets a test assert on the query that
 * was built as well as on what the code did with the answer.
 */

export interface RecordedCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  filters: Record<string, unknown>;
  payload?: unknown;
  single: boolean;
}

export interface MockResult {
  data: unknown;
  error: unknown;
}

export type Responder = (call: RecordedCall) => MockResult;

const EMPTY: MockResult = { data: null, error: null };

class QueryBuilder implements PromiseLike<MockResult> {
  private opLocked = false;

  constructor(
    private readonly call: RecordedCall,
    private readonly respond: Responder
  ) {}

  private setOp(op: RecordedCall['op'], payload?: unknown) {
    // `insert(...).select()` must stay an insert, so the first mutating call wins.
    if (!this.opLocked) {
      this.call.op = op;
      this.opLocked = true;
    }
    if (payload !== undefined) this.call.payload = payload;
    return this;
  }

  select(_columns?: string) {
    if (!this.opLocked) return this.setOp('select');
    return this;
  }

  insert(payload: unknown) { return this.setOp('insert', payload); }
  update(payload: unknown) { return this.setOp('update', payload); }
  delete() { return this.setOp('delete'); }

  eq(column: string, value: unknown) {
    this.call.filters[column] = value;
    return this;
  }

  in(column: string, values: unknown[]) {
    this.call.filters[column] = values;
    return this;
  }

  // Shape-only helpers the production code chains; they do not affect the recorded query.
  order() { return this; }
  limit() { return this; }

  single() {
    this.call.single = true;
    return Promise.resolve(this.respond(this.call));
  }

  then<TResult1 = MockResult, TResult2 = never>(
    onfulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.respond(this.call)).then(onfulfilled, onrejected);
  }
}

export interface MockSupabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  calls: RecordedCall[];
  callsTo: (table: string) => RecordedCall[];
}

/**
 * `responder` may return undefined for queries a test does not care about, which then
 * resolve to an empty result rather than failing.
 */
export function createMockSupabase(
  responder: (call: RecordedCall) => MockResult | undefined
): MockSupabase {
  const calls: RecordedCall[] = [];

  const respond: Responder = (call) => responder(call) ?? EMPTY;

  const client = {
    from(table: string) {
      const call: RecordedCall = { table, op: 'select', filters: {}, single: false };
      calls.push(call);
      return new QueryBuilder(call, respond);
    },
  };

  return {
    client,
    calls,
    callsTo: (table: string) => calls.filter((c) => c.table === table),
  };
}
