import { Metadata } from 'next';
import AiCleanupClient from './AiCleanupClient';
import { getCleanupStatus, getDeletionSuggestions } from '../actions';

export const metadata: Metadata = {
  title: 'AI Cleanup - Application Tracker',
  description: 'AI tools to clean up and manage scraped job postings',
};

export default async function AiCleanupPage() {
  const cleanupStatus = await getCleanupStatus();
  const suggestions = await getDeletionSuggestions();
  
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>AI Cleanup Hub</h1>
      <AiCleanupClient initialCleanupStatus={cleanupStatus} initialSuggestions={suggestions} />
    </div>
  );
}
