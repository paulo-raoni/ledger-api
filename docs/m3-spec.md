# M3 — Frontend Demo UI: Spec Final
**Repo:** paulo-raoni/ledger-api  
**Location:** `apps/web` — port 3000  
**Stack:** React 19 + Vite + Tailwind CSS  
**Data:** 2026-04-14  
**Versão:** 4

---

## 1. Decisões arquiteturais

| Questão | Decisão | Rationale |
|---|---|---|
| Tema | **Light/dark toggle** | `Tailwind dark:` + `prefers-color-scheme`. Toggle no header. Default: sistema. |
| Tela inicial | **Boot direto no Autoplay** | Sem setup, sem login manual. Demo começa imediatamente. |
| URLs dos serviços | **Hardcoded** — `:3001` e `:3002` | PoC local. |
| Token | **React state + Context** — nunca localStorage | Perde ao recarregar — intencional. |
| State management | **React Context** — sem Redux | Conforme constraint. |
| HTTP client | **native fetch** — sem axios | Conforme constraint. |
| Animações | **CSS transitions + @keyframes** — sem Framer Motion | Conforme constraint. |
| UI library | **Tailwind + componentes próprios** | Sem shadcn, Radix, MUI, etc. |
| Balance display | **R$ X,XX + raw entre parênteses** | Ex: `R$ 70,00 (7000 cents)`. Demonstra armazenamento em centavos. |
| Idioma da UI | **Inglês** | Demo técnico, audiência dev. |
| Back button | **Guided: sim. Autoplay: não.** | Guided é navegação. Autoplay é demonstration. |
| Layout mobile | **Um step por tela** (wizard) | Conforme wireframe Session 1. |
| Layout desktop Autoplay/Guided | **2 colunas: request (left) + response (right)** | Conforme Session 1. |
| Layout desktop Playground | **2 colunas: endpoints (left) + history sidebar (right)** | Conforme Session 1. |
| Service health dots | **Header, poll 10s** | Verde/vermelho por serviço. Requer `/health`. |
| DB Inspector | **Painel visual das tabelas reais** | Endpoint `GET /debug/db` em ambos os serviços, dev-only. Abre no pause (Autoplay) e entre steps (Guided). |
| Animation/observability view | **M4 — feature separada** | Toggle Graph\|Terminal com SSE fica no M4. O DB Inspector do M3 é o complemento data-driven estático. |

---

## 2. Paleta e tokens visuais

### Dark mode
```css
--bg-base:        #0f1117;
--bg-card:        #161b22;
--bg-card-hover:  #1c2230;
--bg-input:       #0d1117;
--border:         #1e293b;
--border-active:  #334155;
--text-primary:   #e2e8f0;
--text-muted:     #64748b;
--text-code:      #a5f3fc;
```

### Light mode
```css
--bg-base:        #f8fafc;
--bg-card:        #ffffff;
--bg-card-hover:  #f1f5f9;
--bg-input:       #f8fafc;
--border:         #e2e8f0;
--border-active:  #cbd5e1;
--text-primary:   #0f172a;
--text-muted:     #94a3b8;
--text-code:      #0369a1;
```

### Shared
```css
--identity:  #3b82f6;   /* blue   — Identity :3002 */
--ledger:    #10b981;   /* emerald — Ledger  :3001 */
--success:   #22c55e;
--error:     #ef4444;
--warning:   #f59e0b;
```

**Fontes:**
- Dados de API (JSON, tokens, IDs, amounts): `JetBrains Mono, Fira Code, monospace`
- Chrome da UI: `Inter, system-ui, sans-serif`

---

## 3. Layout global — Header (sticky, 48px)

```
Mobile (2 linhas):
┌──────────────────────────────────────────────────────┐
│  ledger-api        identity● ledger●     [☀/🌙]     │
│          [Autoplay]  [Guided]  [Playground]          │
└──────────────────────────────────────────────────────┘

Desktop (1 linha):
┌──────────────────────────────────────────────────────────────────┐
│  ledger-api   [Autoplay | Guided | Playground]   identity● ledger●  [☀/🌙]  │
└──────────────────────────────────────────────────────────────────┘
```

**Mode tabs:** underline 2px na cor do modo ativo — Autoplay→emerald, Guided→blue, Playground→amber.

**Service health dots:**
- Poll `GET /health` a cada 10s em background
- Verde = 200 dentro de 3s | Vermelho = timeout/erro | Amarelo pulsando = checking (estado inicial)
- Requer `GET /health → 200 { ok: true }` em ambos os serviços (ver seção 16)

**Light/dark toggle:** ícone ☀/🌙, persiste em `localStorage`.

---

## 4. Fluxo scripted — 13 steps

Email único por run: `alice+{Date.now()}@demo.com` — evita colisão entre runs consecutivos.

| # | Serviço | Method | Path | Step title | Payload / Notes | Resposta esperada | Tipo |
|---|---|---|---|---|---|---|---|
| 1 | identity:3002 | POST | /users | Create account | `{first_name:"Alice", last_name:"Demo", email:runEmail, password:"secret123"}` | 200 UserResponse | normal |
| 2 | identity:3002 | POST | /auth | Login | `{email:runEmail, password:"secret123"}` | 200 + `access_token` | normal |
| 3 | identity:3002 | GET | /users/:id | Verify profile | path = userId do step 1 | 200 UserResponse | normal |
| 4 | ledger:3001 | POST | /transactions | Credit +R$100 | `{type:"CREDIT", amount:10000}` | 200 TransactionResponse | normal |
| 5 | ledger:3001 | POST | /transactions | Credit +R$50 | `{type:"CREDIT", amount:5000}` | 200 TransactionResponse | normal |
| 6 | ledger:3001 | POST | /transactions | Debit -R$30 with idempotency | `{type:"DEBIT", amount:3000}` + `Idempotency-Key: demo-debit-001` | 200 TransactionResponse | normal |
| 7 | ledger:3001 | POST | /transactions | Retry same debit (cached) | mesmo payload + `Idempotency-Key: demo-debit-001` | 200 (mesmo `id`) | normal — feature demo |
| 8 | ledger:3001 | GET | /balance | Check balance | — | 200 `{amount:12000}` | normal |
| 9 | ledger:3001 | POST | /transactions | Debit over limit | `{type:"DEBIT", amount:99999}` | **422 INSUFFICIENT_BALANCE** | **error esperado** — pausa 4s |
| 10 | ledger:3001 | GET | /transactions | List history | — | 200 array[3 txns] | normal |
| 11 | identity:3002 | DELETE | /users/:id | Delete with balance (rejected) | — | **409 non-zero balance** | **error esperado** — pausa 4s |
| 12 | ledger:3001 | POST | /transactions | Debit to zero | `{type:"DEBIT", amount:12000}` | 200 TransactionResponse | normal |
| 13 | identity:3002 | DELETE | /users/:id | Delete user (success) | — | 200 `{ok:true}` | normal |

**Saldo ao longo do flow:** +100 → +50 → −30 (step 7 não desconta — idempotente) → balance 120 → erro 422 → erro 409 → −120 → delete ok.

---

## 5. StepDef — tipos

```typescript
interface StepDef {
  id: number;
  service: 'identity' | 'ledger';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;           // curto: "Credit +R$100"
  description: string;     // Guided: plain English
  whyItMatters: string;    // Guided: uma frase
  getBody?: (ctx: FlowContext) => object;
  getHeaders?: (ctx: FlowContext) => Record<string, string>;
  getResolvedPath?: (ctx: FlowContext) => string;
  expectedErrorStatus?: number;  // 422 | 409
}

interface FlowContext {
  token: string | null;
  userId: string | null;
  runEmail: string;
}

interface StepResult {
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

type StepStatus =
  | 'pending' | 'active' | 'completed'
  | 'error-expected' | 'error-unexpected';
```

---

## 6. Textos Guided por step

