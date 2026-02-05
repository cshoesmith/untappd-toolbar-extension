document.getElementById('refresh').addEventListener('click', () => {
    const status = document.getElementById('status');
    status.textContent = "Refreshing...";
    chrome.runtime.sendMessage({type: 'REFRESH_DATA'}, (response) => {
        status.textContent = "Data refreshed!";
        setTimeout(() => status.textContent = "", 2000);
    });
});

document.getElementById('open-untappd').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://untappd.com/home' });
});

// Settings Logic
const limitSelect = document.getElementById('time-limit');
chrome.storage.local.get(['timeLimit'], (result) => {
    if (result.timeLimit) {
        limitSelect.value = result.timeLimit;
    }
});

limitSelect.addEventListener('change', () => {
    chrome.storage.local.set({ timeLimit: limitSelect.value });
    // Trigger a refresh so the new limit applies immediately
    chrome.runtime.sendMessage({type: 'REFRESH_DATA'});
    const status = document.getElementById('status');
    status.textContent = "Updating feed...";
});

chrome.storage.local.get(['lastUpdated', 'checkins', 'isAuthenticated'], (result) => {
    const status = document.getElementById('status');

    if (result.isAuthenticated === false) {
        status.textContent = "Session Expired. Please login.";
        status.style.color = "red";
        return;
    }

    if (result.lastUpdated) {
        const date = new Date(result.lastUpdated);
        const count = result.checkins ? result.checkins.length : 0;
        status.textContent = `Last update: ${date.toLocaleTimeString()}\nItems: ${count}`;
    } else {
        status.textContent = "No data yet.";
    }
});
