import type { Bundle, CapabilityStatement, FhirResource } from 'fhir/r4.js';

export interface FhirClientOptions {
  baseUrl: string;
  /** Bearer token or custom auth header factory for production HIE/EMR endpoints. */
  authHeader?: () => Promise<string | undefined> | string | undefined;
  fetchImpl?: typeof fetch;
  retries?: number;
}

export class FhirClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly operationOutcome: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'FhirClientError';
  }
}

/** Minimal R4 REST client. Enough for the projector/outbox; swap for a full SDK if needed. */
export class FhirClient {
  private readonly fetchImpl: typeof fetch;
  private readonly retries: number;

  constructor(private readonly opts: FhirClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.retries = opts.retries ?? 3;
  }

  async capability(): Promise<CapabilityStatement> {
    return this.request<CapabilityStatement>('GET', '/metadata');
  }

  async read<T extends FhirResource>(type: T['resourceType'], id: string): Promise<T> {
    return this.request<T>('GET', `/${type}/${id}`);
  }

  /** PUT with client-assigned id = idempotent upsert, which is what the projector wants. */
  async upsert<T extends FhirResource & { id?: string }>(resource: T): Promise<T> {
    if (!resource.id) throw new Error('upsert requires resource.id');
    return this.request<T>('PUT', `/${resource.resourceType}/${resource.id}`, resource);
  }

  async create<T extends FhirResource>(resource: T): Promise<T> {
    return this.request<T>('POST', `/${resource.resourceType}`, resource);
  }

  async search<T extends FhirResource>(type: T['resourceType'], params: Record<string, string>): Promise<Bundle<T>> {
    const qs = new URLSearchParams(params).toString();
    return this.request<Bundle<T>>('GET', `/${type}?${qs}`);
  }

  async transaction(resources: FhirResource[]): Promise<Bundle> {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: resources.map((r) => ({
        resource: r,
        request: { method: 'PUT', url: `${r.resourceType}/${(r as { id?: string }).id}` },
      })),
    };
    return this.request<Bundle>('POST', '', bundle);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}${path}`;
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const auth = await this.opts.authHeader?.();
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/fhir+json',
          ...(body ? { 'Content-Type': 'application/fhir+json' } : {}),
          ...(auth ? { Authorization: auth } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status >= 500 || res.status === 429;
      if (retryable && attempt <= this.retries) {
        await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
        continue;
      }
      let outcome: unknown = undefined;
      try {
        outcome = await res.json();
      } catch {
        /* non-JSON error body */
      }
      throw new FhirClientError(res.status, outcome, `FHIR ${method} ${path} failed with ${res.status}`);
    }
  }
}