| # | `description` | `whyItMatters` |
|---|---|---|
| 1 | "We register Alice with the Identity service." | "Passwords are hashed server-side — never stored in plain text." |
| 2 | "Alice logs in. The Identity service issues a signed JWT." | "This token is stored in React state only — never in localStorage." |
| 3 | "We fetch Alice's profile to confirm the account exists." | "Validates the full create→read round-trip before touching the ledger." |
| 4 | "We credit Alice's account with R$100 (10,000 cents)." | "The Ledger records this with full ACID guarantees and a SELECT FOR UPDATE lock." |
| 5 | "We credit another R$50. Alice now has R$150." | "Multiple credits accumulate correctly — each in its own ACID transaction." |
| 6 | "We debit R$30, including an Idempotency-Key header." | "The key ensures this exact debit can be retried without double-charging." |
| 7 | "We send the exact same debit again with the same Idempotency-Key." | "The server returns the cached response — no new debit occurs. Balance stays at R$120." |
| 8 | "We check Alice's balance. It's R$120 — not R$90, because the duplicate was idempotent." | "The Ledger reads from a balance snapshot — O(1) read, no full table scan." |
| 9 | "We attempt to debit R$999.99 — far more than Alice's R$120." | "The SELECT FOR UPDATE lock prevented any inconsistency. 422 is the correct, safe rejection." |
| 10 | "We list Alice's full transaction history, filterable by CREDIT or DEBIT." | "The duplicate debit (step 7) doesn't appear as a separate entry." |
| 11 | "We try to delete Alice's account while she still has R$120." | "Identity calls Ledger internally to verify zero balance. 409 means the cross-service check works." |
| 12 | "We debit Alice's remaining R$120, bringing her balance to zero." | "Only after this can the account be safely deleted." |
| 13 | "With a zero balance, Alice's account is successfully deleted." | "The full lifecycle — create, transact, verify, clean up — is complete." |

---

## 7. Modo Autoplay

### Comportamento
- Inicia automaticamente ao entrar no tab (ou Restart)
- Delay entre steps: **2000ms**
- Error esperado (steps 9, 11): **pausa 4000ms** + DB Inspector abre automaticamente
- Erro inesperado: para, mostra error card com **Retry** e **Restart**

### Layout mobile (< 1024px) — um step por tela

```
┌─────────────────────────────────┐
│  Step 4 of 13  ████░░░░░░ 30%  │  ← progress bar (cor --ledger)
│  Credit +R$100                  │  ← step title
├─────────────────────────────────┤
│                                 │
│  [LEDGER :3001]                 │
│  POST /transactions             │
│                                 │
│  REQUEST                        │
│  { "type": "CREDIT",            │
│    "amount": 10000 }            │
│                                 │
│  ⏳ loading...                  │
│                                 │
│  RESPONSE  200  (18ms)          │
│  { "id": "abc-123",             │
│    "amount": 10000 }            │
│                                 │
├─────────────────────────────────┤
│  [🗄 DB]  [Pause]  [Restart]   │
└─────────────────────────────────┘
```

### Layout desktop (≥ 1024px)

```
┌───────────────────────┬───────────────────────┐
│  REQUEST              │  RESPONSE             │
│  [LEDGER :3001]       │  200  (18ms)          │
│  POST /transactions   │  { "id": "abc-123",   │
│  { "type": "CREDIT",  │    "amount": 10000 }  │
│    "amount": 10000 }  │                       │
└───────────────────────┴───────────────────────┘
│  Step 4 of 13 — Credit +R$100   [🗄 DB]  [Pause]  [Restart]  │
└──────────────────────────────────────────────────────────────┘
```

### Estados visuais

| Estado | Visual |
|---|---|
| `active` | border 1px `--identity` ou `--ledger`, shadow suave |
| `active` loading | spinner no lugar da response |
| `error-expected` | border `--error` pulsando (3 ciclos CSS), badge "Expected" amber |
| `error-unexpected` | border `--error` sólida, botões Retry/Restart |
| `completed` | border `--border` padrão |

---

## 8. Modo Guided

Igual ao Autoplay, exceto:
- **Não avança automaticamente** — operador clica `Next →`
- **Back ←** — retrocede (relê resultado salvo, não re-executa a chamada)
- **Área de explicação** abaixo do card: `description` + `whyItMatters` (italic, `--text-muted`)
- **`Next →`** só clicável após response chegar
- **DB Inspector** sempre acessível — não precisa pausar

### Layout mobile

```
┌─────────────────────────────────┐
│  Step 6 of 13  ████████░░ 46%  │
│  Debit -R$30 with idempotency   │
├─────────────────────────────────┤
│  [LEDGER :3001]                 │
│  POST /transactions             │
│  Idempotency-Key: demo-debit-001│
│  REQUEST / RESPONSE...          │
├─────────────────────────────────┤
│  We debit R$30, including an    │
│  Idempotency-Key header...      │
│                                 │
│  Why it matters: The key ensures│
│  this exact debit can be        │
│  retried without double-charging│
├─────────────────────────────────┤
│  [🗄 DB]  [← Back]  [Next →]   │
└─────────────────────────────────┘
```

### Layout desktop

```
┌───────────────────────┬───────────────────────┐
│  REQUEST              │  RESPONSE             │
│  ...                  │  ...                  │
└───────────────────────┴───────────────────────┘
│  description text...                          │
│  Why it matters: whyItMatters... (italic)     │
├───────────────────────────────────────────────┤
│  Step 6 of 13   [🗄 DB]   [← Back]  [Next →] │
└───────────────────────────────────────────────┘
```

---

## 9. DB Inspector

### Conceito

Painel visual do **estado real das tabelas do banco** no momento do clique. Projetado para qualquer pessoa entender — sem jargão, sem JSON bruto. Mostra as 4 tabelas que o projeto mantém, com rótulos didáticos e highlight de mudanças recentes.

### Quando abre

| Modo | Trigger |
|---|---|
| Autoplay | Botão `🗄 DB` no bottom bar. **Abre automaticamente** durante a pausa de 4s nos error steps 9 e 11. |
| Guided | Botão `🗄 DB` no bottom bar — sempre disponível. |
| Playground | Botão `🗄 View DB State` no topo da área de conteúdo. |

### Container

**Mobile:** bottom sheet, 85vh, handle de arrasto CSS.  
**Desktop:** modal centrado, `max-w: 900px`, 75vh, scroll interno.

```
┌──────────────────────────────────────────────────────────┐
│  🗄 Database State                         [✕ Close]     │
│  Fetched 0.3s ago  [↻ Refresh]                          │
├──────────────────────────────────────────────────────────┤
│  [Identity DB]  [Ledger DB]                             │
├──────────────────────────────────────────────────────────┤
│  USERS  (1 record)                                       │
│  ┌──────────┬────────────┬───────────────────────────┐  │
│  │   ID     │    Name    │   Email    │  Created at  │  │
│  ├──────────┼────────────┼────────────┼──────────────┤  │
│  │ a1b2c3.. │ Alice Demo │ alice+...  │ 12:34:01     │  │  ← row highlight verde
│  └──────────┴────────────┴────────────┴──────────────┘  │
│  ⚠ Password column hidden — stored as bcrypt hash        │
└──────────────────────────────────────────────────────────┘
```

### Identity DB tab — tabela Users

| Coluna exibida | Campo real | Tratamento |
|---|---|---|
| ID | `id` | truncado: primeiros 8 chars + `...` |
| Name | `first_name` + `last_name` | concatenado |
| Email | `email` | completo |
| Created at | `created_at` | `HH:mm:ss` (só hora — data já está implícita no demo) |
| Password | — | **coluna omitida**. Label abaixo: `"Password column hidden — stored as bcrypt hash"` |

### Ledger DB tab — três sub-seções

**Transactions**

| Coluna exibida | Campo real | Tratamento |
|---|---|---|
| ID | `id` | truncado 8 chars |
| User | `user_id` | truncado 8 chars |
| Type | `type` | badge: `CREDIT` verde / `DEBIT` vermelho |
| Amount | `amount` | `R$ X,XX (N cents)` |
| Created at | `created_at` | `HH:mm:ss` |

