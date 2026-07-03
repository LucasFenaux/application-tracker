import { getExtensionJobs } from '@/app/actions';
import ExtensionClient from './ExtensionClient';

export const dynamic = 'force-dynamic';

export default async function ExtensionPage() {
  const jobs = await getExtensionJobs();

  return (
    <ExtensionClient initialJobs={jobs} />
  );
}
