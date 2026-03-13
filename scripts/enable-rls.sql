-- تفعيل RLS على جدول tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- إزالة أي سياسة سابقة (إذا وجدت)
DROP POLICY IF EXISTS tenant_isolation ON tenants;

-- إنشاء سياسة جديدة تستخدم متغير جلسة app.current_tenant_id
CREATE POLICY tenant_isolation ON tenants
    FOR ALL
    TO PUBLIC
    USING (
        -- إذا كان المستخدم هو صاحب الصف (أي أن tenant_id يساوي القيمة المخزنة في متغير الجلسة)
        -- نستخدم COALESCE للتعامل مع الحالات التي لا يكون فيها المتغير معيناً (ترجع false)
        tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ملاحظة: الدالة current_setting تبحث عن متغير جلسة باسم app.current_tenant_id
-- المعامل الثاني true يعني عدم رمي خطأ إذا كان المتغير غير موجود، بل إرجاع NULL
-- إذا كان NULL، نعوض بقيمة افتراضية (صفرية) لن تتطابق مع أي tenant_id حقيقي
