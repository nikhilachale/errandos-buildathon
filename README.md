# ErrandOS — Buildathon Edition

ErrandOS turns a natural-language errand request into a reviewable, transaction-safe action.

It is designed as the execution layer beneath Hermes:

- Hermes understands the request and decides which typed tool to call.
- ErrandOS reads provider state, prepares exact terms, enforces approval and idempotency, and records the outcome.
- Provider integrations remain behind narrow adapters so chat never receives raw device controls, credentials, or session state.

## Buildathon goal

Build one convincing vertical slice for everyday errands in India:

```text
voice or text request
  → Hermes intent and orchestration
  → typed ErrandOS tools
  → Blinkit product search and cart preparation
  → exact terms for review
  → explicit approval boundary
  → receipt or reconciliation status
```

The first demo is intentionally narrower than the long-term product. It prioritizes a reliable Blinkit grocery flow over fragile multi-provider automation.

## Transaction guarantees

- Preparation never silently places an order.
- Exact items, quantities, prices, fees, address label, payment mode, ETA, and expiry are bound to an immutable proposal.
- Material changes produce a new proposal.
- Every final action requires an idempotency key.
- A final provider action is attempted at most once.
- An uncertain outcome becomes `ambiguous` and is reconciled with read-only checks.
- Success is shown only when a receipt or provider reference is verified.

## Initial scope

### MVP

- Text-first request interface, with voice as a progressive enhancement.
- Product search through a typed provider adapter.
- Cart proposal preparation with exact terms.
- Human-readable proposal review.
- Explicit approval boundary with commits disabled by default.
- Durable receipt and status model.
- A deterministic demo provider for repeatable judging.

### Stretch

- Supervised Blinkit login.
- Prepare-only interaction with the official Blinkit Android app.
- Sarvam-powered multilingual voice input/output.
- One low-value COD canary with explicit owner authorization.

### Not in the first slice

- Multi-provider checkout.
- Automatic ride booking.
- Full subscription or team account systems.
- Any claim of a successful external action without verified evidence.

## Repository status

This buildathon implementation starts with product scope and architecture on 26 July 2026. Implementation work and verification evidence will be added as dated, focused commits.

See [the build log](docs/BUILD_LOG.md) for the chronological record.
