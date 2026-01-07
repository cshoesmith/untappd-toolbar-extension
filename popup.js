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

chrome.storage.local.get(['lastUpdated', 'checkins'], (result) => {
    const status = document.getElementById('status');
    if (result.lastUpdated) {
        const date = new Date(result.lastUpdated);
        const count = result.checkins ? result.checkins.length : 0;
        status.textContent = `Last update: ${date.toLocaleTimeString()}\nItems: ${count}`;
    } else {
        status.textContent = "No data yet.";
    }
});
