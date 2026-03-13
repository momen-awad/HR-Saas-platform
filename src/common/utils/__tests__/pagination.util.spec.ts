// src/common/utils/__tests__/pagination.util.spec.ts
import 'reflect-metadata';
import { PaginationHelper } from '../pagination.util';
import { PaginationQueryDto } from '../../dto/pagination-query.dto';


describe('PaginationHelper', () => {
  describe('parse', () => {
    it('should parse default values', () => {
      const query = new PaginationQueryDto();
      const params = PaginationHelper.parse(query);
      expect(params.page).toBe(1);
      expect(params.perPage).toBe(20);
      expect(params.offset).toBe(0);
    });

    it('should calculate correct offset', () => {
      const query = new PaginationQueryDto();
      query.page = 3;
      query.perPage = 10;
      const params = PaginationHelper.parse(query);
      expect(params.offset).toBe(20); // (3-1) * 10
    });

    it('should clamp page to minimum 1', () => {
      const query = new PaginationQueryDto();
      query.page = -5;
      const params = PaginationHelper.parse(query);
      expect(params.page).toBe(1);
    });

    it('should clamp perPage to maximum 100', () => {
      const query = new PaginationQueryDto();
      query.perPage = 500;
      const params = PaginationHelper.parse(query);
      expect(params.perPage).toBe(100);
    });
  });

  describe('createResult', () => {
    it('should build correct pagination meta', () => {
      const query = new PaginationQueryDto();
      query.page = 2;
      query.perPage = 10;

      const result = PaginationHelper.createResult(
        Array(10).fill({ id: 'test' }),
        95,
        query,
      );

      expect(result.pagination.total).toBe(95);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should report no next page on last page', () => {
      const query = new PaginationQueryDto();
      query.page = 5;
      query.perPage = 20;

      const result = PaginationHelper.createResult([], 100, query);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should report no previous page on first page', () => {
      const query = new PaginationQueryDto();
      query.page = 1;
      query.perPage = 20;

      const result = PaginationHelper.createResult([], 100, query);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('should handle zero total', () => {
      const query = new PaginationQueryDto();
      const result = PaginationHelper.createResult([], 0, query);

      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
    });
  });
});
