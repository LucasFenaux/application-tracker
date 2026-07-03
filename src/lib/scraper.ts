import { chromium } from 'playwright';
import { getDb } from './db';
import { generateTextBuiltin, generateEmbedding, cosineSimilarity, generateTextOllama, calculateMatchScore } from './ml';

// Basic configuration for the persistent context
const USER_DATA_DIR = './playwright-user-data';

interface ScrapedJobRaw {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
}

/**
 * A highly generic parser that just looks for common job card patterns.
 */
async function parseGeneric(page: any, pageNumber: number = 1): Promise<ScrapedJobRaw[]> {
  await page.waitForTimeout(5000);
  
  if (pageNumber > 1) {
    // Attempt to click "Load More" or "Next" as a fallback
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        const text = (btn as HTMLElement).innerText.toLowerCase();
        if (text.includes('load more') || text.includes('show more') || text === 'next' || text === 'next page' || text === 'see more jobs') {
          (btn as HTMLElement).click();
          break;
        }
      }
    });
    await page.waitForTimeout(3000);
  }

  // Auto-scroll a few times to trigger lazy loading/infinite scrolling jobs
  // We scroll more times if we are on a deeper page
  const scrollAttempts = 3 * pageNumber;
  for (let i = 0; i < scrollAttempts; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
  }
  
  // Extract all links that look like job postings
  const jobLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links
      .filter(a => {
        const href = a.href.toLowerCase();
        const text = a.innerText.toLowerCase();
        
        // Exclude common non-job links or sentences
        if (text.includes('about us') || text.includes('contact') || text.includes('privacy') || text.includes('terms') || text.includes('login') || text.includes('sign in') || text.includes('find the best')) return false;

        // Job titles usually don't have punctuation like periods or commas (unless it's a location, but we can be strict)
        if (text.split(' ').length > 10) return false; // Job titles are rarely more than 10 words

        const urlMatch = href.includes('/job') || href.includes('/role') || href.includes('/position') || href.includes('/career') || href.includes('/intern') || href.includes('/post');
        
        // Regex to check if text contains common job keywords
        const textMatch = /(engineer|developer|designer|manager|analyst|scientist|intern|director|lead|architect|specialist|associate|consultant|hiring)/.test(text);

        // Accept if URL matches or if it looks strongly like a job title and has a reasonable length
        return (urlMatch || textMatch) && text.length > 5 && text.length < 100;
      })
      .map(a => a.href)
      .filter((value, index, self) => self.indexOf(value) === index); // unique
  });

  const db = getDb();
  const jobs: ScrapedJobRaw[] = [];
  
  // Quick URL-based Deduplication before expensive page visits
  const validLinks = jobLinks.filter((link: string) => {
    const existingScraped = db.prepare('SELECT id FROM scraped_jobs WHERE url = ? AND url IS NOT NULL AND url != \'\'').get(link);
    const existingMain = db.prepare('SELECT id FROM jobs WHERE url = ? AND url IS NOT NULL AND url != \'\'').get(link);
    return !existingScraped && !existingMain;
  });

  console.log(`[Scraper] Found ${jobLinks.length} links on page, ${validLinks.length} are new URLs.`);
  
  // Visit each valid link to get the description
  for (const link of validLinks) {
    if (jobs.length >= 50) break; // Stop when we've successfully gathered 50 NEW jobs

    const cancelFlag = db.prepare("SELECT value FROM settings WHERE key = 'scraper_cancel_requested'").get() as any;
    if (cancelFlag && cancelFlag.value === 'true') {
      console.log("[Scraper] Task was cancelled by the user during link collection.");
      throw new Error('CANCELLED_BY_USER');
    }

    try {
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const details = await page.evaluate(() => {
        const titleText = document.querySelector('h1')?.innerText || document.title || 'Unknown Title';
        const bodyText = document.body.innerText;
        // Truncate body text to a reasonable length for the LLM
        return {
          title: titleText.substring(0, 200).replace(/\n/g, ' ').trim(),
          company: 'Unknown Company',
          location: 'Remote/Unknown',
          description: bodyText.substring(0, 3000)
        };
      });
      
      // Secondary Title+Company Deduplication Check
      const existingScraped = db.prepare('SELECT id FROM scraped_jobs WHERE title = ? AND company = ?').get(details.title, details.company);
      const existingMain = db.prepare('SELECT id FROM jobs WHERE title = ? AND company = ?').get(details.title, details.company);
      
      if (existingScraped || existingMain) {
        console.log(`[Scraper] Skipping duplicate job during parse: ${details.title}`);
        continue;
      }
      
      jobs.push({
        url: link,
        ...details
      });
    } catch (e) {
      console.error("Failed to scrape link: " + link);
    }
  }

  return jobs;
}

