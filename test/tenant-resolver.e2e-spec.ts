import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { Pool } from 'pg';
import { PG_POOL } from '../src/database/database.providers';

describe('TenantResolverMiddleware (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    pool = app.get(PG_POOL);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(async () => {
    // تنظيف وإدراج tenant اختباري قبل كل اختبار
    await pool.query(
      `INSERT INTO tenants (id, name, slug, status) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) DO NOTHING`,
      ['11111111-1111-1111-1111-111111111111', 'TestCo', 'testco', 'active'],
    );
  });

  it('should reject requests without tenant header', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });
  });

  it('should reject requests with invalid UUID format', () => {
    return request(app.getHttpServer())
      .get('/health')
      .set('X-Tenant-ID', 'not-a-uuid')
      .expect(401);
  });

  it('should accept requests with valid tenant header', () => {
    return request(app.getHttpServer())
      .get('/health')
      .set('X-Tenant-ID', '11111111-1111-1111-1111-111111111111')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('should reject suspended tenant', async () => {
    // تحديث حالة tenant إلى suspended
    await pool.query(
      `UPDATE tenants SET status = 'suspended' WHERE id = $1`,
      ['11111111-1111-1111-1111-111111111111'],
    );

    return request(app.getHttpServer())
      .get('/health')
      .set('X-Tenant-ID', '11111111-1111-1111-1111-111111111111')
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(res.body.error.message).toContain('suspended');
      });
  });
});
