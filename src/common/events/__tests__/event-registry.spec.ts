// src/common/events/__tests__/event-registry.spec.ts

import { DomainEvents } from '../event-registry';

describe('DomainEvents Registry', () => {
  it('should have all event types as strings', () => {
    for (const [key, value] of Object.entries(DomainEvents)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('should have no duplicate event types', () => {
    const values = Object.values(DomainEvents);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should follow naming convention (module.action)', () => {
    for (const value of Object.values(DomainEvents)) {
      expect(value).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });
});

