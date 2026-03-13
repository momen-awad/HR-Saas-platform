// src/common/utils/__tests__/money.util.spec.ts

import { Money } from '../money.util';

describe('Money', () => {
  describe('creation', () => {
    it('should create from number', () => {
      expect(Money.from(100).toString()).toBe('100.00');
    });

    it('should create from string', () => {
      expect(Money.from('99.99').toString()).toBe('99.99');
    });

    it('should create from another Money', () => {
      const original = Money.from(500);
      const copy = Money.from(original);
      expect(copy.toString()).toBe('500.00');
    });

    it('should create zero', () => {
      expect(Money.zero().toString()).toBe('0.00');
      expect(Money.zero().isZero()).toBe(true);
    });
  });

  describe('arithmetic', () => {
    it('should add correctly', () => {
      const result = Money.from(100.50).add(Money.from(200.30));
      expect(result.toString()).toBe('300.80');
    });

    it('should subtract correctly', () => {
      const result = Money.from(500).subtract(Money.from(150.75));
      expect(result.toString()).toBe('349.25');
    });

    it('should multiply correctly', () => {
      const result = Money.from(1000).multiply(0.15);
      expect(result.toString()).toBe('150.00');
    });

    it('should divide correctly', () => {
      const result = Money.from(1000).divide(3);
      expect(result.toString()).toBe('333.33');
    });

    it('should throw on division by zero', () => {
      expect(() => Money.from(100).divide(0)).toThrow('Division by zero');
    });

    it('should negate correctly', () => {
      expect(Money.from(500).negate().toString()).toBe('-500.00');
      expect(Money.from(-200).negate().toString()).toBe('200.00');
    });

    it('should handle 0.1 + 0.2 correctly (floating point proof)', () => {
      const result = Money.from(0.1).add(Money.from(0.2));
      expect(result.toString()).toBe('0.30');
      expect(result.toNumber()).toBe(0.3);
    });
  });

  describe('financial calculations', () => {
    it('should calculate payroll correctly', () => {
      const baseSalary = Money.from(5000);
      const overtime = Money.from(450.75);
      const gross = baseSalary.add(overtime);

      const taxRate = 0.15;
      const tax = gross.multiply(taxRate);
      const insurance = Money.from(200);
      const net = gross.subtract(tax).subtract(insurance);

      expect(gross.toString()).toBe('5450.75');
      expect(tax.toString()).toBe('817.61');
      expect(net.toString()).toBe('4433.14');
    });

    it('should prorate salary correctly', () => {
      const monthlySalary = Money.from(6000);
      const workingDaysInMonth = 22;
      const daysWorked = 15;

      const dailyRate = monthlySalary.divide(workingDaysInMonth);
      const prorated = dailyRate.multiply(daysWorked);

      expect(dailyRate.toString()).toBe('272.73');
      expect(prorated.toString()).toBe('4090.91'); // 272.73 * 15 = 4090.95... rounds to 4090.91
    });

    it('should sum an array of amounts', () => {
      const amounts = [
        Money.from(100),
        Money.from(200.50),
        Money.from(300.25),
        Money.from(50.25),
      ];
      const total = Money.sum(amounts);
      expect(total.toString()).toBe('651.00');
    });
  });

  describe('comparison', () => {
    it('should compare equal values', () => {
      expect(Money.from(100).equals(Money.from(100))).toBe(true);
      expect(Money.from(100).equals(Money.from(200))).toBe(false);
    });

    it('should compare greater/less than', () => {
      const a = Money.from(500);
      const b = Money.from(300);
      expect(a.greaterThan(b)).toBe(true);
      expect(b.lessThan(a)).toBe(true);
      expect(a.greaterThanOrEqual(Money.from(500))).toBe(true);
    });

    it('should detect positive/negative/zero', () => {
      expect(Money.from(100).isPositive()).toBe(true);
      expect(Money.from(-100).isNegative()).toBe(true);
      expect(Money.zero().isZero()).toBe(true);
      expect(Money.zero().isPositive()).toBe(false);
    });

    it('should return min and max', () => {
      const a = Money.from(100);
      const b = Money.from(200);
      expect(Money.min(a, b).toString()).toBe('100.00');
      expect(Money.max(a, b).toString()).toBe('200.00');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON as string', () => {
      const money = Money.from(1234.56);
      expect(JSON.stringify({ amount: money })).toBe('{"amount":"1234.56"}');
    });

    it('should produce database value', () => {
      expect(Money.from(99999.99).toDatabaseValue()).toBe('99999.99');
    });
  });

  describe('rounding', () => {
    it('should round half up (financial standard)', () => {
      expect(Money.from(10.005).toString()).toBe('10.01'); // rounds UP
      expect(Money.from(10.004).toString()).toBe('10.00'); // rounds DOWN
    });

    it('should support custom decimal places', () => {
      const threeDecimals = Money.from(100.1234, 3);
      expect(threeDecimals.toString()).toBe('100.123');
    });
  });
});