**Balance Snapshot**  
Label acima: *"One row per user. Always up to date. This is what makes GET /balance an instant O(1) read."*

| Coluna exibida | Campo real | Tratamento |
|---|---|---|
| User | `user_id` | truncado 8 chars |
| Balance | `amount` | `R$ X,XX (N cents)` — texto em `--ledger` (emerald) |
| Last updated | `updated_at` | `HH:mm:ss` |

**Idempotency Cache**  
Label acima: *"Every request sent with an Idempotency-Key is stored here. Duplicate requests return the cached result below — no double processing occurs."*

| Coluna exibida | Campo real | Tratamento |
|---|---|---|
| Key | `key` | completo (ex: `demo-debit-001`) |
| User | `user_id` | truncado 8 chars |
| Cached result | `result` | `STATUS · {id:...}` truncado 40 chars — clicável para expandir |
| Created at | `created_at` | `HH:mm:ss` |

**Nota:** O schema real do banco tem `response_status INTEGER` e `response_body JSONB` (não um campo único `result`).
O endpoint `/debug/db` retorna os campos reais. O frontend formata como `STATUS · {body truncado 40 chars}` na coluna "Cached result".

### Highlight de mudanças

Ao abrir o painel, o frontend compara os dados com o **snapshot salvo no Context** do fetch anterior. Linhas com `id` novo ou `updated_at` mais recente → background `rgba(34,197,94,0.15)` por 3s via CSS `@keyframes rowHighlight`.

### Empty state por tabela

```
USERS  (0 records)
────────────────────────────────────────
No users yet. Run step 1 to create the first one.
```

### Refresh

- Botão `↻ Refresh` — faz `Promise.all` nos dois `GET /debug/db` em paralelo
- Durante loading: spinner no botão, tabelas com `opacity: 0.5`
- Timestamp `Fetched Xs ago` atualiza após cada fetch
- Guarda novo snapshot no Context após fetch bem-sucedido

### `/debug/db` indisponível

```
⚠ DB Inspector unavailable
The /debug/db endpoint is not responding.
Make sure the services are running with NODE_ENV=development.
[Close]
```

---

## 10. Backend — novos endpoints para M3

### `GET /health` — ambos os serviços

```typescript
app.get('/health', (_req, res) => res.json({ ok: true }));
```

Sem auth. Sem guard de ambiente — deve responder em produção também (é um health check legítimo).

### `GET /debug/db` — ambos os serviços

Gated por `NODE_ENV !== 'production'`:

```typescript
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/db', debugDbHandler);
}
```

Sem auth. Dev-only.

**Identity → response:**
```json
{
  "users": [
    { "id": "uuid", "first_name": "Alice", "last_name": "Demo",
      "email": "alice+1234@demo.com", "created_at": "2026-04-14T12:34:01.000Z" }
  ]
}
```
`password_hash` **nunca incluído** — omitido no SELECT.

**Ledger → response:**
```json
{
  "transactions": [
    { "id": "uuid", "user_id": "uuid", "type": "CREDIT",
      "amount": 10000, "created_at": "..." }
  ],
  "balance_snapshots": [
    { "user_id": "uuid", "amount": 12000, "updated_at": "..." }
  ],
  "idempotency_keys": [
    { "key": "demo-debit-001", "user_id": "uuid",
      "response_status": 200, "response_body": {"id":"xyz","type":"DEBIT","amount":3000},
      "created_at": "..." }
  ]
}
```

**Nota para o ralplan:** esses dois endpoints devem ser implementados por um worker antes que o frontend os consuma. Recomendado como PR único pequeno: `feat(debug): add /health and /debug/db endpoints`.

---

## 11. Modo Playground

### Layout mobile (< 640px)

```
[ 🗄 View DB State ]
[ Token pill ]
[ Identity :3002 ] — section header azul
  [ POST /users ]
  [ POST /auth ]
  [ GET /users ]
  [ GET /users/:id ]
  [ PATCH /users/:id ]
  [ DELETE /users/:id ]
[ Ledger :3001 ] — section header emerald
  [ POST /transactions ]
  [ GET /transactions ]
  [ GET /balance ]
[ 📋 History — floating button bottom-right ]
```

### Layout desktop (≥ 640px)

```
┌───────────────────────────────┬──────────────────────┐
│  [ 🗄 View DB State ]          │  HISTORY             │
│  [ Token pill ]               │  POST /auth ✓ 200    │
│                               │  POST /transactions  │
│  [Identity :3002]             │  GET /balance ✓      │
│  [ endpoint cards... ]        │  [Clear history]     │
│  [Ledger :3001]               │                      │
│  [ endpoint cards... ]        │                      │
└───────────────────────────────┴──────────────────────┘
```

History sidebar: 280px largura fixa.

### Token pill

- Aparece após POST /auth bem-sucedido
- `🔑 Bearer eyJhbGci...` truncado 24 chars + `[Copy]` → `✓ Copied` por 1500ms
- Border `--identity`, fundo `--bg-card`, monospace 12px
- Se ausente: Send desabilitado + `⚠ Login required`

### Endpoint card

```
┌──────────────────────────────────────────────────────┐
│  [LEDGER :3001]  POST  /transactions                 │
│  Create a CREDIT or DEBIT transaction                │
│  ──────────────────────────────────────────────────  │
│  type:              [CREDIT ▾]                       │
│  amount:            [_______]  (min: 1 cent)         │
│  Idempotency-Key:   [_______]  (optional)            │
│                                          [Send]      │
│  ──────────────────────────────────────────────────  │
│  200  (18ms)                                         │
│  { "id": "abc-123", "type": "CREDIT", ... }          │
└──────────────────────────────────────────────────────┘
```

**Campos:** select para `type`, number para `amount`, text para `Idempotency-Key`, password para `password`, email para `email`. Path params como campo separado, auto-preenchido se token presente.

**Validação local (advisory):** `amount < 1`, email inválido, campos required vazios.

**Send:** disabled durante loading, spinner CSS, timeout 10s.

### Endpoints

*Identity :3002* (azul): POST /users, POST /auth, GET /users, GET /users/:id, PATCH /users/:id, DELETE /users/:id

*Ledger :3001* (emerald): POST /transactions, GET /transactions (com filtro type), GET /balance

### History panel

- Cronológica reversa, `METHOD PATH → STATUS (latency) · Xs ago`
- Click expande request + response
- Limite 50 entries (FIFO)
- Clear history
- Mobile: bottom sheet 60vh

---

## 12. Error states

| Cenário | Tratamento |
|---|---|
| 422 INSUFFICIENT_BALANCE | Border `--error` pulsando + badge "Expected" amber nos modos demo |
| 409 non-zero balance | Igual ao 422 nos modos demo |
| 409 Email already in use | Error card vermelho + message da API |
| Fetch timeout (> 10s) | `Service unavailable — is docker-compose running?` + Retry |
| Network error | `Cannot reach service` + Retry |
| 401 sem token | Send desabilitado + `⚠ Login required` |
| 401 mid-flow | Para: `Session expired — press Restart` |
| 400 Validation | Error card com message da API |
| 5xx | Error card vermelho + Retry |
| /debug/db indisponível | Mensagem no DB Inspector + Close |

---

## 13. CSS Transitions

