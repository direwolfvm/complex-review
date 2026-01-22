import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { CaseEvent, ProcessInstance, Project, CaseEventWorkflowMeta, ProcessInstanceWorkflowMeta, ProjectWorkflowMeta } from '@/lib/types/database';

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    'in progress': 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    underway: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user's role assignments
  const { data: assignments } = await supabase
    .from('user_assignments')
    .select('user_role')
    .eq('user_id', user.id);

  const roleIds = assignments?.map(a => a.user_role) || [];

  // Get pending tasks assigned to user
  const { data: allTasks } = await supabase
    .from('case_event')
    .select(`
      *,
      process_instance:parent_process_id(
        *,
        project:parent_project_id(*)
      )
    `)
    .eq('type', 'task')
    .in('status', ['pending', 'in progress'])
    .order('created_at', { ascending: false });

  // Filter tasks for this user
  const tasks = (allTasks || []).filter(task => {
    const meta = task.other as CaseEventWorkflowMeta;
    return (
      task.assigned_entity === user.id ||
      (meta?.assigned_user_id === user.id) ||
      (meta?.assigned_role_id && roleIds.includes(meta.assigned_role_id))
    );
  });

  // Get user's cases (where they are applicant or assigned)
  const { data: allCases } = await supabase
    .from('process_instance')
    .select(`
      *,
      project:parent_project_id(*)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter cases where user is involved
  const cases = (allCases || []).filter(c => {
    const project = c.project as unknown as Project;
    const projectMeta = (project?.other as ProjectWorkflowMeta) || {};
    return (
      projectMeta.applicant_user_id === user.id ||
      projectMeta.analyst_user_id === user.id ||
      projectMeta.approver_user_id === user.id
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here&apos;s what needs your attention.</p>
        </div>
        <Link
          href="/case/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Case
        </Link>
      </div>

      {/* My Tasks Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Tasks</h2>
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="mt-4 text-gray-500">No pending tasks. You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Case
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Step
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => {
                  const processInstance = task.process_instance as unknown as ProcessInstance & { project: Project };
                  const project = processInstance?.project;
                  const meta = task.other as CaseEventWorkflowMeta;

                  return (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{task.name}</div>
                        <div className="text-sm text-gray-500">{task.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{project?.title || 'Untitled Project'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">Step {meta?.step_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={task.status || 'pending'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(task.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/step/${meta?.step_number || 2}/${processInstance?.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Go to task
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* My Cases Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Cases</h2>
          <Link href="/cases" className="text-sm text-blue-600 hover:text-blue-800">
            View all
          </Link>
        </div>
        {cases.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="mt-4 text-gray-500">No cases yet.</p>
            <Link
              href="/case/new"
              className="mt-4 inline-flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Start your first case
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.slice(0, 6).map((c) => {
              const project = c.project as unknown as Project;
              const meta = c.other as ProcessInstanceWorkflowMeta;

              return (
                <Link
                  key={c.id}
                  href={`/case/${c.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-medium text-gray-900">
                      {project?.title || 'Untitled Project'}
                    </h3>
                    <StatusBadge status={c.status || 'draft'} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{c.stage || 'Getting started'}</p>
                  <div className="mt-3 flex items-center text-xs text-gray-400">
                    <span>Step {meta?.current_step || 1} of 5</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
