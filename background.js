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
        const parseResult = await chrome.runtime.sendMessage({
            type: 'PARSE_UNTAPPD',
            html: html
        });

        // Check authentication status
        if (!parseResult.authenticated) {
            console.log('User session expired or not logged in');
            chrome.storage.local.set({ isAuthenticated: false, lastUpdated: Date.now() });
            return;
        } else {
            chrome.storage.local.set({ isAuthenticated: true });
        }

        let checkins = parseResult.checkins;

        if (checkins && checkins.length > 0) {
            
            // --- TIME LIMIT FILTERING ---
            const storage = await chrome.storage.local.get(['abvCache', 'timeLimit']);
            const timeLimitHours = parseInt(storage.timeLimit || "24");
            const now = Date.now();
            const msLimit = timeLimitHours * 60 * 60 * 1000;

            // Helper to parse Untappd time string
            const parseTimeDiff = (timeStr) => {
                if (!timeStr) return 0;
                // Try standard date parse first
                const t = Date.parse(timeStr);
                if (!isNaN(t)) return now - t;
                
                // Parse relative strings matching "X mins ago", "1 hour ago"
                const lower = timeStr.toLowerCase();
                if (lower.includes('just now')) return 0;
                
                const parts = lower.split(' ');
                if (parts.length >= 2) {
                    const val = parseInt(parts[0]);
                    if (!isNaN(val)) {
                        if (lower.includes('min')) return val * 60 * 1000;
                        if (lower.includes('hour')) return val * 60 * 60 * 1000;
                        if (lower.includes('day')) return val * 24 * 60 * 60 * 1000;
                    }
                }
                return 0; // Fallback: Assume new if unknown format
            };

            checkins = checkins.filter(c => {
                 if (!c.time) return false;
                 const ageMs = parseTimeDiff(c.time);
                 return ageMs <= msLimit;
            });
            
            // Re-fetch storage for abvCache as we might have modified it in memory? No, we retrieved it above.
            const abvCache = storage.abvCache || {};
             
            // --- ABV Fetching Logic ---
            // const storage = await chrome.storage.local.get(['abvCache']); // Already got it
            // const abvCache = storage.abvCache || {};
            let cacheUpdated = false;

            // Process checkins to add ABV
            // Limiting to first 5 new items to avoid rate limits if cache is empty
            let fetchCount = 0;
            
            for (let c of checkins) {
                 if (c.beerUrl) {
                     const slug = c.beerUrl; // Use URL as key
                     if (abvCache[slug]) {
                         c.abv = abvCache[slug];
                     } else if (fetchCount < 5) {
                         // Fetch details
                         try {
                             fetchCount++;
                             const beerResp = await fetch('https://untappd.com' + c.beerUrl);
                             const beerHtml = await beerResp.text();
                             
                             // Simple regex for ABV
                             // Usually: <p class="abv">8% ABV</p>
                             const match = beerHtml.match(/class="abv">\s*([0-9.]+%) abv/i);
                             if (match && match[1]) {
                                 c.abv = match[1];
                                 abvCache[slug] = match[1];
                                 cacheUpdated = true;
                             }
                         } catch (err) {
                             console.error("Error fetching ABV for " + c.beerUrl, err);
                         }
                     }
                 }
            }

            if (cacheUpdated) {
                chrome.storage.local.set({ abvCache: abvCache });
            }
            // --------------------------

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
