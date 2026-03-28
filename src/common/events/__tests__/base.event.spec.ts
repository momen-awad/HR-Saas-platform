// src/common/events/__tests__/base.event.spec.ts

import { BaseEvent } from '../base.event';
import { DomainEvents } from '../event-registry';

class TestEvent extends BaseEvent {
  constructor(
    tenantId: string,
    public readonly testData: string,
  ) {
    super('test.event', tenantId, 'test-user');
  }

  toPayload() {
    return { testData: this.testData };
  }
}

describe('BaseEvent', () => {
  it('should generate unique event ID', () => {
    const event1 = new TestEvent('tenant-1', 'data1');
    const event2 = new TestEvent('tenant-1', 'data2');
    expect(event1.eventId).not.toBe(event2.eventId);
  });

  it('should set occurredAt to current time', () => {
    const before = new Date();
    const event = new TestEvent('tenant-1', 'data');
    const after = new Date();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should serialize to full payload', () => {
    const event = new TestEvent('tenant-1', 'hello');
    const full = event.toFullPayload();

    expect(full.eventId).toBeDefined();
    expect(full.eventType).toBe('test.event');
    expect(full.tenantId).toBe('tenant-1');
    expect(full.triggeredBy).toBe('test-user');
    expect(full.occurredAt).toBeDefined();
    expect(full.data).toEqual({ testData: 'hello' });
  });

  it('should carry correct event type', () => {
    const event = new TestEvent('t1', 'data');
    expect(event.eventType).toBe('test.event');
  });
});

