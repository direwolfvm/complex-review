import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Review Works",
  description: "Review Works - Case and task management for environmental review processes",
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read from server environment at runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || process.env.CANONICAL_TENANT_SLUG || 'reviewworks';
  
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = { NEXT_PUBLIC_SUPABASE_URL: '${supabaseUrl}', NEXT_PUBLIC_SUPABASE_ANON_KEY: '${supabaseKey}', NEXT_PUBLIC_TENANT_SLUG: '${tenantSlug}' };`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
