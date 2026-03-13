#!/bin/bash

# ========================================
# ✅ Full System Test Script
# Checks health, tenant context, invalid tenant, tenant list
# ========================================

BASE_URL="http://localhost:3000"
TENANT_ID="11111111-1111-1111-1111-111111111111"

echo "======================================="
echo "1️⃣ Health Check (no tenant) - should fail"
echo "======================================="
curl -s -w "\nHTTP STATUS: %{http_code}\n\n" $BASE_URL/health

echo "======================================="
echo "2️⃣ Health Check (with tenant) - should succeed"
echo "======================================="
curl -s -H "X-Tenant-ID: $TENANT_ID" -w "\nHTTP STATUS: %{http_code}\n\n" $BASE_URL/health

echo "======================================="
echo "3️⃣ Tenant Debug - valid tenant"
echo "======================================="
curl -s -H "X-Tenant-ID: $TENANT_ID" -w "\nHTTP STATUS: %{http_code}\n\n" $BASE_URL/api/v1/debug/tenant

echo "======================================="
echo "4️⃣ Tenant Debug - missing tenant header (should fail)"
echo "======================================="
curl -s -w "\nHTTP STATUS: %{http_code}\n\n" $BASE_URL/api/v1/debug/tenant

echo "======================================="
echo "5️⃣ Tenant Debug - invalid UUID (should fail)"
echo "======================================="
curl -s -H "X-Tenant-ID: garbage" -w "\nHTTP STATUS: %{http_code}\n\n" $BASE_URL/api/v1/debug/tenant

echo "======================================="
echo "6️⃣ Tenant List - should return all tenants"
echo "======================================="
curl -s -H "X-Tenant-ID: $TENANT_ID" -w "\nHTTP STATUS: %{http_code}\n\n" $BASE_URL/api/v1/debug/tenants

echo "======================================="
echo "✅ All tests completed"
echo "======================================="
