'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface PublicHeaderProps {
  user: User | null;
}

export default function PublicHeader({ user }: PublicHeaderProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/developers', label: 'Developers' },
  ];

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <rect x="14" y="22" width="4" height="8" rx="1" fill="#854d0e"/>
              <polygon points="16,2 24,12 20,12 26,20 6,20 12,12 8,12" fill="#22c55e"/>
            </svg>
            <span className="font-bold text-xl text-gray-900">Review Works</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
