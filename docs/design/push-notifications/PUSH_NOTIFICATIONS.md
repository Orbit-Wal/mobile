# Privacy-Preserving Push Notifications

Design doc for Orbit-Wal/mobile#13: *"Push notifications for incoming
payments would leak address-activity metadata."*

Status: design only. There is no push notification infrastructure in this
repo today (no `expo-notifications`, no FCM/APNs registration, no backend
push service) -- `app/tabs/home.tsx` currently only polls balances on
demand (pull-to-refresh / screen focus). This doc is the design that any
future push implementation in this app must follow, plus a minimal,
enforceable payload contract (`src/services/pushNotifications.ts`) so that
contract exists in code before push infra is wired up, not after.

## 1. The problem, precisely

The obvious implementation is: client registers `(deviceToken, publicKey)`
with a backend; backend watches Horizon for that public key; on a new
payment, backend sends a push containing the details (amount, asset,
counterparty) so the notification is useful without opening the app.

That design requires a server-side table mapping push tokens to Stellar
public keys, held for as long as the user wants notifications -- i.e.
indefinitely for an active wallet. For a wallet that markets itself around
user custody (the whole point of `secureStorage.ts`'s
`WHEN_UNLOCKED_THIS_DEVICE_ONLY` policy: the secret key never leaves the
device), that table is a direct contradiction: it's a persistent,
queryable, deanonymizing link between a real-world identity proxy (a push
token is tied to an Apple/Google account, which is tied to a person) and
an on-chain public key, sitting in a database Orbit-Wal operates and could
be compelled to hand over, could leak, or could simply be operated by a
future, less trustworthy team.

Putting transaction details (amount, counterparty, memo) *in the push
payload itself* makes this strictly worse: APNs/FCM are third parties in
the delivery path (Apple/Google infrastructure), so a naive payload
doesn't just leak to Orbit-Wal's backend, it leaks to Apple/Google too,
and to anything with read access to those systems' logs.

## 2. Design decision: silent push as a wake signal only

**The push payload never contains anything Stellar-specific.** It is a
single opaque signal -- "something may have changed, go check" -- with no
amount, no asset, no counterparty, no address, and critically, no
per-address identifier of any kind. The app, once opened (or woken via a
background/silent push), fetches the real details itself, over its own
authenticated connection directly to Horizon -- the same `getBalances`
path `home.tsx` already uses on every refresh, not a new backend
round-trip.

```
1. Device registers a push token with the backend.
2. Backend stores (push_token) only. No public key, no wallet identifier
   of any kind, is ever associated with that token server-side.
3. <see options A/B below for how the backend learns "something happened"
   without learning *for whom*>
4. Backend sends a silent/generic push: { type: "possible_activity" } --
   no address, no amount, no timestamp tied to a specific account.
5. App wakes (foreground or background fetch), re-derives its own public
   key locally (it already has it, from secureStorage), and calls
   getBalances()/a transactions endpoint directly against Horizon using
   that key. Horizon sees the query; the push backend never does.
6. If something's actually new, the app renders a normal local
   notification/UI update with the real details -- generated entirely
   on-device, never transmitted.
```

Two ways to implement step 2/3 without the backend learning the mapping:

**Option A -- client-side polling, no server correlation at all
(recommended default).** The app periodically polls Horizon directly (via
a background task / background fetch) on its own schedule. No push
backend, no token-to-key table, needed at all for the core feature. This
has the weakest "instant" notification UX (bounded by OS background-fetch
intervals, which are already loose on both iOS and Android), but has the
strongest privacy property: there is no third party in the loop that can
correlate anything, because there is no third party. This is the right
default for v1.

**Option B -- silent push as a *periodic* wake signal, still with no
correlation.** If tighter latency than background-fetch intervals is
needed later, the backend can broadcast the same generic
`{ type: "possible_activity" }` silent push to *all* registered tokens on
a fixed interval (e.g. every few minutes) or on a public, aggregate signal
(e.g. "a new ledger closed") -- never tied to *which* token corresponds to
*which* address, because the backend was never told that mapping. Every
device wakes, checks its own address against Horizon, and only the
devices with actual new activity show anything. This trades some battery
efficiency (every device does a no-op check most of the time) for lower
latency than Option A, while keeping the same non-correlation property.
Both options can coexist (Option A while backgrounded for long stretches,
Option B for near-term responsiveness); neither requires the token↔address
table this issue warns against.

## 3. What this rules out, explicitly (Definition of Done)

- **No design that requires a central server to persistently store the
  address↔device mapping in plaintext.** Neither option above stores it
  at all, plaintext or otherwise -- the backend's only persistent state is
  a set of opaque push tokens with no attached wallet identifier. (A
  future design that wants faster targeted delivery *could* consider
  storing only a one-way hash of the address plus a per-install secret,
  but that's explicitly out of scope for v1 -- Option A/B need no such
  thing, and a hash of a 56-character base32 Stellar address with no
  additional entropy is not meaningfully non-reversible against a public,
  fully-enumerable Horizon ledger anyway, so it would be a false sense of
  security, not a real mitigation.)

- **The push payload itself never carries amount, counterparty, memo, or
  address**, satisfying the issue's core ask directly: even a fully
  compromised or hostile APNs/FCM operator, or a compromised push backend,
  learns only "this token's device woke up," never "this address received
  this amount from this counterparty."

## 4. Threat model: compromised push-notification backend

Assume the backend (wherever it eventually lives) is fully compromised --
attacker has read/write access to its database and can also send arbitrary
pushes to any registered token.

| Attacker capability | What they get under this design |
|---|---|
| Read the token database | A list of opaque push tokens. No addresses, no amounts, no way to tell which token belongs to which wallet, unless they also compromise Apple/Google's account-to-token mapping (out of this app's control either way). |
| Read push payload contents in transit/logs | `{ type: "possible_activity" }` or equivalent -- no financial or identity data. |
| Send arbitrary pushes | Can wake any device / cause it to poll Horizon early, or spam generic "check now" notifications (a denial-of-service / annoyance vector, not a confidentiality one) -- can't inject fabricated transaction details into the UI, since the app renders only what it fetches itself from Horizon, never what's in the push payload. |
| Correlate push timing with public Horizon activity | This is the one real residual risk: if the backend broadcasts pushes to a *small* set of tokens at a time correlated with specific on-chain events, timing analysis could narrow down which token belongs to which address, especially for a low-traffic address. Option A (silent, no server-side trigger at all) has zero exposure to this. Option B's periodic-broadcast-to-everyone variant minimizes it (every device gets the same signal at the same time regardless of its own activity), but a *targeted* per-address trigger reintroduces exactly the correlation this design exists to avoid, and must not be built. |
| Compel the operator (legal request) for "who received funds and when" | Nothing to hand over -- the operator's own database never held that answer. |

## 5. What ships next, if/when this is built

1. `expo-notifications` + backend token registration endpoint that stores
   only the opaque token (no auth-tied wallet identifier in the same
   record).
2. Implement Option A (client-side background fetch, polling
   `getBalances`/a transactions endpoint on GlobeWallet's own schedule) as
   the v1 mechanism -- no backend push infra required for this alone.
3. Only if latency complaints justify it, add Option B's broadcast-style
   silent push as a supplementary wake signal, with an explicit code
   review gate on the invariant: **no push payload or backend record may
   ever contain a Stellar address, alongside a check that no send path can
   target a single token based on chain activity for that token's
   (unknown-to-the-backend) address.**

See `src/services/pushNotifications.ts` for the payload type this
constrains any future notification-handling code to.
