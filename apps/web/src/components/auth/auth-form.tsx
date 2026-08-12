'use client';

import { useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { BrandIcon } from '@/components/brand/brand-icon';
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
  const [showPassword, setShowPassword] = useState(false);

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

    let response: Response;

    try {
      response = await fetch(`${getApiBaseUrl()}/api/auth/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      setLoading(false);
      setError('The API is not reachable. Please start the backend and try again.');
      return;
    }

    setLoading(false);

    if (!response.ok) {
      const message = await getErrorMessage(response);
      setError(message);
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
    <Card className="sf-card sf-card-hover w-full max-w-md border-white/20 bg-background/85 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/88">
      <CardHeader className="pb-6">
        <div className="mb-3 flex items-center justify-between">
          <BrandIcon className="h-11 w-11 transition-transform hover:scale-105" priority />
          <span className="sf-section-kicker">SocialFlow AI</span>
        </div>
        <CardTitle className="font-display mt-2 text-3xl font-extrabold tracking-[-0.03em]">
          {titleForMode(mode)}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {descriptionForMode(mode)}
        </CardDescription>
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
            <Field
              label="User ID or Email"
              name="email"
              autoComplete="username"
              placeholder="name@example.com"
            />
          ) : null}
          {mode === 'login' || mode === 'register' || mode === 'reset-password' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">
                  {mode === 'reset-password' ? 'New password' : 'Password'}
                </Label>
                {mode === 'login' ? (
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'login' ? undefined : 12}
                  placeholder={mode === 'login' ? 'Enter your password' : '••••••••••••'}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword((prev) => !prev);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode !== 'login' ? (
                <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="sf-page-enter rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="sf-page-enter rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-200">
              {success}
            </p>
          ) : null}
          <Button
            className="w-full font-medium shadow-md transition-all hover:shadow-lg active:scale-[0.99]"
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {buttonForMode(mode)}
          </Button>
        </form>

        <div className="mt-6 border-t border-border/50 pt-4 text-center text-xs text-muted-foreground">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Create one now
              </Link>
            </p>
          ) : mode === 'register' ? (
            <p>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          ) : (
            <p>
              Back to{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
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
  minLength,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required={required}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };

    if (Array.isArray(payload.message)) {
      return payload.message.join(' ');
    }

    if (payload.message) {
      return payload.message;
    }
  } catch {
    // Fall through to the generic message below.
  }

  return 'The request could not be completed. Please check your details and try again.';
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
    login: 'Access your TMJ SocialFlow AI workspace.',
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