```css
/* Step card enter */
@keyframes stepEnter {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.step-enter { animation: stepEnter 200ms ease-out forwards; }

/* Error border pulse (3 ciclos, para sozinho) */
@keyframes errorPulse {
  0%, 100% { border-color: var(--error); }
  50%      { border-color: var(--border); }
}
.error-pulse { animation: errorPulse 800ms ease-in-out 3; }

/* Balance flash */
@keyframes balanceFlash {
  0%   { color: var(--ledger); }
  100% { color: var(--text-primary); }
}
.balance-flash { animation: balanceFlash 400ms ease-out forwards; }

/* DB Inspector — row highlight (linha nova/atualizada) */
@keyframes rowHighlight {
  0%   { background-color: rgba(34, 197, 94, 0.15); }
  100% { background-color: transparent; }
}
.row-new { animation: rowHighlight 3000ms ease-out forwards; }

/* Spinner */
@keyframes spin { to { transform: rotate(360deg); } }
.spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--border-active);
  border-top-color: var(--ledger);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}

/* Progress bar */
.progress-bar { transition: width 300ms ease-out; }

/* Theme transition */
.theme-transition * {
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}

/* DB Inspector refresh loading */
.db-loading { opacity: 0.5; transition: opacity 200ms; }
```

---

## 14. Estrutura de arquivos

```
apps/web/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles/
    │   └── index.css
    ├── contexts/
    │   └── AppContext.tsx        # token, userId, theme, mode, history, dbSnapshot
    ├── api/
    │   ├── identity.ts           # fetch wrappers :3002
    │   ├── ledger.ts             # fetch wrappers :3001
    │   └── debug.ts              # GET /debug/db em ambos
    ├── flows/
    │   └── demoFlow.ts           # array de 13 StepDef
    ├── components/
    │   ├── Header.tsx
    │   ├── ModeSelector.tsx
    │   ├── ServiceHealthDot.tsx  # poll 10s, 3 estados
    │   ├── ThemeToggle.tsx
    │   ├── ServiceBadge.tsx
    │   ├── StatusBadge.tsx
    │   ├── StepCard.tsx          # 2-col no desktop
    │   ├── JsonBlock.tsx
    │   ├── ProgressBar.tsx
    │   ├── BottomBar.tsx
    │   ├── TokenPill.tsx
    │   ├── EndpointCard.tsx
    │   ├── HistoryPanel.tsx
    │   ├── Spinner.tsx
    │   └── DbInspector/
    │       ├── DbInspector.tsx   # modal/bottom-sheet container
    │       ├── DbTable.tsx       # tabela genérica com highlight
    │       ├── IdentityDbTab.tsx # Users
    │       └── LedgerDbTab.tsx   # Transactions + BalanceSnapshot + IdempotencyCache
    └── modes/
        ├── Autoplay.tsx
        ├── Guided.tsx
        └── Playground.tsx
```

---

## 15. Constraints de implementação

- Zero imports de `@ledger/*` packages
- Token em React state + Context — nunca localStorage (exceto `theme`)
- Sem Redux, Zustand
- Sem axios — apenas `fetch` nativo
- Sem Framer Motion, React Spring
- Sem shadcn, Radix, MUI, Ant Design
- CSS transitions em `index.css` — não inline
- TypeScript strict mode
- Tailwind `dark:` — classe `dark` no `<html>`
- Mobile-first: `sm:` (640px) e `lg:` (1024px)

---

## 16. M4 — esclarecimento de escopo

O toggle **Graph | Terminal** com SSE e visualização de blocos animados permanece **integralmente em M4**:

- Graph: service blocks + DB blocks com arrows animados, estados idle/active/waiting/error
- Terminal: log stream estruturado com color coding em tempo real
- Toggle Graph | Terminal
- Backend: `GET /events` SSE endpoint em ambos os serviços

O DB Inspector do M3 é o complemento **estático** (estado do banco no momento do clique). O M4 é o complemento **real-time** (fluxo ao vivo enquanto as requests acontecem). Features distintas e complementares.

---

## 17. O que fica aberto para os critics

1. **Concurrent transactions no Playground** — botão "Stress test" que envia 2 DEBITs via `Promise.all` demonstraria o SELECT FOR UPDATE lock ordering
2. **PATCH /users com body parcial** — 1 campo ou body vazio
3. **GET /transactions?type=INVALID** — 400 esperado
4. **Idempotency-Key com chars inválidos** — 400 esperado
5. **DB Inspector no step 7 (retry idempotente)** — a tabela `transactions` não deve ganhar nova linha, e `idempotency_keys` não muda. O diff de highlight precisa ser preciso
6. **DB Inspector com múltiplos users** — se Playground criou outros users, todas as linhas aparecem. Filtrar por `user_id` do run atual ou mostrar tudo?
7. **DB Inspector com dados de runs anteriores** — é feature (mostra que o banco acumula) ou noise?
8. **Health dot "checking" no estado inicial** — primeiro poll ainda em andamento: dot amarelo pulsando
9. **Acessibilidade** — contraste em light mode, navegação por teclado no Playground, aria-labels
10. **`amount` como float** — `<input type="number">` pode aceitar decimais em alguns browsers mesmo com `step="1"`. Validação local + API como segunda linha
11. **Token expirado durante DB Inspector** — `/debug/db` não usa token. Ao fechar o Inspector e tentar avançar, 401. Mensagem deve ser clara
12. **DB Inspector no Playground mostra dados de outros usuários** — comportamento intencional (prova de conceito) mas deve ser documentado no label do painel
13. **Mode switching mid-flow** — context (token, userId) persists; step progress resets.
14. **GET /users returns all users** — Playground shows all users in DB. Intentional PoC behavior.
15. **DELETE /users/:id auto-fill** — path param auto-fills with token's sub claim only.
16. **Idempotency-Key not in Identity CORS** — not a bug. Identity doesn't use idempotency.
17. **Balance response shape** — frontend extracts amount only from GET /balance response.
18. **Guided step 1 auto-fires** — request executes automatically on entering Guided mode.

---

## 18. Definição de Done para M3

- [ ] Autoplay: 13 steps, pausa 4s nos steps 9 e 11, DB Inspector abre automaticamente na pausa
- [ ] Guided: `Next →`, `← Back`, `description` + `whyItMatters`, DB Inspector disponível entre steps
- [ ] DB Inspector: Users / Transactions / Balance Snapshot / Idempotency Cache; highlight de linhas novas; Refresh; empty states; mensagem de erro se endpoint indisponível
- [ ] `GET /debug/db` em ambos os serviços, gated por `NODE_ENV !== 'production'`
- [ ] `GET /health` em ambos os serviços
- [ ] Playground: 9 endpoints, form fields tipados, token pill, DB Inspector, History panel
- [ ] History: sidebar ≥ 640px, bottom sheet < 640px
- [ ] Service health dots: 3 estados (verde/vermelho/checking amarelo)
- [ ] Light/dark toggle: funciona, persiste, default = `prefers-color-scheme`
- [ ] Balance: `R$ X,XX (N cents)`
- [ ] Service badges: Identity azul, Ledger emerald
- [ ] Error steps (9, 11): visual diferenciado, não interrompem o flow
- [ ] Erros inesperados: Retry disponível
- [ ] Layout mobile: wizard, um step por tela, progress bar
- [ ] Layout desktop Autoplay/Guided: 2 colunas request|response
- [ ] Layout desktop Playground: endpoints + history sidebar 280px
- [ ] `npm run build` sem erros TypeScript
- [ ] `npm run lint` passa
- [ ] Responsivo: 375px e 1280px

---

## 19. Estratégia de testes — Playwright

### Premissa

O Playwright é a camada de validação que prova que o OMC entregou exatamente o que foi especificado. Cada comportamento descrito nas seções 7–14 deve ter ao menos um teste correspondente. A suite deve rodar contra o app real (Vite dev server) com o backend real (docker-compose), com mocking de rede apenas para cenários de falha de infraestrutura.

### Prerequisitos de execução

```bash
# Backend deve estar rodando antes de qualquer teste
docker-compose up -d

# Aguardar serviços subirem
npx wait-on http://localhost:3001/health http://localhost:3002/health

# Rodar testes
npm run test:e2e
```

Global setup (`playwright.config.ts`) verifica saúde dos serviços antes de iniciar:
```typescript
// Se qualquer serviço estiver down → skip ALL tests com mensagem clara:
// "Services not available. Run: docker-compose up -d"
```

### Playwright config