export async function runScraperTask(url: string, website: string, focus: string, minMatch: number, minGoalMatch: number, provider: 'ollama'|'builtin' = 'builtin', pageNumber: number = 1) {
  const db = getDb();
  
  const updateStatus = (status: string, progress: number) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scraper_live_status', status);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scraper_progress', progress.toString());
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scraper_heartbeat', Date.now().toString());
  };

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scraper_is_running', 'true');

  // Create Log Entry
  let targetUrl = url;
  if (pageNumber > 1) {
    if (url.includes('news.ycombinator.com')) {
      targetUrl = url.includes('?') ? `${url}&p=${pageNumber}` : `${url}?p=${pageNumber}`;
    } else {
      targetUrl = url.includes('?') ? `${url}&page=${pageNumber}` : `${url}?page=${pageNumber}`;
    }
  }

  const logInfo = db.prepare('INSERT INTO scraper_logs (website, url, status) VALUES (?, ?, ?)').run(website, targetUrl, 'running');
  const logId = logInfo.lastInsertRowid;

  const headlessSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('scraper_headless') as any;
  const isHeadless = headlessSetting ? headlessSetting.value !== 'false' : true;

  let browser;
  try {
    updateStatus(`Launching browser to scrape ${website} (Page ${pageNumber})...`, 5);
    // Launch persistent context to avoid anti-bot and save cookies
    browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: isHeadless,
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await browser.newPage();
    
    console.log(`[Scraper] Navigating to ${targetUrl}...`);
    updateStatus(`Navigating to ${targetUrl}...`, 15);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    // Wait for dynamic content to render instead of relying on networkidle (which hangs on sites with websockets/analytics)
    await page.waitForTimeout(4000);
    
    // Check for Cloudflare / CAPTCHA blocks
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (pageText.includes('checking if the site connection is secure') || 
        pageText.includes('verify you are human') || 
        pageText.includes('cloudflare')) {
        if (!isHeadless) {
          console.log("[Scraper] Cloudflare detected in headful mode! Waiting 60 seconds for you to solve it...");
          updateStatus(`CAPTCHA detected! Please solve it in the Chromium window. Waiting 60s...`, 15);
          await page.waitForTimeout(60000); // 60 seconds for user to solve
        } else {
          throw new Error('BLOCKED_BY_CLOUDFLARE');
        }
    }

    console.log(`[Scraper] Parsing jobs for ${website}...`);
    updateStatus(`Parsing job listings from ${website}...`, 30);
    const rawJobs = await parseGeneric(page, pageNumber); 

    console.log(`[Scraper] Found ${rawJobs.length} raw jobs. Filtering...`);
    updateStatus(`Found ${rawJobs.length} raw jobs. Evaluating matches...`, 40);
    let jobsAdded = 0;

    // Get the user's profile vector
    const profiles = db.prepare('SELECT vector FROM materials WHERE is_profile = 1').all() as any[];
    let combinedProfileVector: number[] | null = null;
    
    if (profiles.length > 0) {
      const parsedProfiles = profiles.map(p => p.vector ? JSON.parse(p.vector) : null).filter(v => v !== null);
      if (parsedProfiles.length > 0) {
        const dim = parsedProfiles[0].length;
        combinedProfileVector = new Array(dim).fill(0);
        for (const vec of parsedProfiles) {
          for (let i = 0; i < dim; i++) {
            combinedProfileVector[i] += vec[i];
          }
        }
        for (let i = 0; i < dim; i++) {
          combinedProfileVector[i] /= parsedProfiles.length;
        }
      }
    }

    // Get Calibration Settings
    const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    const calibrationMode = settingsMap['calibration_mode'] || 'simple';
    const minSim = parseFloat(settingsMap['calibration_min'] || '0.55');
    const maxSim = parseFloat(settingsMap['calibration_max'] || '0.85');
    const calibrationCurve = JSON.parse(settingsMap['calibration_curve'] || '[]');
    
    let targetJobGoalVector: number[] | null = null;
    if (settingsMap['target_job_goal_vector']) {
      try {
        targetJobGoalVector = JSON.parse(settingsMap['target_job_goal_vector']);
      } catch (err) {}
    }

    let processed = 0;
    for (const job of rawJobs) {
      processed++;
      
      // EXPLICIT YIELD: The Builtin LLM inference is extremely heavy and blocks the Node.js event loop.
      // We must artificially pause for 500ms before processing each job so the Next.js server has time
      // to process incoming HTTP requests from the frontend UI (button clicks, polling, etc).
      await new Promise(resolve => setTimeout(resolve, 500));

      // CHECK FOR CANCELLATION
      const cancelFlag = db.prepare("SELECT value FROM settings WHERE key = 'scraper_cancel_requested'").get() as any;
      if (cancelFlag && cancelFlag.value === 'true') {
        console.log("[Scraper] Task was cancelled by the user.");
        throw new Error('CANCELLED_BY_USER');
      }
      
      // DE-DUPLICATION CHECK
      const existingScraped = db.prepare('SELECT id FROM scraped_jobs WHERE (url = ? AND url IS NOT NULL AND url != \'\') OR (title = ? AND company = ?)').get(job.url, job.title, job.company);
      const existingMain = db.prepare('SELECT id FROM jobs WHERE (url = ? AND url IS NOT NULL AND url != \'\') OR (title = ? AND company = ?)').get(job.url, job.title, job.company);
      
      if (existingScraped || existingMain) {
        console.log(`[Scraper] Skipping duplicate job: ${job.title} at ${job.company}`);
        continue;
      }

      const baseProgress = 40;
      const progressInc = (processed / rawJobs.length) * 60;
      updateStatus(`Evaluating Job ${processed}/${rawJobs.length}: ${job.title.substring(0,30)}...`, baseProgress + progressInc);
      
      let focusPassed = 1;
      let lastFocus = focus || '';


      if (combinedProfileVector || targetJobGoalVector) {
        const jobVector = await generateEmbedding(`${job.title} - ${job.company}\n\n${job.description}`);
        
        let matchScore = 0;
        let goalMatchScore = 0;
        
        if (combinedProfileVector) {
          const similarity = cosineSimilarity(combinedProfileVector, jobVector);
          matchScore = calculateMatchScore(similarity, calibrationMode, calibrationCurve, minSim, maxSim);
        }
        
        if (targetJobGoalVector) {
          const goalSimilarity = cosineSimilarity(targetJobGoalVector, jobVector);
          goalMatchScore = calculateMatchScore(goalSimilarity, calibrationMode, calibrationCurve, minSim, maxSim);
        }

        db.prepare(`
          INSERT INTO scraped_jobs (title, company, location, url, description, source_website, match_score, goal_match_score, vector, focus_passed, last_focus_evaluated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(job.title, job.company, job.location, job.url, job.description, website, matchScore, goalMatchScore, JSON.stringify(jobVector), focusPassed, lastFocus);
        
        if (matchScore >= minMatch && goalMatchScore >= minGoalMatch && focusPassed === 1) {
          jobsAdded++;
          console.log(`[Scraper] Matched job: ${job.title} (Match: ${matchScore}%, Goal: ${goalMatchScore}%)`);
        } else {
          console.log(`[Scraper] Job cached (didn't meet criteria): ${job.title} (Match: ${matchScore}%, Goal: ${goalMatchScore}%, Focus: ${focusPassed})`);
        }
      } else {
        const jobVector = await generateEmbedding(`${job.title} - ${job.company}\n\n${job.description}`);
        
        db.prepare(`
          INSERT INTO scraped_jobs (title, company, location, url, description, source_website, match_score, goal_match_score, vector, focus_passed, last_focus_evaluated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(job.title, job.company, job.location, job.url, job.description, website, 100, 100, JSON.stringify(jobVector), focusPassed, lastFocus);
        
        if (focusPassed === 1) {
          jobsAdded++;
          console.log(`[Scraper] Matched job without vectors: ${job.title}`);
        } else {
          console.log(`[Scraper] Cached job (failed focus): ${job.title}`);
        }
      }
    }

    db.prepare('UPDATE scraper_logs SET status = ?, jobs_found = ? WHERE id = ?').run('success', jobsAdded, logId);
    if (jobsAdded === 0 && rawJobs.length > 0) {
      updateStatus(`Success: Parsed ${rawJobs.length} jobs, but 0 matched your Focus Filter or 80% Match threshold.`, 100);
    } else {
      updateStatus(`Success: Scraped ${website} and added ${jobsAdded} matching jobs.`, 100);
    }
    return { jobsAdded };
  } catch (err: any) {
    console.error('[Scraper Error]', err);
    if (err.message === 'CANCELLED_BY_USER') {
      db.prepare('UPDATE scraper_logs SET status = ?, error_message = ? WHERE id = ?').run('cancelled', 'Cancelled by user', logId);
      updateStatus(`Cancelled: Scraper was aborted by the user.`, 100);
    } else {
      const status = err.message.includes('BLOCKED') ? 'blocked' : 'error';
      db.prepare('UPDATE scraper_logs SET status = ?, error_message = ? WHERE id = ?').run(status, err.message, logId);
      updateStatus(`Failed: ${err.message}`, 100);
    }
    return { jobsAdded: 0 };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
