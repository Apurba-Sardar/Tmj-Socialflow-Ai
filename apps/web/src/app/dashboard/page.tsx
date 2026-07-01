import { redirect } from 'next/navigation';

import { EnterpriseDashboard } from '@/components/dashboard/enterprise-dashboard';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <EnterpriseDashboard user={user} />;
}
