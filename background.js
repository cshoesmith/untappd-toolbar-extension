const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creating; // A global promise to avoid concurrency issues

async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'Parse Untappd HTML'
    });
    await creating;
    creating = null;
  }
}

async function fetchAndParse() {
    try {
        const response = await fetch('https://untappd.com/home');
        if (!response.ok) {
            console.error('Failed to fetch Untappd', response.status);
            return;
        }
        const html = await response.text();

        await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

        // Send message to offscreen document
        const checkins = await chrome.runtime.sendMessage({
            type: 'PARSE_UNTAPPD',
            html: html
        });

        if (checkins && checkins.length > 0) {
            chrome.storage.local.set({ checkins: checkins, lastUpdated: Date.now() });
            console.log('Updated checkins:', checkins.length);
        } else {
            console.log('No checkins found. Not logged in?');
        }
    } catch (e) {
        console.error("Error in fetchAndParse", e);
    }
}

// Alarm to fetch every 5 minutes
chrome.alarms.create('fetchUntappd', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fetchUntappd') {
        fetchAndParse();
    }
});

// Initial fetch on load
fetchAndParse();

// Listen for manual refresh from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'REFRESH_DATA') {
        fetchAndParse().then(() => sendResponse({status: 'done'}));
        return true; // Keep channel open
    }
});
