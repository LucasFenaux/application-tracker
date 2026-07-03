import { getActivities } from '@/app/actions';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import { Target, Flame } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const activities = await getActivities();

  // Simple streak calculation
  let streak = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const hasActivityToday = activities.some((a: any) => a.date === todayStr);

  // Calculate this week's applications
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay(); // 0 = Sunday, 1 = Monday
  // Assume week starts on Monday
  const diff = todayDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const startOfWeek = new Date(todayDate.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);

  let weeklyAppliedCount = 0;
  activities.forEach((a: any) => {
    // 'a.date' is YYYY-MM-DD which parses to UTC midnight if we just do new Date(a.date).
    // Let's ensure local comparison by parsing the parts or just string comparison if we format startOfWeek.
    const activityDate = new Date(a.date + 'T00:00:00'); 
    if (activityDate >= startOfWeek) {
      const appliedMatches = a.actions.match(/Moved to Applied/g);
      if (appliedMatches) {
        weeklyAppliedCount += appliedMatches.length;
      }
    }
  });

  const weeklyGoal = 5;
  const progressPercent = Math.min(100, Math.round((weeklyAppliedCount / weeklyGoal) * 100));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Activity & Habits</h1>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Flame size={24} color="#f59e0b" />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Current Streak</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
            {hasActivityToday ? '1' : '0'} Days
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Apply to jobs consistently to build your streak!
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Target size={24} color="var(--accent-color)" />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Weekly Goal</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Goal: 5 Applications per week.
          </p>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--accent-color)' }}></div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
            {weeklyAppliedCount} / {weeklyGoal} applied
          </p>
        </div>
      </div>

      <ActivityHeatmap activities={activities} />
      
      <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Recent Log</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activities.slice(-10).reverse().map((a: any) => (
            <div key={a.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{a.date}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{a.actions}</span>
            </div>
          ))}
          {activities.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>No activity yet.</span>}
        </div>
      </div>
    </div>
  );
}
