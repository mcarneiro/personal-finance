/**
 * Generate a unique id for a domain entity. Ids are opaque; card spending
 * history is keyed by card id, so a removed card's id is never reused.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
