export type Identity = { token: string; name: string };

const KEY = "erewhon-group-cart:me";

export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.token !== "string" || typeof parsed.name !== "string") {
      return null;
    }
    return { token: parsed.token, name: parsed.name };
  } catch {
    return null;
  }
}

export function saveIdentity(name: string): Identity {
  const existing = loadIdentity();
  const identity: Identity = {
    token: existing?.token ?? crypto.randomUUID(),
    name: name.trim(),
  };
  window.localStorage.setItem(KEY, JSON.stringify(identity));
  cache = identity;
  for (const listener of listeners) listener();
  return identity;
}

// useSyncExternalStore adapter so components read identity without effects.
let cache: Identity | null | undefined;
const listeners = new Set<() => void>();

export function subscribeIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getIdentitySnapshot(): Identity | null {
  if (cache === undefined) cache = loadIdentity();
  return cache;
}

export function getIdentityServerSnapshot(): Identity | null {
  return null;
}
