import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantContextForUser } from '@/lib/tenant/server';
import SignOutButton from './SignOutButton';

// Signed in, but no active Review Works membership: a Login.gov user whose email is not
// a verified .gov or .mil address, or a password account nobody has added to the tenant.
export default async function NotEnrolledPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let enrolled = false;
  try {
    await getTenantContextForUser(user.id);
    enrolled = true;
  } catch {
    // Expected: no active membership.
  }
  if (enrolled) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Your account is not enrolled</h1>
        <p className="text-gray-600">
          You are signed in{user.email ? <> as <strong>{user.email}</strong></> : null}, but this account
          does not have access to Review Works. Ask an administrator to add you.
        </p>
        <p className="text-sm text-gray-500">
          Login.gov accounts with a verified .gov or .mil email address are enrolled automatically.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
