'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Globe,
  Image,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Radio,
  Sparkles,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';

import { BrandIcon } from '@/components/brand/brand-icon';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/env';

import type { Route } from 'next';

interface AppHeaderProps {
  user?: {
    email: string;
    role?: string;
    displayName?: string;
  } | null;
}

interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/scheduler', label: 'Scheduler', icon: Calendar },
  { href: '/ai-pipeline', label: 'AI Pipeline', icon: Sparkles },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/wordpress-hub', label: 'WordPress Hub', icon: Globe },
  { href: '/media-library', label: 'Media', icon: Image },
  { href: '/admin/channels', label: 'Channels', icon: Radio },
];

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sf-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sf-theme', 'light');
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
    window.location.href = '/login';
  }

  return (
    <header className="sf-premium-header sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2.5 transition-transform active:scale-95"
          >
            <BrandIcon className="h-9 w-9 transition-transform group-hover:scale-105" priority />
            <div className="flex flex-col">
              <span className="font-display text-base font-extrabold tracking-tight text-foreground">
                TMJ SocialFlow
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                AI Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary dark:bg-primary/20'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions Header */}
        <div className="flex items-center gap-2.5">
          {/* Theme Switcher */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl border border-border/50 text-muted-foreground transition-colors hover:text-foreground"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Profile & Logout */}
          {user ? (
            <div className="hidden items-center gap-3 pl-2 sm:flex">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground">
                  {user.displayName ?? user.email.split('@')[0]}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {user.role ?? 'Member'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleLogout();
                }}
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </Button>
            </div>
          ) : null}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
            }}
            className="h-9 w-9 rounded-xl md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen ? (
        <div className="sf-page-enter border-b border-border bg-background/95 px-4 pb-4 pt-2 backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {user ? (
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">
                  {user.displayName ?? user.email}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {user.role ?? 'Member'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleLogout();
                }}
                className="gap-1.5 rounded-lg text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
