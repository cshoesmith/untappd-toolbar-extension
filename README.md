# Untappd Toolbar for Chrome

A Google Chrome extension that adds a scrolling ticker of your friends' Untappd check-ins to the bottom of your browser window.

## Features
- **Real-time Ticker**: Watch check-ins scroll by as they happen.
- **Native Design**: Styled to match the Untappd dark/gold aesthetic.
- **Unobtrusive**: Sits at the bottom of the screen; can be minimized when not needed.
- **Detailed Info**: Shows beer name, brewery, user, venue, rating, and time.

## Installation

### From Source (Developer Mode)
1. Download or clone this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle "Developer mode" in the top right corner.
4. Click "Load unpacked".
5. Select the folder where you cloned this repository.
6. The toolbar should now appear at the bottom of your active tab (you may need to refresh).

## Usage
- **Login**: You must be logged into [untappd.com](https://untappd.com) in Chrome for the toolbar to fetch feed data.
- **Minimize**: Click the small arrow on the right side of the toolbar to minimize/expand it.

## Permissions
- `tabs`: To check active status.
- `offscreen`: To parse data in the background.
- `scripting`: To inject the toolbar into pages.
- `host_permissions`: Access to `*://*.untappd.com/*` to fetch check-in data.

## License
MIT
