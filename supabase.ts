type QueryFilter = { column: string; value: unknown };
type SortFilter = { column: string; ascending: boolean };
type QueryOperation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

type QueryPayload = {
  operation: QueryOperation;
  select?: string;
  values?: unknown;
  filters: QueryFilter[];
  order?: SortFilter;
  limit?: number;
  single?: boolean;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Erro HTTP ${response.status}`);
  }

  return payload as T;
}

class MysqlQueryBuilder implements PromiseLike<{ data: any; error: Error | null }> {
  private payload: QueryPayload = {
    operation: 'select',
    filters: []
  };

  constructor(private readonly table: string) {}

  select(columns = '*') {
    this.payload.operation = 'select';
    this.payload.select = columns;
    return this;
  }

  insert(values: unknown) {
    this.payload.operation = 'insert';
    this.payload.values = values;
    return this;
  }

  upsert(values: unknown) {
    this.payload.operation = 'upsert';
    this.payload.values = values;
    return this;
  }

  update(values: unknown) {
    this.payload.operation = 'update';
    this.payload.values = values;
    return this;
  }

  delete() {
    this.payload.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.payload.filters.push({ column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.payload.order = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.payload.limit = count;
    return this;
  }

  single() {
    this.payload.single = true;
    return this;
  }

  private async execute() {
    try {
      const result = await requestJson<{ data: any }>(`/api/db/${encodeURIComponent(this.table)}`, {
        method: 'POST',
        body: JSON.stringify(this.payload)
      });
      return { data: result.data, error: null };
    } catch (error) {
      console.error(`Erro MySQL na tabela ${this.table}:`, error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  then<TResult1 = { data: any; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class MysqlChannel {
  on() {
    return this;
  }

  subscribe() {
    return this;
  }
}

export const supabase = {
  from(table: string) {
    return new MysqlQueryBuilder(table);
  },
  channel() {
    return new MysqlChannel();
  },
  removeChannel() {
    return undefined;
  }
};
