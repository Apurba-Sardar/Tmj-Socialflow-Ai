import { redirect } from 'next/navigation';

import { AiPipeline } from '@/components/ai-pipeline/ai-pipeline';
import { getCurrentUser } from '@/lib/auth';

export default async function AiPipelinePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <AiPipeline user={user} />;
}
