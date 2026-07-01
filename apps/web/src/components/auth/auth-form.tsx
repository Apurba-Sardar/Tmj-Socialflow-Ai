'use client';

import { useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiBaseUrl } from '@/lib/env';

type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email';

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const endpoint = endpointForMode(mode);

    if (mode === 'reset-password' || mode === 'verify-email') {
      payload.token = searchParams.get('token') ?? '';
    }

    const response = await fetch(`${getApiBaseUrl()}/api/auth/${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!response.ok) {
      setError('The request could not be completed. Please check your details and try again.');
      return;
    }

    if (mode === 'login' || mode === 'register') {
      router.replace('/dashboard');
      router.refresh();
      return;
    }

    setSuccess(successMessage(mode));
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{titleForMode(mode)}</CardTitle>
        <CardDescription>{descriptionForMode(mode)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          {mode === 'register' ? (
            <Field label="Display name" name="displayName" autoComplete="name" required={false} />
          ) : null}
          {mode !== 'reset-password' && mode !== 'verify-email' ? (
            <Field label="Email" name="email" type="email" autoComplete="email" />
          ) : null}
          {mode === 'login' || mode === 'register' || mode === 'reset-password' ? (
            <Field
              label={mode === 'reset-password' ? 'New password' : 'Password'}
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {buttonForMode(mode)}
          </Button>
        </form>
        <AuthLinks mode={mode} />
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} autoComplete={autoComplete} required={required} />
    </div>
  );
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  if (mode === 'login') {
    return (
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link className="text-primary" href="/register">Create account</Link>
        <Link className="text-primary" href="/forgot-password">Forgot password</Link>
      </div>
    );
  }

  return (
    <p className="mt-6 text-sm text-muted-foreground">
      Already have an account? <Link className="text-primary" href="/login">Sign in</Link>
    </p>
  );
}

function endpointForMode(mode: AuthMode): string {
  return mode;
}

function titleForMode(mode: AuthMode): string {
  return {
    login: 'Sign in',
    register: 'Create account',
    'forgot-password': 'Reset access',
    'reset-password': 'Set new password',
    'verify-email': 'Verify email',
  }[mode];
}

function descriptionForMode(mode: AuthMode): string {
  return {
    login: 'Access your SocialFlow AI workspace.',
    register: 'Start with a secure account.',
    'forgot-password': 'Receive a password reset link.',
    'reset-password': 'Choose a new secure password.',
    'verify-email': 'Confirm ownership of your email address.',
  }[mode];
}

function buttonForMode(mode: AuthMode): string {
  return {
    login: 'Sign in',
    register: 'Create account',
    'forgot-password': 'Send reset link',
    'reset-password': 'Update password',
    'verify-email': 'Verify email',
  }[mode];
}

function successMessage(mode: AuthMode): string {
  return {
    login: '',
    register: '',
    'forgot-password': 'If an account exists, a reset link has been sent.',
    'reset-password': 'Your password has been updated. You can sign in now.',
    'verify-email': 'Your email is verified.',
  }[mode];
}
