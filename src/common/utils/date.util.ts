// src/common/utils/date.util.ts

import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  subDays,
  differenceInMinutes,
  differenceInCalendarDays,
  isWeekend,
  format,
  parseISO,
  eachDayOfInterval,
  isSameDay,
  isAfter,
  isBefore,
  isValid,
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * DateUtil — centralized timezone-aware date helper.
 *
 * CORE PRINCIPLE: UTC everywhere, convert only at boundaries.
 *
 * All timestamps in the database are TIMESTAMPTZ (UTC).
 * All internal processing uses UTC.
 * Conversion to local time happens ONLY:
 *   1. When determining the "work date" for an attendance record
 *   2. When calculating payroll period boundaries
 *   3. When displaying dates to users (API response interceptor)
 *
 * This class wraps date-fns and date-fns-tz to prevent developers
 * from using raw Date constructors (which use system timezone)
 * or making timezone mistakes.
 */
export class DateUtil {
  // ── Current Time ──

  /**
   * Get current UTC time. Use this instead of `new Date()`.
   * `new Date()` technically returns UTC, but making it explicit
   * prevents confusion and makes intention clear in code reviews.
   */
  static nowUtc(): Date {
    return new Date();
  }

  /**
   * Get today's date as a UTC Date at midnight.
   */
  static todayUtc(): Date {
    return startOfDay(new Date());
  }

  // ── Timezone Conversions ──

  /**
   * Convert a UTC timestamp to a specific timezone.
   * Returns a Date object representing the local time.
   *
   * Example:
   *   utcToTimezone(new Date('2025-01-15T18:30:00Z'), 'Asia/Kolkata')
   *   → 2025-01-16T00:00:00 (midnight local = next day!)
   */
  static utcToTimezone(utcDate: Date, timezone: string): Date {
    return toZonedTime(utcDate, timezone);
  }

  /**
   * Convert a local time in a specific timezone to UTC.
   *
   * Example:
   *   timezoneToUtc(localMidnight, 'Asia/Kolkata')
   *   → UTC timestamp representing that local midnight
   */
  static timezoneToUtc(localDate: Date, timezone: string): Date {
    return fromZonedTime(localDate, timezone);
  }

  /**
   * Format a UTC timestamp in a specific timezone.
   * Returns a formatted string.
   *
   * Example:
   *   formatInTz(utcDate, 'America/New_York', 'yyyy-MM-dd HH:mm:ss')
   *   → "2025-01-15 13:30:00"
   */
  static formatInTz(
    utcDate: Date,
    timezone: string,
    formatStr: string = "yyyy-MM-dd'T'HH:mm:ssXXX",
  ): string {
    return formatInTimeZone(utcDate, timezone, formatStr);
  }

  // ── Work Date Determination ──

  /**
   * Determine which "work date" an attendance record belongs to.
   * This is the LOCAL date in the employee's timezone.
   *
   * CRITICAL for payroll: an employee checking in at 11:30 PM UTC
   * might be in a timezone where it's already the next calendar day.
   *
   * @param checkInUtc - The UTC timestamp of the check-in
   * @param employeeTimezone - The employee's timezone
   * @returns The local date as a Date object (at midnight local time, then converted to UTC for storage)
   */
  static determineWorkDate(checkInUtc: Date, employeeTimezone: string): Date {
    const localTime = toZonedTime(checkInUtc, employeeTimezone);
    const localDate = startOfDay(localTime);
    return localDate;
  }

  /**
   * Determine work date and return as ISO date string (YYYY-MM-DD).
   * This is what gets stored in the `work_date DATE` column.
   */
  static determineWorkDateString(
    checkInUtc: Date,
    employeeTimezone: string,
  ): string {
    const localTime = toZonedTime(checkInUtc, employeeTimezone);
    return format(localTime, 'yyyy-MM-dd');
  }

  // ── Payroll Period Boundaries ──

