import { Suspense } from 'react';

import { AuthForm } from '../../../components/auth/auth-form';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="verify-email" />
    </Suspense>
  );
}
