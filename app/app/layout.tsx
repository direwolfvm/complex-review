import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Review Works",
  description: "Review Works - Case and task management for environmental review processes",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
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
  
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = { NEXT_PUBLIC_SUPABASE_URL: '${supabaseUrl}', NEXT_PUBLIC_SUPABASE_ANON_KEY: '${supabaseKey}' };`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
