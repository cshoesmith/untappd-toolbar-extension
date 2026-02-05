chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PARSE_UNTAPPD') {
    const data = parseUntappdHtml(request.html);
    sendResponse(data);
  }
});

function parseUntappdHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Check if we assume we are authenticated by looking for the main stream container
  const mainStream = doc.querySelector('#main-stream');
  // If no main-stream, we assume not logged in (or critical layout change)
  if (!mainStream) {
      return { checkins: [], authenticated: false };
  }

  const items = doc.querySelectorAll('#main-stream .item');
  const checkins = [];

  items.forEach(item => {
    try {
        const textP = item.querySelector('.text');
        if (!textP) return;

        const links = textP.querySelectorAll('a');
        if (links.length < 3) return;

        const user = links[0].textContent.trim();
        const beer = links[1].textContent.trim();
        const beerUrl = links[1].getAttribute('href'); // Extract Beer URL for ABV fetching
        const brewery = links[2].textContent.trim();
        let venue = "Unknown Location";
        if (links.length > 3) {
            venue = links[3].textContent.trim();
        }

        const ratingEl = item.querySelector('.caps');
        let rating = "-";
        if (ratingEl) {
            const rawRating = ratingEl.getAttribute('data-rating');
            if (rawRating) {
                rating = parseFloat(rawRating).toFixed(2);
            }
        }

        const avatarEl = item.querySelector('.avatar img');
        const avatar = avatarEl ? (avatarEl.getAttribute('data-original') || avatarEl.src) : "";

        const labelEl = item.querySelector('.label img');
        const label = labelEl ? (labelEl.getAttribute('data-original') || labelEl.src) : "";

        const timeEl = item.querySelector('.time');
        const time = timeEl ? timeEl.textContent.trim() : "";

        checkins.push({
            user, beer, beerUrl, brewery, venue, rating, avatar, label, time
        });
    } catch (e) {
        console.error("Error parsing item", e);
    }
  });

  return { checkins, authenticated: true };
}
