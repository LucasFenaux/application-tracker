import { getAllMaterials } from '@/app/actions';
import UploadMaterialModal from '@/components/UploadMaterialModal';
import DeleteMaterialButton from '@/components/DeleteMaterialButton';
import { FileText, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function MaterialsPage() {
  const materials = await getAllMaterials();
  const profiles = materials.filter((m: any) => m.is_profile);
  const attachments = materials.filter((m: any) => !m.is_profile);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Materials Library</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your resumes, cover letters, and matching profiles.</p>
        </div>
        <UploadMaterialModal />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--accent-color)' }}>AI Matching Profile</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          These documents (.tex, .bib, etc.) are embedded locally to compute Match Scores for your job applications.
        </p>
        <div className="materials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {profiles.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
              No profile materials yet. Upload your LaTeX resume and check "Use this document for AI Job Matching" to get started!
            </div>
          ) : (
            profiles.map((material: any) => (
              <div key={material.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <FileText size={32} color="var(--accent-color)" />
                  <span className="kanban-badge">{material.type}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {material.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {material.uploaded_at ? `${formatDistanceToNow(new Date(material.uploaded_at))} ago` : 'recently'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <a href={`/uploads/${material.filename}`} download className="btn-secondary" style={{ flex: 1, padding: '0.5rem', justifyContent: 'center' }}>
                    <Download size={16} /> Download
                  </a>
                  <DeleteMaterialButton id={material.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Other Documents</h2>
        <div className="materials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {attachments.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
              No other documents found.
            </div>
          ) : (
            attachments.map((material: any) => (
              <div key={material.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <FileText size={32} color="#94a3b8" />
                  <span className="kanban-badge">{material.type}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {material.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Added {formatDistanceToNow(new Date(material.uploaded_at), { addSuffix: true })}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <a href={`/uploads/${material.filename}`} download className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                    <Download size={16} /> Download
                  </a>
                  <DeleteMaterialButton id={material.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
