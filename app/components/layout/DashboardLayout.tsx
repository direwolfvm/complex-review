'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CaseEvent } from '@/lib/types/database';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    email?: string;
  };
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<CaseEvent[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('case_event')
      .select('*')
      .eq('type', 'notification')
      .eq('assigned_entity', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    setNotifications(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const markAsRead = async (notificationId: number) => {
    const notification = notifications.find(n => n.id === notificationId);
    await supabase
      .from('case_event')
      .update({
        status: 'completed',
        other: {
          ...(notification?.other as Record<string, unknown> || {}),
          read: true,
          read_at: new Date().toISOString(),
        },
      })
      .eq('id', notificationId);

    setNotifications(notifications.filter(n => n.id !== notificationId));
  };

  const unreadCount = notifications.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center space-x-2 text-xl font-bold text-gray-900">
                <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
                  <rect x="14" y="22" width="4" height="8" rx="1" fill="#854d0e"/>
                  <polygon points="16,2 24,12 20,12 26,20 6,20 12,12 8,12" fill="#22c55e"/>
                </svg>
                <span>Review Works</span>
              </Link>
              <nav className="hidden md:flex space-x-4">
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/dashboard'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/cases"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname.startsWith('/cases') || pathname.startsWith('/case')
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Cases
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 text-center">
                          No new notifications
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="p-4 border-b border-gray-100 hover:bg-gray-50"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.name}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                  {notification.description}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notification.created_at).toLocaleString()}
                                </p>
                              </div>
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                              >
                                Mark read
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
