// src/common/utils/__tests__/date.util.spec.ts

import { DateUtil } from '../date.util';

describe('DateUtil', () => {
  describe('determineWorkDate', () => {
    it('should determine correct work date for same-day timezone', () => {
      // 2025-01-15 10:00 UTC → 2025-01-15 in UTC timezone
      const utcDate = new Date('2025-01-15T10:00:00Z');
      const workDate = DateUtil.determineWorkDateString(utcDate, 'UTC');
      expect(workDate).toBe('2025-01-15');
    });

    it('should shift to next day for positive offset timezone near midnight UTC', () => {
      // 2025-01-15 18:30 UTC → 2025-01-16 00:00 in Asia/Kolkata (UTC+5:30)
      const utcDate = new Date('2025-01-15T18:30:00Z');
      const workDate = DateUtil.determineWorkDateString(utcDate, 'Asia/Kolkata');
      expect(workDate).toBe('2025-01-16');
    });

    it('should shift to previous day for negative offset timezone near midnight UTC', () => {
      // 2025-01-15 03:00 UTC → 2025-01-14 22:00 in America/New_York (UTC-5)
      const utcDate = new Date('2025-01-15T03:00:00Z');
      const workDate = DateUtil.determineWorkDateString(utcDate, 'America/New_York');
      expect(workDate).toBe('2025-01-14');
    });

    it('should handle UTC midnight correctly', () => {
      // 2025-01-15 00:00 UTC → still Jan 14 in America/Los_Angeles (UTC-8)
      const utcDate = new Date('2025-01-15T00:00:00Z');
      const workDate = DateUtil.determineWorkDateString(utcDate, 'America/Los_Angeles');
      expect(workDate).toBe('2025-01-14');
    });

    it('should handle half-hour timezone offsets', () => {
      // 2025-01-15 18:00 UTC → 2025-01-15 23:30 in Asia/Kolkata (UTC+5:30)
      const utcDate = new Date('2025-01-15T18:00:00Z');
      const workDate = DateUtil.determineWorkDateString(utcDate, 'Asia/Kolkata');
      expect(workDate).toBe('2025-01-15');
    });
  });

  describe('getPayrollPeriodUtcBounds', () => {
    it('should calculate UTC bounds for UTC timezone', () => {
      const bounds = DateUtil.getPayrollPeriodUtcBounds(2025, 1, 'UTC');
      expect(bounds.start.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      // End should be Jan 31 end of day
      expect(bounds.end.getUTCDate()).toBe(31);
      expect(bounds.end.getUTCMonth()).toBe(0); // January
    });

    it('should offset bounds for positive timezone', () => {
      // Asia/Riyadh is UTC+3
      // Jan 1 00:00 Riyadh = Dec 31 21:00 UTC
      const bounds = DateUtil.getPayrollPeriodUtcBounds(2025, 1, 'Asia/Riyadh');
      expect(bounds.start.getUTCDate()).toBe(31);
      expect(bounds.start.getUTCMonth()).toBe(11); // December (previous year)
      expect(bounds.start.getUTCHours()).toBe(21);
    });

    it('should offset bounds for negative timezone', () => {
      // America/New_York is UTC-5
      // Jan 1 00:00 NY = Jan 1 05:00 UTC
      const bounds = DateUtil.getPayrollPeriodUtcBounds(2025, 1, 'America/New_York');
      expect(bounds.start.getUTCDate()).toBe(1);
      expect(bounds.start.getUTCHours()).toBe(5);
    });
  });

  describe('countWorkingDays', () => {
    it('should count Mon-Fri excluding holidays', () => {
      const start = new Date(2025, 0, 1);   // Jan 1, Wed
      const end = new Date(2025, 0, 31);    // Jan 31, Fri
      const holidays = ['2025-01-01'];       // New Year

      const result = DateUtil.countWorkingDays(start, end, holidays);
      // January 2025 has 23 weekdays, minus 1 holiday = 22
      expect(result).toBe(22);
    });

    it('should return 0 for weekend-only range', () => {
      const start = new Date(2025, 0, 4);   // Saturday
      const end = new Date(2025, 0, 5);     // Sunday

      const result = DateUtil.countWorkingDays(start, end);
      expect(result).toBe(0);
    });

    it('should count single working day', () => {
      const date = new Date(2025, 0, 6);    // Monday
      const result = DateUtil.countWorkingDays(date, date);
      expect(result).toBe(1);
    });

    it('should handle custom working days bitmask (Sun-Thu)', () => {
      // Sun=64, Mon=1, Tue=2, Wed=4, Thu=8 = 79
      const start = new Date(2025, 0, 1);
      const end = new Date(2025, 0, 7);

      const sunThuBitmask = 64 + 1 + 2 + 4 + 8; // 79
      const result = DateUtil.countWorkingDays(start, end, [], sunThuBitmask);
      // Jan 1=Wed(4), Jan 2=Thu(8), Jan 3=Fri(skip), Jan 4=Sat(skip), 
      // Jan 5=Sun(64), Jan 6=Mon(1), Jan 7=Tue(2)
      expect(result).toBe(5);
    });
  });

  describe('calculateWorkingMinutes', () => {
    it('should calculate minutes between check-in and check-out', () => {
      const checkIn = new Date('2025-01-15T08:00:00Z');
      const checkOut = new Date('2025-01-15T17:00:00Z');
      expect(DateUtil.calculateWorkingMinutes(checkIn, checkOut)).toBe(540); // 9 hours
    });

    it('should return 0 if checkout is before checkin', () => {
      const checkIn = new Date('2025-01-15T17:00:00Z');
      const checkOut = new Date('2025-01-15T08:00:00Z');
      expect(DateUtil.calculateWorkingMinutes(checkIn, checkOut)).toBe(0);
    });

    it('should return 0 if checkout is null', () => {
      const checkIn = new Date('2025-01-15T08:00:00Z');
      expect(DateUtil.calculateWorkingMinutes(checkIn, null as any)).toBe(0);
    });
  });

  describe('minutesToDecimalHours', () => {
    it('should convert 480 minutes to 8.0 hours', () => {
      expect(DateUtil.minutesToDecimalHours(480)).toBe(8);
    });

    it('should convert 510 minutes to 8.5 hours', () => {
      expect(DateUtil.minutesToDecimalHours(510)).toBe(8.5);
    });

    it('should convert 0 minutes to 0 hours', () => {
      expect(DateUtil.minutesToDecimalHours(0)).toBe(0);
    });
  });

  describe('timezone validation', () => {
    it('should validate known IANA timezones', () => {
      expect(DateUtil.isValidTimezone('America/New_York')).toBe(true);
      expect(DateUtil.isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(DateUtil.isValidTimezone('UTC')).toBe(true);
      expect(DateUtil.isValidTimezone('Europe/London')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(DateUtil.isValidTimezone('Invalid/Zone')).toBe(false);
      expect(DateUtil.isValidTimezone('Mars/Olympus')).toBe(false);
      expect(DateUtil.isValidTimezone('')).toBe(false);
    });
  });

  describe('formatMinutesToHoursMinutes', () => {
    it('should format correctly', () => {
      expect(DateUtil.formatMinutesToHoursMinutes(510)).toBe('8h 30m');
      expect(DateUtil.formatMinutesToHoursMinutes(60)).toBe('1h 0m');
      expect(DateUtil.formatMinutesToHoursMinutes(45)).toBe('0h 45m');
      expect(DateUtil.formatMinutesToHoursMinutes(0)).toBe('0h 0m');
    });
  });
});


