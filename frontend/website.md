# Errands Website — Codex CLI Build Brief

Use this document as the implementation prompt inside the existing ErrandOS
codebase. Read the repository before editing anything. Treat the codebase as the
source of truth when this brief and the implementation differ.

## Role

Act as a senior product designer and frontend engineer. Redesign and rebuild the
existing standalone landing page as the public launch site for **Errands**.

The result should feel editorial, credible, calm, and intentionally art-directed.
It must not look like a generic AI-generated SaaS landing page.

## Product naming

- The public product name is **Errands**.
- Remove the legacy public brand everywhere in the new page, metadata, assets,
  copy, accessibility labels, installation examples, and website documentation.
- Keep internal package names such as `@errandos/contracts` unchanged unless the
  repository already contains an approved migration plan.
- Use **ErrandOS** only when discussing the internal execution architecture. Use
  **Errands** in all customer-facing website language.

Before finishing, search the changed website files for stale public branding and
remove it.

## Product truth

Errands is intended to be a transaction-safe execution layer for real-world
errands in India. A conversational agent interprets what the user wants, while
Errands owns:

- exact provider terms;
- proposal preparation;
- the approval boundary;
- idempotency;
- execution state;
- ambiguous-outcome handling;
- reconciliation;
- verified receipts and final outcomes.

The current buildathon MVP is deliberately narrow:

1. prepare a grocery order;
2. show the exact order for review;
3. obtain explicit approval;
4. attempt the provider action at most once;
5. return a verified receipt or an ambiguous state that requires
   reconciliation.

Do not present planned architecture as implemented functionality. Inspect the
repository and clearly separate:

- implemented and testable behavior;
- designed or planned behavior;
- illustrative website interactions.

The existing contracts package is a typed foundation, not proof of a completed
end-to-end transaction system.

## Primary audience

Design for:

- buildathon judges;
- developers evaluating the architecture;
- potential partners and operators;
- people who want a simpler way to complete everyday errands;
- family members or caregivers helping less technical users.

The page should be understandable without prior knowledge of MCP, Hermes,
idempotency, or reconciliation. Technical details may appear later in the page
for readers who want them.

## Core message

Suggested positioning:

> Say what needs doing. Review the exact terms. Approve once. Errands handles the
> rest safely.

Keep the tone plain, confident, and specific. Avoid inflated claims such as
“revolutionary,” “magical,” “superhuman,” “effortless,” or “the future of AI.”

## Visual direction

Create an editorial product launch story inspired by a premium magazine spread:

- nearly monochrome white and warm-paper surfaces;
- oversized regular-weight serif display type;
- quiet sans-serif body and interface type;
- generous whitespace;
- flat, soft-edged cards;
- hairline borders;
- pill-shaped actions;
- one carefully rationed peach accent;
- product evidence presented as floating or cropped artifacts;
- subtle motion with clear purpose.

The design should feel authored rather than generated.

### Color tokens

```css
:root {
  --color-ink: #17191c;
  --color-paper: #ffffff;
  --color-mist: #f2f2f3;
  --color-fog: #fafafb;
  --color-muted: #777b86;
  --color-tertiary: #979799;
  --color-placeholder: #a3a6af;
  --color-peach: #fbe1d1;
  --color-sienna: #5d2a1a;
  --color-border: #ececec;
}
```

Color must be restrained:

- approximately 95% of the page should remain white, fog, mist, ink, or gray;
- use the peach editorial surface once on the page;
- use sienna only within the peach surface or for a restrained data stroke;
- do not introduce purple, neon gradients, electric blue, or decorative rainbow
  colors.

### Typography

Use a regular-weight editorial serif for display headings. Prefer an existing
licensed font in the repository. Suitable fallbacks:

```css
font-family: "Source Serif 4", "Times New Roman", Georgia, ui-serif, serif;
```

Use a neutral sans-serif for body and interface copy:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
  sans-serif;