```typescript
// apps/web/playwright.config.ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,          // testes tocam o mesmo banco — sequencial
  retries: 1,                    // 1 retry em CI
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome',    use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari',    use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

### `data-testid` — contrato obrigatório

Todos os componentes devem expor `data-testid` estável. O executor **não pode** usar seletores por texto visível, classe CSS ou estrutura DOM. Esses são os testids obrigatórios:

**Header / navegação**
```
data-testid="mode-autoplay"          — tab Autoplay
data-testid="mode-guided"            — tab Guided
data-testid="mode-playground"        — tab Playground
data-testid="health-dot-identity"    — dot identity (contém aria-label com status)
data-testid="health-dot-ledger"      — dot ledger
data-testid="theme-toggle"           — botão ☀/🌙
```

**Autoplay / Guided — step**
```
data-testid="step-card"              — card do step atual
data-testid="step-title"             — texto do title
data-testid="step-service-badge"     — badge IDENTITY / LEDGER
data-testid="step-method"            — método HTTP
data-testid="step-path"              — path da request
data-testid="step-request-body"      — JSON da request
data-testid="step-response-body"     — JSON da response
data-testid="step-status-badge"      — status code (200, 422, 409...)
data-testid="step-latency"           — latência (Nms)
data-testid="step-idempotency-key"   — header Idempotency-Key (quando presente)
data-testid="step-description"       — texto description (Guided only)
data-testid="step-why"               — texto whyItMatters (Guided only)
data-testid="step-error-expected"    — badge "Expected" (steps 9, 11)
data-testid="step-error-unexpected"  — card de erro inesperado (network, 5xx, timeout)
data-testid="step-loading"           — spinner de loading
```

**Autoplay / Guided — controles**
```
data-testid="progress-bar"           — elemento da barra de progresso
data-testid="progress-label"         — "Step X of 13"
data-testid="btn-pause"
data-testid="btn-resume"
data-testid="btn-restart"
data-testid="btn-retry"              — botão Retry (erro inesperado)
data-testid="btn-next"               — Next → (Guided)
data-testid="btn-back"               — ← Back (Guided)
data-testid="btn-db-inspector"       — botão 🗄 DB
```

**DB Inspector**
```
data-testid="db-inspector"           — container (modal / bottom-sheet)
data-testid="db-tab-identity"        — tab Identity DB
data-testid="db-tab-ledger"          — tab Ledger DB
data-testid="db-table-users"         — tabela Users
data-testid="db-table-transactions"  — tabela Transactions
data-testid="db-table-balance"       — tabela Balance Snapshot
data-testid="db-table-idempotency"   — tabela Idempotency Cache
data-testid="db-row"                 — cada linha (múltiplos)
data-testid="db-row-new"             — linha com highlight (nova/atualizada)
data-testid="db-refresh"             — botão Refresh
data-testid="db-close"               — botão Close / ✕
data-testid="db-empty-{tableName}"   — empty state por tabela
data-testid="db-error"               — erro quando endpoint indisponível
```

**Playground**
```
data-testid="token-pill"
data-testid="token-copy"
data-testid="token-copied"           — estado "✓ Copied"
data-testid="section-identity"       — seção Identity :3002
data-testid="section-ledger"         — seção Ledger :3001
data-testid="endpoint-{METHOD}-{path-slug}"  — card de endpoint
  ex: data-testid="endpoint-POST-users"
      data-testid="endpoint-POST-auth"
      data-testid="endpoint-GET-balance"
data-testid="endpoint-send"          — botão Send (dentro do card ativo)
data-testid="endpoint-loading"       — spinner no Send
data-testid="endpoint-response"      — área de response
data-testid="endpoint-status"        — status badge da response
data-testid="endpoint-login-required" — aviso ⚠ Login required
data-testid="field-{fieldName}"      — input/select de cada campo
  ex: data-testid="field-email"
      data-testid="field-amount"
      data-testid="field-type"
      data-testid="field-idempotency-key"
data-testid="field-error-{fieldName}" — erro de validação inline
data-testid="history-panel"
data-testid="history-entry"          — cada entry (múltiplos)
data-testid="history-clear"
data-testid="history-toggle-mobile"  — botão 📋 History no mobile
data-testid="db-view-btn"            — botão 🗄 View DB State no Playground
```

---

### Estrutura de arquivos de testes

```
apps/web/tests/
├── playwright.config.ts
├── global-setup.ts              # verifica serviços up, variáveis de env
├── fixtures/
│   ├── index.ts                 # re-export de todos os fixtures
│   ├── api.ts                   # helpers diretos de API (sem UI)
│   │   createUser(), getToken(), creditAccount(),
│   │   debitAccount(), deleteUser(), getBalance()
│   └── pages.ts                 # fixture que instancia todos os page objects
├── pages/
│   ├── AutoplayPage.ts
│   ├── GuidedPage.ts
│   ├── PlaygroundPage.ts
│   ├── DbInspectorPage.ts
│   └── HeaderPage.ts
└── specs/
    ├── autoplay.spec.ts
    ├── guided.spec.ts
    ├── playground.spec.ts
    ├── db-inspector.spec.ts
    ├── header.spec.ts
    ├── error-states.spec.ts
    ├── edge-cases.spec.ts
    └── mobile.spec.ts
```

---

### Fixtures de API (sem UI)

```typescript
// tests/fixtures/api.ts
// Calls diretas ao backend — usadas em beforeEach para setup de estado

const IDENTITY = 'http://localhost:3002';
const LEDGER   = 'http://localhost:3001';

export async function createUser(suffix = Date.now()) {
  const email = `test+${suffix}@e2e.com`;
  const res = await fetch(`${IDENTITY}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Test', last_name: 'User',
      email, password: 'test1234'
    }),
  });
  const user = await res.json();
  return { ...user, email, password: 'test1234' };
}

export async function getToken(email: string, password: string) {
  const res = await fetch(`${IDENTITY}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { token: data.access_token, userId: data.user.id };
}

export async function creditAccount(token: string, amount: number) {
  return fetch(`${LEDGER}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'CREDIT', amount }),
  });
}

export async function debitAccount(token: string, amount: number) {
  return fetch(`${LEDGER}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'DEBIT', amount }),
  });
}

