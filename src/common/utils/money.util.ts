// src/common/utils/money.util.ts

import Decimal from 'decimal.js';

/**
 * Configure Decimal.js globally for financial calculations.
 *
 * Precision: 20 digits — more than enough for any currency
 * Rounding: ROUND_HALF_UP — standard financial rounding
 *   (0.005 rounds to 0.01, not 0.00)
 *
 * WHY NOT native Number?
 *   0.1 + 0.2 === 0.30000000000000004 in JavaScript
 *   In payroll, this creates audit failures when summing line items.
 *
 * WHY NOT BigInt?
 *   BigInt cannot represent decimals. You'd need to scale everything
 *   to cents (multiply by 100), which is error-prone for multi-currency
 *   systems where some currencies have 3 decimal places (e.g., KWD).
 */
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 20,
});

/**
 * Money class for safe financial arithmetic.
 *
 * Immutable: every operation returns a NEW Money instance.
 * All internal math uses Decimal.js.
 * All outputs are rounded to the specified decimal places (default 2).
 *
 * Usage:
 *   const salary = Money.from(5000);
 *   const tax = salary.multiply(0.15);
 *   const net = salary.subtract(tax);
 *   console.log(net.toNumber());  // 4250
 *   console.log(net.toString());  // "4250.00"
 *
 * Chaining:
 *   const result = Money.from(5000)
 *     .add(Money.from(450))       // overtime
 *     .subtract(Money.from(750))  // tax
 *     .subtract(Money.from(200)); // insurance
 */
export class Money {
  private readonly value: Decimal;
  private readonly decimalPlaces: number;

  private constructor(value: Decimal, decimalPlaces: number = 2) {
    this.value = value;
    this.decimalPlaces = decimalPlaces;
  }

  /**
   * Create a Money instance from various input types.
   * Accepts: number, string, Decimal, or another Money.
   */
  static from(amount: number | string | Decimal | Money, decimalPlaces: number = 2): Money {
    if (amount instanceof Money) {
      return new Money(amount.value, decimalPlaces);
    }
    if (amount instanceof Decimal) {
      return new Money(amount, decimalPlaces);
    }
    return new Money(new Decimal(amount), decimalPlaces);
  }

  /**
   * Create a zero Money instance.
   */
  static zero(decimalPlaces: number = 2): Money {
    return new Money(new Decimal(0), decimalPlaces);
  }

  /**
   * Sum an array of Money instances.
   */
  static sum(amounts: Money[]): Money {
    return amounts.reduce(
      (acc, curr) => acc.add(curr),
      Money.zero(),
    );
  }

  /**
   * Return the minimum of two Money instances.
   */
  static min(a: Money, b: Money): Money {
    return a.value.lte(b.value) ? a : b;
  }

  /**
   * Return the maximum of two Money instances.
   */
  static max(a: Money, b: Money): Money {
    return a.value.gte(b.value) ? a : b;
  }

  // ── Arithmetic Operations ──

  add(other: Money): Money {
    return new Money(this.value.add(other.value), this.decimalPlaces);
  }

  subtract(other: Money): Money {
    return new Money(this.value.sub(other.value), this.decimalPlaces);
  }

  multiply(factor: number | string | Decimal): Money {
    const multiplier = factor instanceof Decimal ? factor : new Decimal(factor);
    return new Money(this.value.mul(multiplier), this.decimalPlaces);
  }

  divide(divisor: number | string | Decimal): Money {
    const div = divisor instanceof Decimal ? divisor : new Decimal(divisor);
    if (div.isZero()) {
      throw new Error('Money: Division by zero');
    }
    return new Money(this.value.div(div), this.decimalPlaces);
  }

  /**
   * Negate the amount (positive → negative, negative → positive).
   * Used for deductions: Money.from(200).negate() = -200.00
   */
  negate(): Money {
    return new Money(this.value.neg(), this.decimalPlaces);
  }

  /**
   * Get the absolute value.
   */
  abs(): Money {
    return new Money(this.value.abs(), this.decimalPlaces);
  }

  // ── Comparison Operations ──

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  equals(other: Money): boolean {
    return this.value.eq(other.value);
  }

  greaterThan(other: Money): boolean {
    return this.value.gt(other.value);
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.value.gte(other.value);
  }

  lessThan(other: Money): boolean {
    return this.value.lt(other.value);
  }

  lessThanOrEqual(other: Money): boolean {
    return this.value.lte(other.value);
  }

  // ── Rounding & Output ──

  /**
   * Round to the specified decimal places (default: 2).
   * Uses ROUND_HALF_UP (standard financial rounding).
   */
  round(places?: number): Money {
    const dp = places ?? this.decimalPlaces;
    return new Money(
      this.value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP),
      dp,
    );
  }

  /**
   * Convert to a JavaScript number.
   * WARNING: Only use for API responses or non-critical display.
   * Do NOT use the returned number for further calculations.
   */
  toNumber(): number {
    return this.round().value.toNumber();
  }

  /**
   * Convert to a fixed-decimal string (e.g., "5000.00").
   * Safe for database storage and API responses.
   */
  toString(): string {
    return this.round().value.toFixed(this.decimalPlaces);
  }

  /**
   * Get the raw Decimal value for advanced operations.
   */
  toDecimal(): Decimal {
    return this.value;
  }

  /**
   * Convert to a format suitable for database DECIMAL columns.
   */
  toDatabaseValue(): string {
    return this.toString();
  }

  /**
   * Custom JSON serialization — outputs as a number string.
   */
  toJSON(): string {
    return this.toString();
  }
}

