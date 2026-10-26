/**
 * An in-process event bus. THIS IS A STUB - you finish it.
 *
 * Requirements:
 *   - a handler that throws must not stop the other handlers
 *   - publish returns the number of handlers it reached
 *   - subscribing the same function twice registers it twice (do not dedupe)
 *   - publishing a name nobody listens to is fine and returns 0
 */

/** The events this system publishes. Add to it as you need to. */
export interface DomainEvents {
  "order.placed": { orderId: string; email: string; amountPaise: number };
}

export type EventName = keyof DomainEvents;
export type Handler<K extends EventName> = (payload: DomainEvents[K]) => void;
export type Unsubscribe = () => void;

export interface EventBus {
  publish<K extends EventName>(name: K, payload: DomainEvents[K]): number;
  subscribe<K extends EventName>(name: K, fn: Handler<K>): Unsubscribe;
}

export function createEventBus(): EventBus {
  const handlers = new Map<EventName, Array<{ handler: Handler<EventName> }>>();

  return {
    publish(name, payload) {
      const subscribers = [...(handlers.get(name) ?? [])];
      let reached = 0;

      for (const { handler } of subscribers) {
        reached += 1;
        try {
          handler(payload);
        } catch (error) {
          console.error(`Event handler for "${name}" failed:`, error);
        }
      }

      return reached;
    },
    subscribe(name, fn) {
      const subscription = { handler: fn };
      const subscribers = handlers.get(name) ?? [];
      subscribers.push(subscription);
      handlers.set(name, subscribers);

      return () => {
        const index = subscribers.indexOf(subscription);
        if (index !== -1) subscribers.splice(index, 1);
      };
    },
  };
}

export const eventBus = createEventBus();
