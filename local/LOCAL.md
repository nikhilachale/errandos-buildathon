# Local JaldiAI

This directory is the phone-first JaldiAI implementation used for the
buildathon demo.

## Interaction

1. The user presses and holds the circular floating button.
2. The phone records speech for as long as the button is held.
3. Releasing the button sends the turn to the Mac voice server.
4. Sarvam transcribes the speech and preserves the user's Indian language.
5. The intelligence layer selects a narrow phone action.
6. Appium performs the action in the official Android app.
7. The overlay speaks progress, clarification questions, and results through
   Sarvam in the same language.

Follow-up turns retain the pending product choices. A specific product can be
selected by name, while “add to cart” applies directly when only one pending
choice remains.

## Runtime

The current demo uses:

- an Android phone with the JaldiAI overlay installed;
- wireless ADB between the phone and Mac;
- Appium on the Mac;
- the Next.js voice server in `apps/voice`;
- server-managed OpenAI and Sarvam keys.

Copy `apps/voice/.env.example` to `apps/voice/.env.local` and fill the real
server-side values. Never place keys in the Android client or commit the local
env file.

From the repository root:

```bash
pnpm --dir local install
pnpm --dir local typecheck
pnpm --dir local test
pnpm --dir local --filter @errandos/voice exec next dev --hostname 0.0.0.0 --port 3100
```

The local implementation can be disconnected from USB after wireless ADB is
connected and the overlay is installed. The current execution path still
requires the Mac server, Appium, wireless ADB, and the phone and Mac to be on
the same network.
