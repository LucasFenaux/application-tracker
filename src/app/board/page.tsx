import { getJobsWithMatchScores } from '@/app/actions';
import KanbanBoard from '@/components/KanbanBoard';
import NewJobModal from '@/components/NewJobModal';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const jobs = await getJobsWithMatchScores();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Application Board</h1>
        <NewJobModal />
      </div>
      
      <KanbanBoard initialJobs={jobs} />
    </div>
  );
}
