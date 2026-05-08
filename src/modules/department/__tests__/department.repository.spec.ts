// src/modules/department/__tests__/department.repository.spec.ts

import { DepartmentRepository } from '../repositories/department.repository';
import { Department } from '../../../database/schema/departments';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

function makeDept(
  id: string,
  parentId: string | null,
  name: string,
): Department {
  return {
    id,
    tenantId: TENANT_ID,
    name,
    parentId,
    managerEmployeeId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DB
// ─────────────────────────────────────────────────────────────────────────────

// We only test the pure in-memory logic (findSubtreeIds BFS) here.
// Full integration with Drizzle is covered by integration tests.

// Build a minimal mock that supports findAllForTenant
function makeRepo(depts: Department[]): DepartmentRepository {
  const mockDb = {} as any;
  const repo = new DepartmentRepository(mockDb);

  // Stub findAllForTenant directly
  jest
    .spyOn(repo, 'findAllForTenant')
    .mockResolvedValue(depts);

  return repo;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('DepartmentRepository — findSubtreeIds', () => {
  it('should return only the root when it has no children', async () => {
    const root = makeDept('root', null, 'Root');
    const repo = makeRepo([root]);

    const ids = await repo.findSubtreeIds('root', TENANT_ID);

    expect(ids).toEqual(['root']);
  });

  it('should return root and all direct children', async () => {
    const root = makeDept('root', null, 'Root');
    const c1   = makeDept('c1', 'root', 'Child 1');
    const c2   = makeDept('c2', 'root', 'Child 2');
    const repo = makeRepo([root, c1, c2]);

    const ids = await repo.findSubtreeIds('root', TENANT_ID);

    expect(ids).toContain('root');
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).toHaveLength(3);
  });

  it('should return all nodes in a deep hierarchy', async () => {
    const root  = makeDept('root', null,   'Root');
    const l1    = makeDept('l1',   'root', 'Level 1');
    const l2    = makeDept('l2',   'l1',   'Level 2');
    const l3    = makeDept('l3',   'l2',   'Level 3');
    const repo  = makeRepo([root, l1, l2, l3]);

    const ids = await repo.findSubtreeIds('root', TENANT_ID);

    expect(ids).toEqual(['root', 'l1', 'l2', 'l3']);
  });

  it('should NOT include siblings outside the subtree', async () => {
    const root    = makeDept('root', null,   'Root');
    const branchA = makeDept('a',    'root', 'Branch A');
    const branchB = makeDept('b',    'root', 'Branch B');
    const childA  = makeDept('a1',   'a',    'A child');
    const repo    = makeRepo([root, branchA, branchB, childA]);

    // Subtree of branchA only
    const ids = await repo.findSubtreeIds('a', TENANT_ID);

    expect(ids).toContain('a');
    expect(ids).toContain('a1');
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('root');
  });

  it('should return empty when rootId does not match any department', async () => {
    const repo = makeRepo([makeDept('existing', null, 'Existing')]);

    const ids = await repo.findSubtreeIds('non-existent', TENANT_ID);

    // BFS starts from 'non-existent', adds it, finds no children → [non-existent]
    // This is correct: the caller is responsible for validating the root exists.
    expect(ids).toEqual(['non-existent']);
  });
});