```

Guidelines:

- desktop display: `clamp(64px, 8vw, 90px)`;
- major section heading: `clamp(44px, 6vw, 64px)`;
- serif weight: 400 only;
- body: 16–18px with comfortable line height;
- tighten display tracking slightly;
- avoid heavy bold type and stacked all-caps labels;
- an occasional italic phrase may provide editorial emphasis.

### Shape and elevation

- content cards: 24px radius;
- small cards: 16px radius;
- phone/video frame: 24–32px radius, based on the actual device crop;
- buttons: fully rounded pills;
- normal content cards: no drop shadow;
- elevated product artifacts: hairline border and a very soft shadow only;
- do not use glassmorphism, glowing borders, blurred color blobs, or floating
  decorative spheres.

## Media direction

Use **only a real phone screen recording** of the Errands product.

Do not add:

- stock photography;
- generated portraits;
- lifestyle photography;
- fake testimonial headshots;
- decorative 3D objects;
- abstract AI illustrations.

Expected media files:

```text
frontend/assets/errands-demo.mp4
frontend/assets/errands-demo-poster.webp
```

If the repository uses a different asset convention, follow it. Do not generate
or fabricate the missing recording. If the files are absent, build the component
with a clearly labeled local placeholder and document the exact filenames,
aspect ratio, codec, and replacement steps.

Recommended recording:

- portrait phone aspect ratio;
- 20–35 seconds;
- shows request, proposal review, approval, execution state, and final outcome;
- uses realistic but non-sensitive demo data;
- contains no API keys, personal addresses, payment details, or real provider
  credentials.

## Signature interaction

The central interaction is a pinned phone recording that progresses through the
product story as the user scrolls.

### Desktop behavior

- Use a two-column scroll-story section.
- Keep the phone frame sticky within the viewport.
- Place four concise narrative steps beside it:
  1. Request
  2. Review
  3. Approve
  4. Resolve
- As a step enters the active reading region, seek the video to its associated
  timestamp.
- Visually emphasize only the active step.
- Keep transitions understated: opacity, a small vertical shift, and a thin
  progress rule are enough.
- Allow the user to play, pause, mute, or restart the recording.
- Never trap normal page scrolling.

### Mobile behavior

- Do not use a tall sticky scroll trap.
- Show the phone recording inline.
- Present the four steps beneath it.
- Use native video controls or accessible custom controls.
- The full narrative must remain understandable when JavaScript is disabled or
  the video cannot play.

### Motion limits

- Favor 180–320ms transitions.
- Use natural easing without exaggerated springs or bounce.
- Animate only opacity, transform, and the video timeline when possible.
- Respect `prefers-reduced-motion`.
- In reduced-motion mode, disable scroll-linked seeking and show a normal video
  player with the four static steps.
- Never autoplay audible media.

## Page structure

### 1. Quiet navigation

- Errands wordmark on the left.
- Links: Product, Safety, Architecture, Install.
- Secondary text action: View architecture.
- Primary filled pill: Run the demo.
- Transparent background with no shadow or decorative separator.

### 2. Editorial hero

Use a large serif headline with one italic phrase. Keep it specific to the
transaction-safe product.

Suggested direction:

> Everyday errands,  
> completed with *clear approval*.

Supporting copy should explain that Errands prepares exact terms, asks before
the final action, and reports a verified or honestly ambiguous outcome.

Actions:

- primary: Run the demo;
- secondary: Read how safety works.

Do not use a generic dashboard collage. A cropped preview of the real phone
recording may appear as the single product artifact.

### 3. Pinned product story

Build the phone-recording interaction described above. Each step must explain a
real safety boundary:

1. **Request** — the user describes the grocery errand.
2. **Review** — Errands prepares exact items, quantities, prices, fees, address
   label, payment mode, ETA, expiry, and provider.
3. **Approve** — approval binds the displayed proposal; changed material terms
   require a new proposal.
4. **Resolve** — Errands attempts the final action at most once and returns a
   verified receipt, blocked state, or ambiguous state for reconciliation.

### 4. Safety is the product

Use a spacious editorial section, not a grid of generic feature cards.

Explain:

- preparation never places the order;
- material changes invalidate approval;
- every commit uses an idempotency key;
- dispatching is made durable before the final attempt;
- uncertain outcomes become `ambiguous`, never false success;
- reconciliation uses read-only checks;
- success requires a verified provider reference or receipt.

Use the single peach editorial card in this section.

### 5. Lifecycle artifact

Present the transaction lifecycle as a clean horizontal or wrapping editorial
diagram:

```text
draft → prepared → approved → dispatching
                               ├→ committed
                               ├→ blocked
                               └→ ambiguous → reconciling → committed | failed
```

Clearly label this as planned architecture if the repository does not implement
the full lifecycle.

### 6. Architecture

Show the boundary without turning the page into a dense infrastructure
diagram:

```text
Conversation agent
  → narrow Errands tools
  → proposal and approval application layer
  → provider adapter
  → durable operation and receipt records
