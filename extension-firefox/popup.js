document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.startsWith('http')) {
    document.getElementById('status').innerText = 'Cannot operate on this page.';
    return;
  }

  const url = new URL(tab.url);
  const hostname = url.hostname.replace('www.', '');
  const storageKey = `learned_selector_${hostname}`;
  
  chrome.storage.local.get(['whitelist', storageKey, `learned_selector_www.${hostname}`], (result) => {
    let whitelist = result.whitelist || ['linkedin.com', 'indeed.com', 'ycombinator.com', 'builtin.com'];
    
    // Whitelist UI
    const isWhitelisted = whitelist.some(domain => hostname.includes(domain));
    if (!isWhitelisted) {
      document.getElementById('whitelistBtn').style.display = 'block';
      document.getElementById('teachBtn').disabled = true;
      document.getElementById('saveBtn').disabled = true;
      document.getElementById('status').innerText = 'Domain not in whitelist.';
    }

    // Forget UI
    if (result[storageKey] || result[`learned_selector_www.${hostname}`]) {
      document.getElementById('forgetBtn').style.display = 'block';
    }

    // Whitelist Click
    document.getElementById('whitelistBtn').addEventListener('click', () => {
      whitelist.push(hostname);
      chrome.storage.local.set({ whitelist }, () => {
        document.getElementById('status').innerText = 'Added to whitelist! Reloading page...';
        document.getElementById('whitelistBtn').style.display = 'none';
        document.getElementById('teachBtn').disabled = false;
        document.getElementById('saveBtn').disabled = false;
        chrome.tabs.reload(tab.id);
      });
    });

    // Forget Click
    document.getElementById('forgetBtn').addEventListener('click', () => {
      chrome.storage.local.remove([storageKey, `learned_selector_www.${hostname}`], () => {
        document.getElementById('status').innerText = 'Learned layout forgotten. Reloading...';
        document.getElementById('forgetBtn').style.display = 'none';
        chrome.tabs.reload(tab.id);
      });
    });
  });

  // Save Click
  document.getElementById('saveBtn').addEventListener('click', () => {
    document.getElementById('status').innerText = 'Opening modal on page...';
    document.getElementById('status').style.color = '#64748b';
    chrome.tabs.sendMessage(tab.id, { action: 'extract_job' }, (response) => {
      if (chrome.runtime.lastError) {
        document.getElementById('status').innerText = 'Error: Please refresh the page and try again.';
        return;
      }
      if (response && response.success) {
        window.close(); // Modal is now open on the page!
      } else {
        document.getElementById('status').innerText = 'Could not extract job details.';
        document.getElementById('status').style.color = '#dc2626';
      }
    });
  });

  // Manual Entry Toggle
  document.getElementById('manualEntryBtn').addEventListener('click', () => {
      document.getElementById('status').innerText = 'Opening manual entry on page...';
      chrome.tabs.sendMessage(tab.id, { action: 'open_manual_modal' }, (response) => {
          if (chrome.runtime.lastError) {
              document.getElementById('status').innerText = 'Error: Please refresh the page and try again.';
          } else {
              window.close();
          }
      });
  });

  // Teach Click
  document.getElementById('teachBtn').addEventListener('click', () => {
    document.getElementById('status').innerText = 'Entering Teach Mode...';
    chrome.tabs.sendMessage(tab.id, { action: 'start_teach_mode' }, (response) => {
      if (chrome.runtime.lastError) {
        document.getElementById('status').innerText = 'Error: Please refresh the page and try again.';
      } else {
        window.close(); // Close popup so user can click on the page
      }
    });
  });
});
