import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PublicHeader from '@/components/layout/PublicHeader';

export default async function LandingPage() {
  let user = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase not configured, continue as unauthenticated
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader user={user} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-700 to-green-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Value proposition */}
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                Streamline Environmental Reviews
              </h1>
              <p className="mt-6 text-xl text-green-100">
                Review Works simplifies the environmental review process with guided workflows,
                role-based collaboration, and efficient approval tracking.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-300 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg">5-step guided workflow</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-300 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg">Role-based access control</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-300 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg">Real-time collaboration between roles</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-300 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg">Complete audit trail</span>
                </div>
              </div>
            </div>

            {/* Right side - Login card */}
            <div className="bg-white rounded-xl shadow-xl p-8 text-gray-900">
              {user ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-900">Welcome back!</h2>
                  <p className="mt-2 text-gray-600">
                    You&apos;re signed in as <strong>{user.email}</strong>
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-6 block w-full text-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900">Get Started</h2>
                  <p className="mt-2 text-gray-600">
                    Sign in to submit environmental reviews, analyze cases, or approve applications.
                  </p>
                  <Link
                    href="/login"
                    className="mt-6 block w-full text-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Sign In
                  </Link>
                  <p className="mt-4 text-sm text-gray-500 text-center">
                    New to Review Works? Contact your administrator for an account.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Info Panels Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* About Panel */}
            <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">About Review Works</h3>
              <p className="mt-2 text-gray-600">
                Learn how Review Works modernizes environmental review management with role-based workflows,
                document collaboration, and transparent approval processes.
              </p>
              <Link
                href="/about"
                className="mt-4 inline-flex items-center text-green-600 font-medium hover:text-green-700"
              >
                Learn More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Developer Resources Panel */}
            <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Developer Resources</h3>
              <p className="mt-2 text-gray-600">
                Integrate your systems with Review Works using our REST API.
                Create cases, manage workflows, and track events programmatically.
              </p>
              <Link
                href="/developers"
                className="mt-4 inline-flex items-center text-blue-600 font-medium hover:text-blue-700"
              >
                View API Docs
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid md:grid-cols-5 gap-6">
            {[
              { step: 1, title: 'Authenticate', desc: 'Sign in to access the system based on your role.' },
              { step: 2, title: 'Project Info', desc: 'Applicant provides project details and requirements.' },
              { step: 3, title: 'Draft Document', desc: 'Applicant prepares the initial analysis document.' },
              { step: 4, title: 'Analyst Review', desc: 'Analyst reviews and creates environmental analysis.' },
              { step: 5, title: 'Approval', desc: 'Approver reviews and makes the final decision.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto">
                  {step}
                </div>
                <h4 className="mt-4 font-semibold text-gray-900">{title}</h4>
                <p className="mt-2 text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Role-Based Workflow</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Review Works assigns tasks to users based on their role, ensuring the right people
            handle each step of the review process.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold mb-4">
                A
              </div>
              <h3 className="text-lg font-bold text-gray-900">Applicant</h3>
              <p className="mt-2 text-gray-600 text-sm">
                Creates cases, provides project information, and drafts the initial analysis document.
                Handles Steps 1-3 of the workflow.
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
              <div className="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center font-bold mb-4">
                R
              </div>
              <h3 className="text-lg font-bold text-gray-900">Analyst</h3>
              <p className="mt-2 text-gray-600 text-sm">
                Reviews the applicant&apos;s submission and produces the environmental analysis document.
                Handles Step 4 of the workflow.
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <div className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold mb-4">
                P
              </div>
              <h3 className="text-lg font-bold text-gray-900">Approver</h3>
              <p className="mt-2 text-gray-600 text-sm">
                Reviews the completed analysis and makes the final approval decision.
                Can approve or request revisions. Handles Step 5.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                <rect x="14" y="22" width="4" height="8" rx="1" fill="#854d0e"/>
                <polygon points="16,2 24,12 20,12 26,20 6,20 12,12 8,12" fill="#22c55e"/>
              </svg>
              <span className="font-semibold text-white">Review Works</span>
            </div>
            <div className="flex space-x-6">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/developers" className="hover:text-white transition-colors">Developers</Link>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