```

Explain that credentials, provider sessions, and raw device controls do not
cross into the conversational layer.

If MCP tools are not implemented, say “planned MCP tool surface” rather than
implying they can already be installed.

### 7. Implemented today

Create a small factual section that separates evidence from roadmap.

Based on the repository guide, the implemented foundation includes:

- a pnpm and TypeScript monorepo;
- runtime-validated contracts in `@errandos/contracts`;
- schema tests;
- product and architecture documentation;
- a standalone frontend prototype.

Planned work includes:

- proposal creation and canonical hashing;
- approval and idempotency enforcement;
- commit coordination;
- deterministic provider;
- reconciliation;
- MCP tools;
- interactive application;
- end-to-end evidence.

Re-check these lists against the current repository before publishing them.

### 8. Developer start

Use commands that actually exist in the repository. Based on the supplied
guide, likely commands are:

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Do not display an npm installation command for an unpublished MCP package.

### 9. Final call to action

Use a quiet, confident close:

> Build the safe path from intent to outcome.

Actions:

- Run the deterministic demo;
- Read the architecture.

Do not add fake waitlists, fake usage metrics, invented logos, or unsupported
partner claims.

## Anti–AI-slop rules

Do not use:

- gradient-filled headlines;
- purple-to-blue backgrounds;
- glassmorphism;
- excessive glowing effects;
- decorative orbital animations;
- large grids of identical feature cards;
- an icon inside every heading;
- fake testimonials or customer logos;
- meaningless statistics;
- repeated pill badges;
- excessive rounded containers around every paragraph;
- oversized emoji;
- stock-photo diversity montages;
- vague AI copy;
- motion on every element;
- copied visual assets or layouts from another brand.

The page should derive its personality from typography, editing, real product
evidence, whitespace, and the transaction-safety narrative.

## Accessibility requirements

- Semantic landmarks and heading order.
- Skip link.
- Visible keyboard focus.
- Minimum AA text contrast.
- Accessible video controls.
- Captions or a complete text transcript for the phone recording.
- Descriptive poster alt text or adjacent explanation.
- No information available only through animation or color.
- Touch targets of at least 44×44px.
- Logical reading order when the two-column section collapses.
- Full reduced-motion behavior.

## Responsive requirements

Test at minimum:

- 320px;
- 390px;
- 768px;
- 1024px;
- 1440px.

There must be no horizontal overflow. Display headings must wrap intentionally,
the phone must remain fully usable, and code or lifecycle content must wrap or
scroll within its own bounded region.

## Implementation constraints

1. Inspect `README.md`, `docs/`, workspace manifests, and the current frontend
   before editing.
2. Preserve unrelated user changes.
3. Follow the existing frontend architecture. The supplied guide describes the
   current page as standalone HTML/CSS/JavaScript; do not introduce a framework
   merely for this redesign.
4. Refactor the existing frontend when practical instead of maintaining two
   competing public pages.
5. Rename the public page and user-facing references to Errands.
6. Keep `@errandos/contracts` and internal ErrandOS naming unless a broader
   package migration is explicitly requested.
7. Do not add backend integration that the repository does not support.
8. Keep the phone timestamps in one small configuration object instead of
   scattering them through event handlers.
9. Keep the video player, scroll-story controller, and presentation styles
   separable and understandable.
10. Do not commit generated build output, environment files, credentials, or
    personal media.

## Suggested implementation order

1. Audit the current repository and record the true implementation status.
2. Identify every user-facing legacy-brand reference.
3. Confirm the final frontend filename and asset paths.
4. Write or update tests for branding, key content, media fallback, and reduced
   motion where the current toolchain permits.
5. Replace the page structure and visual tokens.
6. Build the accessible phone video player.
7. Add the desktop scroll-story controller with mobile and reduced-motion
   fallbacks.
8. Update page metadata and documentation.
9. Run build, tests, type checking, and any frontend validation.
10. Inspect desktop and mobile renders.
11. Search again for stale branding and unsupported claims.
12. Commit the work in focused commits.

## Acceptance criteria

The redesign is complete only when:

- the public site is branded Errands everywhere;
- no legacy branding remains in the changed website surface;
- the site accurately distinguishes implemented code from planned behavior;
- the hero and entire page follow the editorial white-paper design direction;
- the only main media is the real phone screen recording or an honest local
  placeholder;
- desktop uses the pinned scroll-led product story;
- mobile and reduced-motion modes use a normal accessible video experience;
- the page contains the safety and lifecycle explanation;
- no fake metrics, testimonials, partners, or package-install claims appear;
- keyboard navigation and video controls work;
- there is no horizontal overflow at the required breakpoints;
- the repository’s existing build, tests, and type checks pass;
- the final handoff lists changed files, validation evidence, remaining
  limitations, and the exact video asset still needed, if any.

## Final instruction to Codex CLI

First inspect the repository and summarize what is currently implemented. Then
present a short implementation plan tied to real files. After that, carry out
the redesign, validate it proportionately, and report evidence rather than
assuming success.

Do not widen the backend scope. The goal is a truthful, highly polished Errands
launch site that makes transaction safety understandable through one real phone
recording and restrained editorial interaction.
