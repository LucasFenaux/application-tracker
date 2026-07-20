import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;
let lastBackupCheck = 0;

export function getDb() {
  if (!db) {
    const dataDir = process.env.APP_DATA_DIR || (process.cwd() + '/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = process.env.SQLITE_DB_PATH || path.join(dataDir, 'tracker.db');
    db = new Database(dbPath);
    
    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        stage TEXT NOT NULL DEFAULT 'Queue',
        url TEXT,
        notes TEXT,
        vector TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        type TEXT NOT NULL,
        is_profile INTEGER DEFAULT 0,
        vector TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS job_materials (
        job_id INTEGER,
        material_id INTEGER,
        PRIMARY KEY (job_id, material_id),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        action TEXT NOT NULL,
        job_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        is_system_default INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS scraper_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        jobs_found INTEGER DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scraped_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT,
        url TEXT,
        description TEXT,
        source_website TEXT NOT NULL,
        match_score INTEGER,
        goal_match_score INTEGER,
        status TEXT DEFAULT 'pending_review',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        vector TEXT,
        focus_passed INTEGER DEFAULT 1,
        last_focus_evaluated TEXT
      );

      CREATE TABLE IF NOT EXISTS extension_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT,
        url TEXT,
        description TEXT,
        source_website TEXT NOT NULL,
        match_score INTEGER,
        goal_match_score INTEGER,
        status TEXT DEFAULT 'pending_review',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        vector TEXT
      );

      CREATE TABLE IF NOT EXISTS ignored_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration for deleted_at
    try {
      db.exec('ALTER TABLE jobs ADD COLUMN deleted_at DATETIME;');
    } catch (e) {
      // Column might already exist
    }

    // Migration for location in jobs
    try {
      db.exec('ALTER TABLE jobs ADD COLUMN location TEXT;');
    } catch (e) {
      // Column might already exist
    }
    
    try {
      db.exec('ALTER TABLE scraped_jobs ADD COLUMN deleted_at DATETIME;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE scraped_jobs ADD COLUMN is_hidden INTEGER DEFAULT 0;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE extension_jobs ADD COLUMN deleted_at DATETIME;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE scraped_jobs ADD COLUMN goal_match_score INTEGER;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE extension_jobs ADD COLUMN goal_match_score INTEGER;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE jobs ADD COLUMN deadline TEXT;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE jobs ADD COLUMN latest_resume_suggestions TEXT;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE jobs ADD COLUMN original_job_data TEXT;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE scraped_jobs ADD COLUMN original_job_data TEXT;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE extension_jobs ADD COLUMN original_job_data TEXT;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE jobs ADD COLUMN deletion_suggested INTEGER DEFAULT 0;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE scraped_jobs ADD COLUMN deletion_suggested INTEGER DEFAULT 0;');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE extension_jobs ADD COLUMN deletion_suggested INTEGER DEFAULT 0;');
    } catch (e) {}

    // Initialize default settings
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('calibration_mode', 'simple');
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('calibration_min', '0.55');
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('calibration_max', '0.85');
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('calibration_curve', '[]');
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('ai_ollama_model', 'deepseek-r1');
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('ai_provider', 'ollama');

    // Initialize default prompt if it doesn't exist
    const defaultPromptCount = db.prepare('SELECT COUNT(*) as count FROM prompts WHERE is_system_default = 1').get() as { count: number };
    if (defaultPromptCount.count === 0) {
      const defaultContent = `You are an expert technical recruiter and resume writer.
I am applying for the role of "{jobTitle}" at "{companyName}".

Here is the Job Description:
"""
{jobDescription}
"""

Here is my current Resume:
"""
{resumeText}
"""

{contextFiles}

Please suggest exactly 3 to 5 specific, actionable bullet point tweaks I should make to my resume to better align with the job description. Be concise and direct. Format your response in Markdown.`;

      db.prepare('INSERT INTO prompts (name, content, is_active, is_system_default) VALUES (?, ?, 1, 1)').run('System Default', defaultContent);
    }
  }

  const now = Date.now();
  if (now - lastBackupCheck > 60000) {
    lastBackupCheck = now;
    setTimeout(performSmartBackup, 0); 
  }

  return db;
}

async function performSmartBackup() {
  try {


    // Use an EXCLUSIVE transaction to prevent multiple workers from starting a backup simultaneously
    const checkAndLock = db.transaction(() => {
      const lastBackupRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('last_db_backup_time') as any;
      const lastBackupTime = lastBackupRow ? parseInt(lastBackupRow.value, 10) : 0;
      
      // Backup every 12 hours
      if (Date.now() - lastBackupTime < 12 * 60 * 60 * 1000) {
        return false;
      }

      // Immediately set the time so other workers are locked out
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_db_backup_time', Date.now().toString());
      return true;
    });

    const shouldBackup = checkAndLock.exclusive();
    if (!shouldBackup) return;

    const targetDir = path.join(path.dirname(db.name), 'backups');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(targetDir, `tracker_backup_${dateStr}.db`);
    
    // SQLite safe backup
    await db.backup(backupPath);

    // Clean up old backups (keep last 7)
    const files = fs.readdirSync(targetDir)
      .filter(f => f.startsWith('tracker_backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(targetDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 7) {
      for (let i = 7; i < files.length; i++) {
        fs.unlinkSync(path.join(targetDir, files[i].name));
      }
    }
    console.log(`[DB Backup] Successfully created backup at ${backupPath}`);
  } catch (err) {
    console.error('[DB Backup] Smart DB Backup failed:', err);
  }
}

export async function restoreDbFromBackup(backupPath: string) {
  if (!db) {
    throw new Error('Database is not initialized.');
  }

  // 1. Pre-restore backup
  const targetDir = path.join(path.dirname(db.name), 'backups');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const preRestorePath = path.join(targetDir, 'tracker_pre_restore_backup.db');

  // Use the safe backup API to save the current state
  await db.backup(preRestorePath);

  // 2. Close the active connection
  db.close();

  // 3. Overwrite the database file
  const dataDir = process.env.APP_DATA_DIR || (process.cwd() + '/data');
  const dbPath = process.env.SQLITE_DB_PATH || path.join(dataDir, 'tracker.db');
  fs.copyFileSync(backupPath, dbPath);

  // 4. Clear the module reference so it re-initializes on next getDb()
  (db as any) = undefined;

  return preRestorePath;
}
