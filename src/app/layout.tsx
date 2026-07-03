import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Briefcase, LayoutDashboard, Calendar, FolderOpen, Settings, Globe, Puzzle } from 'lucide-react';
import ChatBot from '@/components/ChatBot';

export const metadata: Metadata = {
  title: 'Application Tracker',
  description: 'Track your job applications and materials',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <aside className="sidebar glass-panel">
            <div className="brand">
              <Briefcase size={28} color="var(--accent-color)" />
              <h1>AppTracker</h1>
            </div>
            
            <nav className="nav-links">
              <Link href="/" className="nav-item">
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>
              <Link href="/board" className="nav-item">
                <Briefcase size={20} />
                <span>Kanban Board</span>
              </Link>
              <Link href="/materials" className="nav-item">
                <FolderOpen size={20} />
                <span>Materials</span>
              </Link>
              <Link href="/calendar" className="nav-item">
                <Calendar size={20} />
                <span>Activity</span>
              </Link>
              <Link href="/scraper" className="nav-item">
                <Globe size={20} />
                <span>Scraper</span>
              </Link>
              <Link href="/extension" className="nav-item">
                <Puzzle size={20} />
                <span>Extension</span>
              </Link>
              <Link href="/settings" className="nav-item">
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </nav>
            
            <div className="user-profile">
              <div className="avatar">LF</div>
              <div className="user-info">
                <div className="user-name">Lucas Fenaux</div>
                <div className="user-role">PhD Candidate</div>
              </div>
            </div>
          </aside>
          
          <main className="main-content">
            {children}
          </main>
          <ChatBot />
        </div>
      </body>
    </html>
  );
}