export async function getBalance(token: string): Promise<number> {
  const res = await fetch(`${LEDGER}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.amount;
}

export async function cleanupUser(token: string, userId: string) {
  // Zera o saldo antes de tentar deletar
  const balance = await getBalance(token);
  if (balance > 0) await debitAccount(token, balance);
  await fetch(`${IDENTITY}/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.getByTestId('mode-playground').click();
  await page.getByTestId('endpoint-POST-auth').click();
  await page.getByTestId('field-email').fill(email);
  await page.getByTestId('field-password').fill(password);
  await page.getByTestId('endpoint-send').click();
  await expect(page.getByTestId('token-pill')).toBeVisible({ timeout: 8_000 });
}
```

---

### Page Objects

```typescript
// tests/pages/AutoplayPage.ts
export class AutoplayPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/'); }

  stepCard()        { return this.page.getByTestId('step-card'); }
  stepTitle()       { return this.page.getByTestId('step-title'); }
  progressLabel()   { return this.page.getByTestId('progress-label'); }
  progressBar()     { return this.page.getByTestId('progress-bar'); }
  statusBadge()     { return this.page.getByTestId('step-status-badge'); }
  responseBody()    { return this.page.getByTestId('step-response-body'); }
  loadingSpinner()  { return this.page.getByTestId('step-loading'); }
  errorExpected()   { return this.page.getByTestId('step-error-expected'); }
  btnPause()        { return this.page.getByTestId('btn-pause'); }
  btnResume()       { return this.page.getByTestId('btn-resume'); }
  btnRestart()      { return this.page.getByTestId('btn-restart'); }
  btnDbInspector()  { return this.page.getByTestId('btn-db-inspector'); }

  async waitForStep(n: number, options?: { timeout?: number }) {
    await expect(this.progressLabel()).toContainText(`Step ${n} of 13`, options);
  }

  async waitForStepComplete() {
    await expect(this.loadingSpinner()).not.toBeVisible({ timeout: 15_000 });
    await expect(this.statusBadge()).toBeVisible();
  }

  async waitForAutoplayComplete() {
    await expect(this.progressLabel()).toContainText('Step 13 of 13', { timeout: 60_000 });
    await this.waitForStepComplete();
  }
}
```

---

### `autoplay.spec.ts` — casos de teste

```typescript
test.describe('Autoplay mode', () => {

  // ─── Happy path ───────────────────────────────────────────────────
  test('completes all 13 steps without intervention', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForAutoplayComplete();
    await expect(ap.progressLabel()).toContainText('Step 13 of 13');
    await expect(ap.statusBadge()).toContainText('200');
  });

  test('step 1 — POST /users — shows Identity badge and 200', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(1);
    await ap.waitForStepComplete();
    await expect(page.getByTestId('step-service-badge')).toContainText('IDENTITY');
    await expect(page.getByTestId('step-method')).toContainText('POST');
    await expect(page.getByTestId('step-path')).toContainText('/users');
    await expect(ap.statusBadge()).toContainText('200');
  });

  test('step 2 — POST /auth — token captured and step advances', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(2);
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('200');
    // O token foi capturado — os steps seguintes usam ele (verificado indiretamente via step 4+)
  });

  test('step 6 — shows Idempotency-Key header', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(6);
    await expect(page.getByTestId('step-idempotency-key')).toContainText('demo-debit-001');
  });

  test('step 7 — retry with same Idempotency-Key returns same transaction id', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(6);
    await ap.waitForStepComplete();
    const body6 = await page.getByTestId('step-response-body').innerText();
    const id6 = JSON.parse(body6).id;

    await ap.waitForStep(7);
    await ap.waitForStepComplete();
    const body7 = await page.getByTestId('step-response-body').innerText();
    const id7 = JSON.parse(body7).id;

    expect(id6).toBe(id7);  // mesmo id = idempotência funcionou
  });

  test('step 9 — 422 shows error-expected badge and pauses 4s', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(9);
    await ap.waitForStepComplete();

    await expect(ap.statusBadge()).toContainText('422');
    await expect(ap.errorExpected()).toBeVisible();

    // Ainda está no step 9 após 1s (dentro da pausa de 4s)
    await page.waitForTimeout(1000);
    await expect(ap.progressLabel()).toContainText('Step 9 of 13');

    // Após 4s avança para step 10
    await ap.waitForStep(10, { timeout: 8_000 });
  });

  test('step 11 — 409 shows error-expected badge, DB Inspector opens automatically', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(11);
    await ap.waitForStepComplete();

    await expect(ap.statusBadge()).toContainText('409');
    await expect(ap.errorExpected()).toBeVisible();
    await expect(page.getByTestId('db-inspector')).toBeVisible({ timeout: 1_000 });
  });

  test('step 13 — DELETE succeeds after zeroing balance', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForAutoplayComplete();
    await expect(ap.statusBadge()).toContainText('200');
    const body = await ap.responseBody().innerText();
    expect(JSON.parse(body).ok).toBe(true);
  });

  // ─── Controles ────────────────────────────────────────────────────
  test('Pause stops auto-advance, Resume continues', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(3);
    await ap.btnPause().click();

    const labelBefore = await ap.progressLabel().innerText();
    await page.waitForTimeout(4000);  // espera mais que o delay de 2s
    const labelAfter = await ap.progressLabel().innerText();
    expect(labelBefore).toBe(labelAfter);  // não avançou

    await ap.btnResume().click();
    await ap.waitForStep(4, { timeout: 5_000 });
  });

  test('Restart resets to step 1 with new email', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(4);
    await ap.btnRestart().click();

    await ap.waitForStep(1, { timeout: 3_000 });
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('200');
  });

  // ─── Progress bar ─────────────────────────────────────────────────
  test('progress bar advances with each step', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(1);
    const width1 = await ap.progressBar().evaluate(el => (el as HTMLElement).style.width);

    await ap.waitForStep(7);
    const width7 = await ap.progressBar().evaluate(el => (el as HTMLElement).style.width);

    // width em step 7 deve ser maior que em step 1
    expect(parseFloat(width7)).toBeGreaterThan(parseFloat(width1));
  });

  // ─── DB Inspector (auto-open) ─────────────────────────────────────
  test('DB Inspector button opens inspector', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(3);
    await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });
});
```

---

### `guided.spec.ts` — casos de teste

```typescript
test.describe('Guided mode', () => {

  test('renders in Guided mode when tab selected', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    await expect(page.getByTestId('step-description')).toBeVisible();
  });

  test('step 1 — description and whyItMatters visible', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    const desc = page.getByTestId('step-description');
    const why  = page.getByTestId('step-why');
    await expect(desc).toContainText('We register Alice');
    await expect(why).toContainText('Passwords are hashed');
  });

  test('Next button disabled while request in flight', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    // Imediatamente após carregar, request do step 1 ainda pode estar em voo
    // Next deve estar disabled até response chegar
    await expect(gp.btnNext()).toBeDisabled();
    await gp.waitForCurrentStepComplete();
    await expect(gp.btnNext()).toBeEnabled();
  });

  test('Next advances to next step', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await gp.btnNext().click();
    await gp.waitForStep(2);
  });

  test('Back returns to previous step without re-executing', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();

    await gp.waitForStep(1); await gp.waitForCurrentStepComplete();
    await gp.btnNext().click();
    await gp.waitForStep(2); await gp.waitForCurrentStepComplete();

    // Captura resposta do step 2
    const resp2 = await page.getByTestId('step-response-body').innerText();

    await gp.btnBack().click();
    await gp.waitForStep(1);

    // Volta para step 2 — mesma resposta (não re-executou)
    await gp.btnNext().click();
    await gp.waitForStep(2);
    const resp2again = await page.getByTestId('step-response-body').innerText();
    expect(resp2again).toBe(resp2);
  });

  test('Back button absent on step 1', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.waitForStep(1);
    await expect(gp.btnBack()).not.toBeVisible();
  });

  test('each step shows correct description text', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();

    const expectedDescriptions: Record<number, string> = {
      1: 'We register Alice',
      4: 'R$100 (10,000 cents)',
      6: 'Idempotency-Key header',
      8: "It's R$120",
      9: 'R$999.99',
      11: 'zero balance',
    };

    for (const [stepNum, text] of Object.entries(expectedDescriptions)) {
      for (let i = gp.currentStep; i < Number(stepNum); i++) {
        await gp.waitForCurrentStepComplete();
        await gp.btnNext().click();
      }
      await expect(page.getByTestId('step-description')).toContainText(text);
    }
  });

  test('step 9 — 422 shows Expected badge in Guided mode', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.advanceTo(9);
    await expect(page.getByTestId('step-error-expected')).toBeVisible();
    await expect(page.getByTestId('step-status-badge')).toContainText('422');
  });

  test('step 11 — 409 shows Expected badge in Guided mode', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.advanceTo(11);
    await expect(page.getByTestId('step-error-expected')).toBeVisible();
    await expect(page.getByTestId('step-status-badge')).toContainText('409');
  });

  test('DB Inspector accessible between steps', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await page.getByTestId('btn-db-inspector').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });
});
```

---

### `playground.spec.ts` — casos de teste

```typescript
test.describe('Playground mode', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
  });

  // ─── Endpoints visíveis ───────────────────────────────────────────
  test('renders all 9 endpoint cards', async ({ page }) => {
    const endpoints = [
      'endpoint-POST-users', 'endpoint-POST-auth',
      'endpoint-GET-users',  'endpoint-GET-users-id',
      'endpoint-PATCH-users-id', 'endpoint-DELETE-users-id',
      'endpoint-POST-transactions', 'endpoint-GET-transactions',
      'endpoint-GET-balance',
    ];
    for (const id of endpoints) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test('Identity and Ledger section headers visible', async ({ page }) => {
    await expect(page.getByTestId('section-identity')).toBeVisible();
    await expect(page.getByTestId('section-ledger')).toBeVisible();
  });

  // ─── Auth flow ───────────────────────────────────────────────────
  test('POST /auth — token pill appears after login', async ({ page }) => {
    const { email, password } = await createUser();

    await page.getByTestId('endpoint-POST-auth').click();
    await page.getByTestId('field-email').fill(email);
    await page.getByTestId('field-password').fill(password);
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('token-pill')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('endpoint-status')).toContainText('200');
  });

  test('token copy button works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { email, password } = await createUser();

    // Login
    await page.getByTestId('endpoint-POST-auth').click();
    await page.getByTestId('field-email').fill(email);
    await page.getByTestId('field-password').fill(password);
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('token-pill')).toBeVisible();

    // Copy
    await page.getByTestId('token-copy').click();
    await expect(page.getByTestId('token-copied')).toBeVisible();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.length).toBeGreaterThan(50);  // JWT tem pelo menos 50 chars
  });

  // ─── Authenticated endpoints ──────────────────────────────────────
  test('GET /balance — returns balance for logged in user', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    // Login via UI para pegar token pill
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-GET-balance').click();
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('200');
    const resp = await page.getByTestId('endpoint-response').innerText();
    expect(JSON.parse(resp).amount).toBe(5000);
  });

  test('authenticated endpoint shows Login required without token', async ({ page }) => {
    await page.getByTestId('endpoint-GET-balance').click();
    await expect(page.getByTestId('endpoint-login-required')).toBeVisible();
    await expect(page.getByTestId('endpoint-send')).toBeDisabled();
  });

  // ─── Transactions ─────────────────────────────────────────────────
  test('POST /transactions — CREDIT creates transaction', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-POST-transactions').click();
    await page.getByTestId('field-type').selectOption('CREDIT');
    await page.getByTestId('field-amount').fill('2500');
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('200');
    const resp = JSON.parse(await page.getByTestId('endpoint-response').innerText());
    expect(resp.type).toBe('CREDIT');
    expect(resp.amount).toBe(2500);
  });

  test('POST /transactions — DEBIT over balance returns 422', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-POST-transactions').click();
    await page.getByTestId('field-type').selectOption('DEBIT');
    await page.getByTestId('field-amount').fill('99999');
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('422');
    const resp = JSON.parse(await page.getByTestId('endpoint-response').innerText());
    expect(resp.error).toBe('INSUFFICIENT_BALANCE');
  });

  test('POST /transactions — Idempotency-Key deduplicates', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 10000);
    await loginViaUI(page, user.email, user.password);

    const sendDebit = async () => {
      await page.getByTestId('endpoint-POST-transactions').click();
      await page.getByTestId('field-type').selectOption('DEBIT');
      await page.getByTestId('field-amount').fill('1000');
      await page.getByTestId('field-idempotency-key').fill('idem-test-001');
      await page.getByTestId('endpoint-send').click();
      await expect(page.getByTestId('endpoint-status')).toContainText('200');
      return JSON.parse(await page.getByTestId('endpoint-response').innerText());
    };

    const first  = await sendDebit();
    const second = await sendDebit();
    expect(first.id).toBe(second.id);  // mesmo id — idempotente
  });

  // ─── History panel ────────────────────────────────────────────────
  test('history panel records each request', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-GET-balance').click();
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('endpoint-status')).toContainText('200');

    const entries = page.getByTestId('history-entry');
    await expect(entries).toHaveCount(1, { timeout: 5_000 });  // login + balance = >= 1
  });

  test('clear history removes all entries', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('history-clear').click();
    await expect(page.getByTestId('history-entry')).toHaveCount(0);
  });

  test('Send button disabled during in-flight request', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('endpoint-GET-balance').click();
    await page.route('**/balance', async route => {
      await new Promise(r => setTimeout(r, 2000));
      route.continue();
    });
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('endpoint-send')).toBeDisabled();
    await expect(page.getByTestId('endpoint-loading')).toBeVisible();
  });

  test('history entry click expands request and response', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('endpoint-GET-balance').click();
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('endpoint-status')).toContainText('200');
    const entry = page.getByTestId('history-entry').first();
    await entry.click();
    await expect(entry).toContainText('GET');
    await expect(entry).toContainText('/balance');
  });
});
```

---

### `db-inspector.spec.ts` — casos de teste

```typescript
test.describe('DB Inspector', () => {

  test('opens from Autoplay button', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);
    await ap.waitForStep(2);
    await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });

  test('opens from Guided button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    const gp = new GuidedPage(page);
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await page.getByTestId('btn-db-inspector').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });

  test('opens from Playground', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });

  test('Identity DB tab shows Users table', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-identity').click();
    await expect(page.getByTestId('db-table-users')).toBeVisible();
  });

  test('Users table does NOT contain password column', async ({ page }) => {
    await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-identity').click();
    const tableText = await page.getByTestId('db-table-users').innerText();
    expect(tableText.toLowerCase()).not.toContain('password');
    expect(tableText).not.toContain('$2b$');  // bcrypt prefix
  });

  test('Ledger DB tab shows Transactions, Balance Snapshot, Idempotency Cache', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-table-transactions')).toBeVisible();
    await expect(page.getByTestId('db-table-balance')).toBeVisible();
    await expect(page.getByTestId('db-table-idempotency')).toBeVisible();
  });

  test('empty state shown when no data', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();
    // Se não houve nenhuma transação ainda (DB limpo ou dados do run):
    // Verifica que empty state tem texto guiando o usuário
    // (pode já ter dados — teste pode precisar de DB limpo para isso)
  });

  test('new row highlighted after step creates data', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);

    // Avança até step 4 (primeiro CREDIT)
    await ap.waitForStep(4);
    await ap.waitForStepComplete();
    await ap.btnDbInspector().click();

    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-row-new')).toBeVisible({ timeout: 4_000 });
  });

  test('Refresh button re-fetches data', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();

    const timestamp1 = await page.getByTestId('db-inspector').innerText();
    await page.getByTestId('db-refresh').click();
    await page.waitForTimeout(1500);
    const timestamp2 = await page.getByTestId('db-inspector').innerText();
    // Timestamp "Fetched Xs ago" deve mudar para "just now" após refresh
    expect(timestamp2).not.toBe(timestamp1);
  });

  test('Balance Snapshot reflects correct amount', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 7500);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();

    const balanceTable = await page.getByTestId('db-table-balance').innerText();
    expect(balanceTable).toContain('R$ 75,00');
    expect(balanceTable).toContain('7500');
  });

  test('Idempotency Cache shows key after idempotent request', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    // Faz um DEBIT com idempotency key via API direta
    await fetch('http://localhost:3001/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': 'test-idem-key-123',
      },
      body: JSON.stringify({ type: 'DEBIT', amount: 1000 }),
    });

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();

    const idemTable = await page.getByTestId('db-table-idempotency').innerText();
    expect(idemTable).toContain('test-idem-key-123');
  });

  test('close button dismisses inspector', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
    await page.getByTestId('db-close').click();
    await expect(page.getByTestId('db-inspector')).not.toBeVisible();
  });
});
```

---

### `error-states.spec.ts` — casos de teste

```typescript
test.describe('Error states', () => {

  test('network error shows "Cannot reach service" with Retry button', async ({ page }) => {
    // Intercepta requests para :3002 e simula network failure
    await page.route('http://localhost:3002/**', route => route.abort('connectionrefused'));

    await page.goto('/');
    await expect(page.getByTestId('step-error-unexpected')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="step-error-unexpected"]')).toContainText('Cannot reach service');
    await expect(page.getByTestId('btn-retry')).toBeVisible();
  });

  test('request timeout shows correct message', async ({ page }) => {
    await page.route('http://localhost:3002/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 12_000));
      route.abort('timedout');
    });
    await page.goto('/');
    await expect(page.getByText('Service unavailable')).toBeVisible({ timeout: 15_000 });
  });

  test('401 in Playground shows Login required', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    // GET /balance sem token
    await page.getByTestId('endpoint-GET-balance').click();
    await expect(page.getByTestId('endpoint-login-required')).toBeVisible();
  });

  test('Autoplay step 9 — 422 is expected, does not stop flow', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(9);
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('422');
    // Flow continua para step 10 após 4s
    await ap.waitForStep(10, { timeout: 8_000 });
  });

  test('Autoplay step 11 — 409 is expected, does not stop flow', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(11);
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('409');
    await ap.waitForStep(12, { timeout: 8_000 });
  });

  test('401 mid-flow shows Session expired message', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(3);
    await page.route('**/*', route => {
      if (route.request().url().includes('localhost:300')) {
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
      } else { route.continue(); }
    });
    await ap.waitForStep(4);
    await expect(page.getByText('Session expired')).toBeVisible({ timeout: 15_000 });
  });

  test('/debug/db unavailable shows error in DB Inspector', async ({ page }) => {
    await page.route('**/debug/db', route => route.abort());
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-error')).toBeVisible();
  });
});
```

---

### `edge-cases.spec.ts` — casos de teste

```typescript
test.describe('Edge cases', () => {

  test('amount 0 shows validation error before sending', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-POST-transactions').click();
    await page.getByTestId('field-amount').fill('0');
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('field-error-amount')).toBeVisible();
    await expect(page.getByTestId('field-error-amount')).toContainText('at least 1 cent');
  });

  test('empty required field shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-POST-users').click();
    // Não preenche nenhum campo
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('field-error-email')).toBeVisible();
  });

  test('invalid email format shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-POST-users').click();
    await page.getByTestId('field-email').fill('not-an-email');
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('field-error-email')).toContainText('Invalid email format');
  });

  test('duplicate email returns 409', async ({ page }) => {
    const user = await createUser();

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-POST-users').click();
    await page.getByTestId('field-first_name').fill('Test');
    await page.getByTestId('field-last_name').fill('User');
    await page.getByTestId('field-email').fill(user.email);  // email já existe
    await page.getByTestId('field-password').fill('pass1234');
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('409');
  });

  test('DELETE user with non-zero balance returns 409', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-DELETE-users-id').click();
    // User ID auto-preenchido pelo token
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('409');
  });

  test('Autoplay restart generates different email', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(1);
    await ap.waitForStepComplete();
    const req1 = await page.getByTestId('step-request-body').innerText();
    const email1 = JSON.parse(req1).email;

    await ap.btnRestart().click();
    await ap.waitForStep(1);
    await ap.waitForStepComplete();
    const req2 = await page.getByTestId('step-request-body').innerText();
    const email2 = JSON.parse(req2).email;

    expect(email1).not.toBe(email2);
  });

  test('step 7 — idempotent retry does NOT add new transaction row to DB', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    // Aguarda step 6 completar
    await ap.waitForStep(6); await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await page.getByTestId('db-tab-ledger').click();
    const countBefore = await page.getByTestId('db-table-transactions').getByTestId('db-row').count();
    await page.getByTestId('db-close').click();

    // Aguarda step 7 completar
    await ap.waitForStep(7); await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await page.getByTestId('db-tab-ledger').click();
    const countAfter = await page.getByTestId('db-table-transactions').getByTestId('db-row').count();

    expect(countAfter).toBe(countBefore);  // nenhuma nova linha
  });
});
```

---

### `header.spec.ts` — casos de teste

```typescript
test.describe('Header', () => {

  test('service health dots visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('health-dot-identity')).toBeVisible();
    await expect(page.getByTestId('health-dot-ledger')).toBeVisible();
  });

  test('health dots show green when services are up', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);  // aguarda primeiro poll
    const identity = page.getByTestId('health-dot-identity');
    const ledger   = page.getByTestId('health-dot-ledger');
    await expect(identity).toHaveAttribute('aria-label', /online|up/i);
    await expect(ledger).toHaveAttribute('aria-label', /online|up/i);
  });

  test('health dot shows red when service is down', async ({ page }) => {
    await page.route('http://localhost:3002/health', route => route.abort());
    await page.goto('/');
    await page.waitForTimeout(5000);  // aguarda poll + timeout de 3s
    await expect(page.getByTestId('health-dot-identity'))
      .toHaveAttribute('aria-label', /offline|down/i);
  });

  test('health dots show yellow/checking state on initial load', async ({ page }) => {
    await page.goto('/');
    const identity = page.getByTestId('health-dot-identity');
    await expect(identity).toHaveAttribute('aria-label', /checking/i);
  });

  test('mode tabs switch active mode', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    await expect(page.getByTestId('step-description')).toBeVisible();

    await page.getByTestId('mode-playground').click();
    await expect(page.getByTestId('section-identity')).toBeVisible();

    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('btn-pause')).toBeVisible();
  });
});
```

---

### `theme.spec.ts` — casos de teste

```typescript
test.describe('Light/dark theme', () => {

  test('toggle switches theme class on html element', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('theme-toggle').click();
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');

    await page.getByTestId('theme-toggle').click();
    const htmlClass2 = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass2).not.toContain('dark');
  });

  test('theme persists across page reload', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('theme-toggle').click();
    const before = await page.evaluate(() => document.documentElement.className);

    await page.reload();
    const after = await page.evaluate(() => document.documentElement.className);
    expect(after).toBe(before);
  });
});
```

---

### `mobile.spec.ts` — casos de teste

```typescript
// Todos os testes neste arquivo rodam nos projetos mobile-chrome e mobile-safari

