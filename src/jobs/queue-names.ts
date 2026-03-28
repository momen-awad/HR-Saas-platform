export const QUEUE_NAMES = {
  NOTIFICATION: 'notification',
  PAYROLL: 'payroll',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  AUDIT: 'audit',
  DEFAULT: 'default',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
