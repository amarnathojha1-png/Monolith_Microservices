# Notifications extraction plan

## Why Notifications first

Notifications is the first module I would consider extracting because it owns
an outward side effect: sending a confirmation. Orders already publishes an
`order.placed` event, and Notifications consumes it, so the modules have a
natural seam. The other modules are currently core order flow and have no
similarly clear operational boundary in this small example.

This is a candidate, not a recommendation to deploy a service immediately. The
repository does not tell us team size, production load, or operational
readiness. Until there is a concrete need, I would keep Notifications inside
the modular monolith and complete only the useful boundary and data-separation
work.

## Five extraction steps

1. **Make the boundary real.** Keep all notification behavior behind
   `src/modules/notifications/index.ts`. Orders must publish
   `order.placed`, not import Notifications or call its implementation.
   Notifications subscribes through the event contract and owns message
   creation. Keep the boundary checker in the test/CI path so imports cannot
   bypass the public API.
2. **Move the data.** Give Notifications its own persistence schema and
   storage, with ownership of message/outbox records and their migrations.
   Remove its dependency on the shared in-memory table implementation. Define
   how existing outbox records are migrated before changing production
   storage; for this demo, there are no durable records to migrate.
3. **Put a seam in front.** Define a small notification client/port for
   submitting a notification, with the current in-process event subscriber as
   its implementation. Keep the event payload versioned and explicit. Specify
   retry and idempotency behavior so redelivery of an order event cannot send
   duplicate confirmations.
4. **Deploy it separately.** Only after there is a measured reason and the
   team can operate another service, replace the in-process adapter with a
   transport-backed client/consumer (for example, HTTP or a durable message
   broker). Add timeouts, bounded retries, idempotency keys, health checks,
   tracing, per-service alerts, discovery, and independent CI/deployment.
   Start with a small traffic percentage and monitor delivery failures and
   latency before increasing it.
5. **Stop.** Once Notifications is independently deployable and the original
   pain is gone, leave Orders, Inventory, and Payments in the monolith. Do not
   split another module without a separate, measurable reason.