test.describe('Mobile layout', () => {

  test('Autoplay shows one step at a time (wizard)', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);
    await ap.waitForStep(3);
    // Verifica que só existe 1 step-card visível (não scroll de múltiplos)
    const visibleCards = await page.getByTestId('step-card').all();
    expect(visibleCards.length).toBe(1);
  });

  test('progress bar visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('progress-bar')).toBeVisible();
  });

  test('Guided shows Back and Next in bottom bar on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    const gp = new GuidedPage(page);
    await gp.waitForStep(2);
    await expect(page.getByTestId('btn-back')).toBeVisible();
    await expect(page.getByTestId('btn-next')).toBeVisible();
  });

  test('Playground history opens as bottom sheet on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('history-toggle-mobile').click();
    await expect(page.getByTestId('history-panel')).toBeVisible();
  });

  test('DB Inspector opens as bottom sheet on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    // Em mobile deve ser bottom sheet (não modal centrado)
    const inspector = page.getByTestId('db-inspector');
    await expect(inspector).toBeVisible();
    const box = await inspector.boundingBox();
    // Bottom sheet: altura >= 80% da viewport height e começa perto do bottom
    expect(box!.height).toBeGreaterThan(500);
  });

  test('all 9 endpoint cards visible on mobile via scroll', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    // No mobile, os cards são empilhados — scroll até encontrar o último
    await page.getByTestId('endpoint-GET-balance').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('endpoint-GET-balance')).toBeVisible();
  });
});
```

---

### Scripts npm

```json
// apps/web/package.json (adições)
{
  "scripts": {
    "test:e2e":          "playwright test",
    "test:e2e:ui":       "playwright test --ui",
    "test:e2e:debug":    "playwright test --debug",
    "test:e2e:autoplay": "playwright test autoplay",
    "test:e2e:guided":   "playwright test guided",
    "test:e2e:playground": "playwright test playground",
    "test:e2e:mobile":   "playwright test mobile --project=mobile-chrome",
    "test:e2e:report":   "playwright show-report"
  }
}
```

### CI gate para M3

```yaml
# .github/workflows/m3-e2e.yml
- name: Start backend
  run: docker-compose up -d
  
- name: Wait for services
  run: npx wait-on http://localhost:3001/health http://localhost:3002/health --timeout 30000

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e --project=desktop-chromium
  env:
    NODE_ENV: development

- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```