import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * A value kept in memory per app (one per QueryClient), never saved: a fresh
 * load starts from `initial`. Components re-render when it is written.
 */
export function clientStore<T>(initial: T) {
  interface Store {
    value: T;
    listeners: Set<() => void>;
  }
  const storeByClient = new WeakMap<QueryClient, Store>();

  function storeOf(queryClient: QueryClient): Store {
    const store = storeByClient.get(queryClient) ?? {
      value: initial,
      listeners: new Set(),
    };
    storeByClient.set(queryClient, store);
    return store;
  }

  return {
    read: (queryClient: QueryClient): T => storeOf(queryClient).value,
    write(queryClient: QueryClient, value: T) {
      const store = storeOf(queryClient);
      if (Object.is(store.value, value)) return;
      store.value = value;
      store.listeners.forEach((listener) => listener());
    },
    useValue(): T {
      const store = storeOf(useQueryClient());
      return useSyncExternalStore(
        (listener) => {
          store.listeners.add(listener);
          return () => store.listeners.delete(listener);
        },
        () => store.value
      );
    },
  };
}
