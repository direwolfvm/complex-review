import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PublicHeader from '@/components/layout/PublicHeader';

export default async function AboutPage() {
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">About Review Works</h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Review Works is a modern environmental review management platform designed to streamline
            the review and approval process through role-based workflows.
          </p>
        </section>

        {/* Mission Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <div className="prose prose-lg text-gray-600">
            <p>
              We believe that environmental review processes should be transparent, efficient, and collaborative.
              Review Works was built to reduce friction in government workflows while maintaining
              the rigor and compliance requirements that agencies need.
            </p>
            <p>
              By digitizing and standardizing review workflows, we help agencies process
              applications faster, reduce administrative burden, and provide all stakeholders with
              clear visibility into case status and progress.
            </p>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">5-Step Workflow</h3>
              <p className="mt-2 text-gray-600">
                A structured workflow guides cases from initial submission through
                analyst review to final approval, with clear handoffs between roles.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Role-Based Access</h3>
              <p className="mt-2 text-gray-600">
                Three distinct roles (Applicant, Analyst, Approver) ensure the right people
                handle each step. Users only see tasks relevant to their role.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Document Collaboration</h3>
              <p className="mt-2 text-gray-600">
                Built-in markdown editor allows applicants and analysts to create
                and edit documents directly in the system with side-by-side review.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Complete Audit Trail</h3>
              <p className="mt-2 text-gray-600">
                Every action is logged as a case event, creating a complete timeline
                of each application from submission through final decision.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Architecture Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Technical Architecture</h2>
          <p className="text-gray-600 mb-4">
            Review Works is built on modern, proven technologies designed for reliability and scalability:
          </p>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 mr-2">Next.js 14 + TypeScript:</span>
              A type-safe frontend with server components for excellent performance and developer experience.
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 mr-2">Tailwind CSS:</span>
              Utility-first CSS framework for consistent, responsive design.
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 mr-2">Supabase (PostgreSQL):</span>
              A robust database backend with built-in authentication, row-level security, and REST API.
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-900 mr-2">React JSON Schema Form:</span>
              Dynamic forms generated from JSON Schema definitions stored in the database.
            </li>
          </ul>
        </section>

        {/* Data Model Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Model</h2>
          <p className="text-gray-600 mb-6">
            Review Works uses a flexible data model that separates workflow definitions from case data:
          </p>
          <div className="space-y-4">
            {[
              { title: 'Process Model', desc: 'Defines a workflow type with its required decision elements and steps.' },
              { title: 'Decision Element', desc: 'A specific step within a process, including required role and form schema.' },
              { title: 'Project', desc: 'The case record containing project information and assigned users.' },
              { title: 'Process Instance', desc: 'A specific case in progress, tracking current step and status.' },
              { title: 'Decision Payload', desc: 'Stores form data and decisions for each completed step.' },
              { title: 'Document', desc: 'Markdown documents created by applicants and analysts.' },
              { title: 'Case Event', desc: 'Tasks, notifications, and milestone records tracking case lifecycle.' },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-gray-100 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900">{title}</h4>
                <p className="text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow Overview Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Workflow Overview</h2>
          <div className="space-y-4">
            {[
              { step: 1, title: 'Authentication', desc: 'User signs in and is assigned tasks based on their role.', role: 'System' },
              { step: 2, title: 'Project Information', desc: 'Applicant creates the case and provides project details via a dynamic form.', role: 'Applicant' },
              { step: 3, title: 'Applicant Document', desc: 'Applicant drafts the initial analysis document for review.', role: 'Applicant' },
              { step: 4, title: 'Analyst Review', desc: 'Analyst reviews the submission and creates the environmental analysis.', role: 'Analyst' },
              { step: 5, title: 'Approval', desc: 'Approver reviews the analysis and approves or requests revisions.', role: 'Approver' },
            ].map(({ step, title, desc, role }) => (
              <div key={step} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  {step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-gray-900">{title}</h4>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">{role}</span>
                  </div>
                  <p className="text-gray-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-green-50 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Ready to Get Started?</h2>
          <p className="mt-2 text-gray-600">
            Whether you&apos;re an applicant looking to submit a review or a developer
            wanting to integrate with Review Works, we&apos;re here to help.
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/developers"
              className="px-6 py-3 border border-green-600 text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors"
            >
              Developer Resources
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
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
