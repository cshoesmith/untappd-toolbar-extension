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

    // --- Interaction Logic ---
    let shutdownTimer = null;

    // Click to Restart Ticker
    tickerContainer.addEventListener('click', (e) => {
        if (e.button === 0) { // Left Click only
            offset = window.innerWidth;
        }
    });

    // Context Menu
    const menu = document.createElement('div');
    menu.id = 'untappd-context-menu';
    document.body.appendChild(menu);

    function createMenuItem(text, onClick) {
        const item = document.createElement('div');
        item.className = 'untappd-menu-item';
        item.textContent = text;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
            menu.style.display = 'none';
        });
        return item;
    }

    function createSeparator() {
        const sep = document.createElement('div');
        sep.className = 'untappd-menu-separator';
        return sep;
    }

    tickerContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // Rebuild menu content dynamically
        menu.innerHTML = ''; 

        // 1. Refresh Data
        menu.appendChild(createMenuItem('Refresh Data', () => {
             chrome.runtime.sendMessage({type: 'REFRESH_DATA'});
             // Visual feedback?
        }));

        // 2. Open Untappd
        menu.appendChild(createMenuItem('Open Untappd', () => {
             window.open('https://untappd.com/home', '_blank');
        }));

        menu.appendChild(createSeparator());

        // 3. Feed Limit Header
        const header = document.createElement('div');
        header.className = 'untappd-menu-header';
        header.textContent = 'Feed Filter Limit';
        menu.appendChild(header);

        // 4. Feed Limit Dropdown
        const selectContainer = document.createElement('div');
        selectContainer.className = 'untappd-menu-select-container';
        
        const select = document.createElement('select');
        select.className = 'untappd-menu-select';
        
        [8, 16, 24, 48].forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = `Last ${val} Hours`;
            select.appendChild(opt);
        });
        
        // Load current value
        chrome.storage.local.get(['timeLimit'], (res) => {
             select.value = res.timeLimit || "24";
        });
        
        select.addEventListener('change', (ev) => {
             const newVal = ev.target.value;
             chrome.storage.local.set({ timeLimit: newVal });
             chrome.runtime.sendMessage({type: 'REFRESH_DATA'});
             menu.style.display = 'none';
        });
        
        // Prevent menu closing when clicking inside select
        select.addEventListener('click', (ev) => ev.stopPropagation());
        
        selectContainer.appendChild(select);
        menu.appendChild(selectContainer);

        menu.appendChild(createSeparator());

        // 5. Close Toolbar
        menu.appendChild(createMenuItem('Close Toolbar', () => { root.style.display = 'none'; }));


        // Show Menu
        menu.style.display = 'block';
        menu.style.left = `${e.clientX}px`;
        
        // Position at bottom of screen
        menu.style.top = 'auto'; // Clear top
        menu.style.bottom = '0px'; 
        
        // Adjust if off screen horizontally
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                // Shift left to fit
                menu.style.left = `${window.innerWidth - rect.width}px`;
            }
        });
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
    // ------------------------

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
            updateItem.innerHTML = `<div class="u-line1">LAST REFRESH AT</div><div class="u-line2">${absTime}</div>`;
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

            // Line 1: User checked-in @ Venue
            const line1 = document.createElement('div');
            line1.className = 'u-line1';
            
            let line1HTML = `<span class="u-user">${c.user}</span> <span class="u-checkin">checked-in</span>`;
            if (c.venue) {
                line1HTML += ` <span class="u-text">@</span> <span class="u-venue">${c.venue}</span>`;
            }
            line1.innerHTML = line1HTML;
            info.appendChild(line1);

            // Line 2: Brewery : Beer ⭐ Rating (Time)
            const line2 = document.createElement('div');
            line2.className = 'u-line2';
            
            const timeDisplay = getRelativeTime(c.time);
            
            // Using Brewery as proxy for Style since we don't scrape style
            let line2HTML = `<span class="u-style">${c.brewery}</span> <span class="u-sep">:</span> <span class="u-beer">${c.beer}</span>`;
            
            if (c.abv) {
                line2HTML += ` <span class="u-abv">(${c.abv})</span>`;
            }

            if (c.rating && c.rating !== "-") {
                line2HTML += ` <span class="u-star">⭐</span> <span class="u-rating">${c.rating}</span>`;
            }
            
            line2HTML += ` <span class="u-time">(${timeDisplay})</span>`;
            
            line2.innerHTML = line2HTML;
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
