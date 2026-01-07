(function() {
    if (document.getElementById('untappd-toolbar-root')) return;

    // Inject style to reserve space
    const style = document.createElement('style');
    style.textContent = `
        body {
            padding-bottom: 55px !important;
        }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'untappd-toolbar-root';
    document.body.appendChild(root);

    // Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'untappd-toggle-btn';
    toggleBtn.innerHTML = '−';
    toggleBtn.title = 'Minimize Toolbar';
    root.appendChild(toggleBtn);

    let isMinimized = false;
    toggleBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        if (isMinimized) {
            root.classList.add('minimized');
            toggleBtn.innerHTML = '+';
            toggleBtn.title = 'Maximize Toolbar';
            style.textContent = ''; // Remove reserved space
        } else {
            root.classList.remove('minimized');
            toggleBtn.innerHTML = '−';
            toggleBtn.title = 'Minimize Toolbar';
            style.textContent = `
                body {
                    padding-bottom: 55px !important;
                }
            `;
        }
    });

    const tickerContainer = document.createElement('div');
    tickerContainer.className = 'untappd-ticker-container';
    root.appendChild(tickerContainer);

    const tickerContent = document.createElement('div');
    tickerContent.className = 'untappd-ticker-content';
    tickerContainer.appendChild(tickerContent);

    let checkins = [];
    let lastUpdated = null;
    let animationId;
    let offset = window.innerWidth;
    const speed = 1.5; // pixels per frame

    function getRelativeTime(dateInput) {
        if (!dateInput) return '';
        
        let timestamp;
        if (typeof dateInput === 'number') {
            timestamp = dateInput;
        } else {
            // Try parsing string
            timestamp = Date.parse(dateInput);
        }

        if (isNaN(timestamp)) return dateInput; // Return original if parse fails

        const now = Date.now();
        const diff = now - timestamp;
        const mins = Math.floor(diff / 60000);
        
        if (mins < 1) return 'Just now';
        if (mins === 1) return '1 min ago';
        if (mins < 60) return `${mins} mins ago`;
        
        const hours = Math.floor(mins / 60);
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;

        const days = Math.floor(hours / 24);
        if (days === 1) return '1 day ago';
        return `${days} days ago`;
    }

    function formatAbsoluteTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
    }

    function renderCheckins() {
        tickerContent.innerHTML = '';
        
        // Add Last Updated Time at the front
        if (lastUpdated) {
            const updateItem = document.createElement('div');
            updateItem.className = 'untappd-item update-item';
            
            const absTime = formatAbsoluteTime(lastUpdated);
            updateItem.innerHTML = `<div class="u-line1">Last Refresh at</div><div class="u-line2">${absTime}</div>`;
            tickerContent.appendChild(updateItem);
        }

        if (checkins.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'untappd-item';
            msg.textContent = 'Waiting for Untappd data... (Ensure you are logged in at untappd.com)';
            tickerContent.appendChild(msg);
            return;
        }

        checkins.forEach(c => {
            const item = document.createElement('div');
            item.className = 'untappd-item';
            
            // Avatar
            if (c.avatar) {
                const img = document.createElement('img');
                img.src = c.avatar;
                img.className = 'untappd-avatar';
                item.appendChild(img);
            }

            // Text Container (2 lines)
            const info = document.createElement('div');
            info.className = 'untappd-info';

            // Line 1: User checked-in Beer by Brewery
            const line1 = document.createElement('div');
            line1.className = 'u-line1';
            line1.innerHTML = `<span class="u-user">${c.user}</span> <span class="u-action">checked-in</span> <span class="u-beer">${c.beer}</span> <span class="u-action">by</span> <span class="u-brewery">${c.brewery}</span>`;
            info.appendChild(line1);

            // Line 2: @ Venue, Rating, Time
            const line2 = document.createElement('div');
            line2.className = 'u-line2';
            
            // Calculate relative time for checkin
            const timeDisplay = getRelativeTime(c.time);
            
            line2.innerHTML = `<span class="u-action">@</span> <span class="u-venue">${c.venue}</span> <span class="u-separator">,</span> <span class="u-rating">⭐ ${c.rating}</span> <span class="u-separator">,</span> <span class="u-time">${timeDisplay}</span>`;
            info.appendChild(line2);

            item.appendChild(info);
            tickerContent.appendChild(item);
        });
    }

    function animate() {
        offset -= speed;
        const contentWidth = tickerContent.scrollWidth;
        
        // Reset when fully off screen
        if (offset < -contentWidth) {
            offset = window.innerWidth;
        }

        tickerContent.style.transform = `translateX(${offset}px)`;
        animationId = requestAnimationFrame(animate);
    }

    function updateData() {
        chrome.storage.local.get(['checkins', 'lastUpdated'], (result) => {
            if (result.checkins) {
                checkins = result.checkins;
            }
            if (result.lastUpdated) {
                lastUpdated = result.lastUpdated;
            }
            renderCheckins();
        });
    }

    // Initial load
    updateData();
    animate();

    // Listen for updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.checkins) {
                checkins = changes.checkins.newValue;
            }
            if (changes.lastUpdated) {
                lastUpdated = changes.lastUpdated.newValue;
            }
            renderCheckins();
        }
    });

})();
