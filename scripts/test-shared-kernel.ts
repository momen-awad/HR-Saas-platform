// scripts/test-shared-kernel.ts

import { Money } from '../src/common/utils/money.util';
import { DateUtil } from '../src/common/utils/date.util';
import { HashUtil } from '../src/common/utils/hash.util';
import { PaginationHelper } from '../src/common/utils/pagination.util';
import { PaginationQueryDto } from '../src/common/dto/pagination-query.dto';

async function runTests() {
  console.log('=== Shared Kernel Smoke Test ===\n');

  // ── Money Tests ──
  console.log('--- Money Utility ---');

  const salary = Money.from(5000);
  const overtime = Money.from(450.75);
  const tax = salary.add(overtime).multiply(0.15);
  const insurance = Money.from(200);
  const net = salary.add(overtime).subtract(tax).subtract(insurance);

  console.log(`Salary:    ${salary.toString()}`);
  console.log(`Overtime:  ${overtime.toString()}`);
  console.log(`Tax (15%): ${tax.toString()}`);
  console.log(`Insurance: ${insurance.toString()}`);
  console.log(`Net:       ${net.toString()}`);

  // Verify: 5000 + 450.75 = 5450.75, tax = 817.61, net = 5450.75 - 817.61 - 200 = 4433.14
  const expected = '4433.14';
  console.log(`Expected:  ${expected}`);
  console.log(`Match:     ${net.toString() === expected ? '✅' : '❌'}\n`);

  // Floating point proof
  const a = Money.from(0.1);
  const b = Money.from(0.2);
  const sum = a.add(b);
  console.log(`0.1 + 0.2 = ${sum.toString()} (JS native: ${0.1 + 0.2})`);
  console.log(`Correct:   ${sum.toString() === '0.30' ? '✅' : '❌'}\n`);

  // ── Date Tests ──
  console.log('--- Date Utility ---');

  // Work date determination
  const utcMidnightIndia = new Date('2025-01-15T18:30:00Z');
  const workDate = DateUtil.determineWorkDateString(utcMidnightIndia, 'Asia/Kolkata');
  console.log(`UTC: 2025-01-15T18:30:00Z in Asia/Kolkata`);
  console.log(`Work date: ${workDate}`);
  console.log(`Expected:  2025-01-16`);
  console.log(`Match:     ${workDate === '2025-01-16' ? '✅' : '❌'}\n`);

  // Payroll period bounds
  const bounds = DateUtil.getPayrollPeriodUtcBounds(2025, 1, 'Asia/Riyadh');
  console.log(`Payroll Jan 2025 (Riyadh UTC+3):`);
  console.log(`  Start UTC: ${bounds.start.toISOString()}`);
  console.log(`  End UTC:   ${bounds.end.toISOString()}\n`);

  // Working days
  const start = new Date(2025, 0, 1);  // Jan 1
  const end = new Date(2025, 0, 31);   // Jan 31
  const holidays = ['2025-01-01', '2025-01-20'];  // New Year + MLK Day
  const workingDays = DateUtil.countWorkingDays(start, end, holidays);
  console.log(`Working days Jan 2025 (excl 2 holidays): ${workingDays}`);
  console.log(`Expected: 21`);
  console.log(`Match:    ${workingDays === 21 ? '✅' : '❌'}\n`);

  // Timezone validation
  console.log(`Valid timezone 'America/New_York': ${DateUtil.isValidTimezone('America/New_York') ? '✅' : '❌'}`);
  console.log(`Invalid timezone 'Mars/Olympus':   ${!DateUtil.isValidTimezone('Mars/Olympus') ? '✅' : '❌'}\n`);

  // ── Hash Tests ──
  console.log('--- Hash Utility ---');

  const password = 'SecureP@ssw0rd!';
  const hash = await HashUtil.hashPassword(password);
  const isValid = await HashUtil.verifyPassword(password, hash);
  const isInvalid = await HashUtil.verifyPassword('wrong', hash);
  console.log(`Password hash:  ${hash.substring(0, 30)}...`);
  console.log(`Verify correct: ${isValid ? '✅' : '❌'}`);
  console.log(`Verify wrong:   ${!isInvalid ? '✅' : '❌'}`);

  const chainHash1 = HashUtil.chainHash('{"action":"create"}', '');
  const chainHash2 = HashUtil.chainHash('{"action":"update"}', chainHash1);
  console.log(`Audit chain hash 1: ${chainHash1.substring(0, 20)}...`);
  console.log(`Audit chain hash 2: ${chainHash2.substring(0, 20)}...`);
  console.log(`Hashes differ: ${chainHash1 !== chainHash2 ? '✅' : '❌'}\n`);

  // ── Pagination Tests ──
  console.log('--- Pagination Utility ---');

  const query = new PaginationQueryDto();
  query.page = 3;
  query.perPage = 10;

  const result = PaginationHelper.createResult(
    ['item1', 'item2', 'item3'],
    85,
    query,
  );
  console.log(`Pagination meta:`, JSON.stringify(result.pagination, null, 2));
  console.log(`Total pages = 9: ${result.pagination.totalPages === 9 ? '✅' : '❌'}`);
  console.log(`Has next:        ${result.pagination.hasNext ? '✅' : '❌'}`);
  console.log(`Has previous:    ${result.pagination.hasPrevious ? '✅' : '❌'}\n`);

  console.log('=== All Smoke Tests Complete ===');
}

runTests().catch(console.error);
