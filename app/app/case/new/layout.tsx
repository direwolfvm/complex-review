import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { requireTenantContext } from '@/lib/tenant/server';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  const { tenantId } = await requireTenantContext(user.id);

  return (
    <DashboardLayout user={{ id: user.id, email: user.email }} tenantId={tenantId}>
      {children}
    </DashboardLayout>
  );
}
