const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://news.ycombinator.com/jobs', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.href.toLowerCase();
        const text = a.innerText.toLowerCase();
        
        if (text.includes('about us') || text.includes('contact') || text.includes('privacy') || text.includes('terms') || text.includes('login') || text.includes('sign in')) return false;

        const urlMatch = href.includes('/job') || href.includes('/role') || href.includes('/position') || href.includes('/career') || href.includes('/intern') || href.includes('/post');
        
        const textMatch = /(engineer|developer|designer|manager|analyst|scientist|intern|director|lead|architect|specialist|associate|consultant)/.test(text);

        return (urlMatch || textMatch) && text.length > 5 && text.length < 150;
      })
      .map(a => a.href)
      .filter((value, index, self) => self.indexOf(value) === index);
  });
  console.log("YC Jobs:", links.length);
  console.log(links.slice(0, 5));
  await browser.close();
})();
