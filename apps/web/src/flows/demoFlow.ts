export type StepStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'error-expected'
  | 'error-unexpected';

export interface FlowContext {
  token: string | null;
  userId: string | null;
  runEmail: string;
}

export interface StepResult {
  stepId: number;
  status: StepStatus;
  requestBody?: object;
  requestHeaders?: Record<string, string>;
  resolvedPath: string;
  responseStatus: number;
  responseBody: unknown;
  latencyMs: number;
  timestamp: Date;
}

export interface StepDef {
  id: number;
  service: 'identity' | 'ledger';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  whyItMatters: string;
  getBody?: (ctx: FlowContext) => object;
  getHeaders?: (ctx: FlowContext) => Record<string, string>;
  getResolvedPath?: (ctx: FlowContext) => string;
  expectedErrorStatus?: number;
}

export const demoFlow: StepDef[] = [
  {
    id: 1,
    service: 'identity',
    method: 'POST',
    path: '/users',
    title: 'Create account',
    description: 'We register Alice with the Identity service.',
    whyItMatters: 'Passwords are hashed server-side — never stored in plain text.',
    getBody: (ctx) => ({
      first_name: 'Alice',
      last_name: 'Demo',
      email: ctx.runEmail,
      password: 'secret123',
    }),
  },
  {
    id: 2,
    service: 'identity',
    method: 'POST',
    path: '/auth',
    title: 'Login',
    description: 'Alice logs in. The Identity service issues a signed JWT.',
    whyItMatters: 'This token is stored in React state only — never in localStorage.',
    getBody: (ctx) => ({ email: ctx.runEmail, password: 'secret123' }),
  },
  {
    id: 3,
    service: 'identity',
    method: 'GET',
    path: '/users/:id',
    title: 'Verify profile',
    description: 'We fetch Alice\'s profile to confirm the account exists.',
    whyItMatters: 'Validates the full create→read round-trip before touching the ledger.',
    getResolvedPath: (ctx) => `/users/${ctx.userId}`,
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
  {
    id: 4,
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    title: 'Credit +R$100',
    description: 'We credit Alice\'s account with R$100 (10,000 cents).',
    whyItMatters: 'The Ledger records this with full ACID guarantees and a SELECT FOR UPDATE lock.',
    getBody: () => ({ type: 'CREDIT', amount: 10000 }),
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
  {
    id: 5,
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    title: 'Credit +R$50',
    description: 'We credit another R$50. Alice now has R$150.',
    whyItMatters: 'Multiple credits accumulate correctly — each in its own ACID transaction.',
    getBody: () => ({ type: 'CREDIT', amount: 5000 }),
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
  {
    id: 6,
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    title: 'Debit -R$30 with idempotency',
    description: 'We debit R$30, including an Idempotency-Key header.',
    whyItMatters: 'The key ensures this exact debit can be retried without double-charging.',
    getBody: () => ({ type: 'DEBIT', amount: 3000 }),
    getHeaders: (ctx) => ({
      Authorization: `Bearer ${ctx.token ?? ''}`,
      'Idempotency-Key': 'demo-debit-001',
    }),
  },
  {
    id: 7,
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    title: 'Retry same debit (cached)',
    description: 'We send the exact same debit again with the same Idempotency-Key.',
    whyItMatters: 'The server returns the cached response — no new debit occurs. Balance stays at R$120.',
    getBody: () => ({ type: 'DEBIT', amount: 3000 }),
    getHeaders: (ctx) => ({
      Authorization: `Bearer ${ctx.token ?? ''}`,
      'Idempotency-Key': 'demo-debit-001',
    }),
  },
  {
    id: 8,
    service: 'ledger',
    method: 'GET',
    path: '/balance',
    title: 'Check balance',
    description: 'We check Alice\'s balance. It\'s R$120 — not R$90, because the duplicate was idempotent.',
    whyItMatters: 'The Ledger reads from a balance snapshot — O(1) read, no full table scan.',
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
  {
    id: 9,
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    title: 'Debit over limit',
    description: 'We attempt to debit R$999.99 — far more than Alice\'s R$120.',
    whyItMatters: 'The SELECT FOR UPDATE lock prevented any inconsistency. 422 is the correct, safe rejection.',
    getBody: () => ({ type: 'DEBIT', amount: 99999 }),
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
    expectedErrorStatus: 422,
  },
  {
    id: 10,
    service: 'ledger',
    method: 'GET',
    path: '/transactions',
    title: 'List history',
    description: 'We list Alice\'s full transaction history, filterable by CREDIT or DEBIT.',
    whyItMatters: 'The duplicate debit (step 7) doesn\'t appear as a separate entry.',
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
  {
    id: 11,
    service: 'identity',
    method: 'DELETE',
    path: '/users/:id',
    title: 'Delete with balance (rejected)',
    description: 'We try to delete Alice\'s account while she still has R$120.',
    whyItMatters: 'Identity calls Ledger internally to verify zero balance. 409 means the cross-service check works.',
    getResolvedPath: (ctx) => `/users/${ctx.userId}`,
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
    expectedErrorStatus: 409,
  },
  {
    id: 12,
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    title: 'Debit to zero',
    description: 'We debit Alice\'s remaining R$120, bringing her balance to zero.',
    whyItMatters: 'Only after this can the account be safely deleted.',
    getBody: () => ({ type: 'DEBIT', amount: 12000 }),
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
  {
    id: 13,
    service: 'identity',
    method: 'DELETE',
    path: '/users/:id',
    title: 'Delete user (success)',
    description: 'With a zero balance, Alice\'s account is successfully deleted.',
    whyItMatters: 'The full lifecycle — create, transact, verify, clean up — is complete.',
    getResolvedPath: (ctx) => `/users/${ctx.userId}`,
    getHeaders: (ctx) => ({ Authorization: `Bearer ${ctx.token ?? ''}` }),
  },
];
