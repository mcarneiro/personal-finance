import { describe, expect, it } from 'vitest';
import { generateId } from '../id';

describe('generateId', () => {
  it('produces distinct, non-empty ids', () => {
    // Given an id generator used to key domain entities
    // When several ids are generated
    const ids = [generateId(), generateId(), generateId()];

    // Then every id is usable as a key and none collide
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