  /**
   * Get the UTC boundaries for a payroll period (year + month).
   * The period is defined in the TENANT'S timezone.
   *
   * Example: January 2025 for a tenant in 'Asia/Riyadh' (UTC+3):
   *   start: 2024-12-31T21:00:00Z (Jan 1, 00:00 in Riyadh)
   *   end:   2025-01-31T20:59:59.999Z (Jan 31, 23:59:59 in Riyadh)
   */
  static getPayrollPeriodUtcBounds(
    year: number,
    month: number,
    tenantTimezone: string,
  ): { start: Date; end: Date } {
    // Build the local start of month
    const localStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const localEnd = endOfMonth(localStart);

    // Set local end to end of day
    const localEndOfDay = endOfDay(localEnd);

    return {
      start: fromZonedTime(localStart, tenantTimezone),
      end: fromZonedTime(localEndOfDay, tenantTimezone),
    };
  }

  // ── Working Days Calculation ── [✅ FIXED]

  /**
   * Working days bitmask convention:
   *   Mon = 1 (2^0)  ← bit 0
   *   Tue = 2 (2^1)  ← bit 1
   *   Wed = 4 (2^2)  ← bit 2
   *   Thu = 8 (2^3)  ← bit 3
   *   Fri = 16 (2^4) ← bit 4
   *   Sat = 32 (2^5) ← bit 5
   *   Sun = 64 (2^6) ← bit 6
   *
   * Common presets:
   *   Mon-Fri = 31  (0b0011111)
   *   Sun-Thu = 79  (0b1001111)
   *   Sat-Wed = 124 (0b1111100)
   */
  static countWorkingDays(
    startDate: Date,
    endDate: Date,
    holidays: string[] = [],
    workingDaysBitmask: number = 31, // ✅ Mon-Fri (was incorrectly 62)
  ): number {
    const holidaySet = new Set(holidays);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.filter((day) => {
      // JavaScript getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      const jsDay = day.getDay();
      
      // ✅ Map JS day to correct bitmask position:
      // JS 0 (Sun) → bit 6 → 64
      // JS 1 (Mon) → bit 0 → 1
      // JS 2 (Tue) → bit 1 → 2
      // ...
      // JS 6 (Sat) → bit 5 → 32
      const bitmaskValue = jsDay === 0 ? 64 : (1 << (jsDay - 1));

      // Check if this day is enabled in the bitmask
      const isWorkingDay = (workingDaysBitmask & bitmaskValue) !== 0;
      if (!isWorkingDay) return false;

      // Check if it's a holiday
      const dateStr = format(day, 'yyyy-MM-dd');
      if (holidaySet.has(dateStr)) return false;

      return true;
    }).length;
  }

  // ── Duration Calculations ──

  /**
   * Calculate working minutes between two UTC timestamps.
   */
  static calculateWorkingMinutes(
    checkIn: Date,
    checkOut: Date,
  ): number {
    if (!checkOut || isBefore(checkOut, checkIn)) {
      return 0;
    }
    return differenceInMinutes(checkOut, checkIn);
  }

  /**
   * Convert minutes to hours and minutes string.
   * Example: 510 → "8h 30m"
   */
  static formatMinutesToHoursMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  /**
   * Convert minutes to decimal hours.
   * Example: 510 → 8.5
   */
  static minutesToDecimalHours(minutes: number): number {
    return Math.round((minutes / 60) * 100) / 100;
  }

  // ── Validation ──

  /**
   * Check if a date string is valid ISO format.
   */
  static isValidDateString(dateStr: string): boolean {
    const parsed = parseISO(dateStr);
    return isValid(parsed);
  }

  /**
   * Check if a timezone string is valid IANA timezone.
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  // ── Re-exports for convenience ──

  static startOfDay = startOfDay;
  static endOfDay = endOfDay;
  static startOfMonth = startOfMonth;
  static endOfMonth = endOfMonth;
  static addDays = addDays;
  static addMonths = addMonths;
  static subDays = subDays;
  static differenceInMinutes = differenceInMinutes;
  static differenceInCalendarDays = differenceInCalendarDays;
  static isSameDay = isSameDay;
  static isAfter = isAfter;
  static isBefore = isBefore;
  static format = format;
  static parseISO = parseISO;
}
