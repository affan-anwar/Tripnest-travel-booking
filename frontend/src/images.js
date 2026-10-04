// Photo resolver. The hotels are fictional demo properties, so each one shows real photos of its
// city and landmarks from Wikipedia. Room photos come from Wikimedia Commons. Both are free and need no API key.
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const STORE = "tripnest-images-v1";

export const PACKAGE_PHOTOS = {
  "Goa Beach Escape": "Calangute",
  "Himalayan Trek": "Manali, Himachal Pradesh",
  "Taj Mahal and Agra": "Taj Mahal",
  "Royal Rajasthan": "Amber Fort",
  "Kerala Backwaters": "Kerala Backwaters",
  "Leh Ladakh Road Trip": "Pangong Tso",
  "Dubai Delight": "Burj Khalifa",
  "Thailand Escape": "Wat Arun",
  "Singapore Highlights": "Marina Bay Sands",
  "Bali Retreat": "Tanah Lot",
  "Maldives Retreat": "Overwater bungalow",
  "Nepal Himalaya": "Boudhanath",
  "Magical Paris": "Eiffel Tower",
  "Swiss Alps": "Matterhorn",
  "London Classic": "Tower Bridge",
  "Japan Discovery": "Mount Fuji",
  "Umrah Package": "Masjid al-Haram",
  "New York City": "Statue of Liberty",
  "Sydney and Gold Coast": "Sydney Opera House",
  "hero:home": "Burj Al Arab",
  "hero:auth": "Marina Bay Sands",
};

export const HOTEL_PHOTOS = {
  "TripNest Grand Bengaluru": ["Vidhana Soudha", "Bangalore Palace", "Lalbagh"],
  "Rajmahal Heritage Palace": ["City Palace, Jaipur", "Hawa Mahal", "Amber Fort"],
  "Goa Sands Beach Resort and Spa": ["Calangute", "Basilica of Bom Jesus", "Palolem Beach"],
  "Yamuna View Palace": ["Taj Mahal", "Agra Fort", "Mehtab Bagh"],
  "Gateway Grand Mumbai": ["Gateway of India", "Marine Drive, Mumbai", "Chhatrapati Shivaji Maharaj Terminus"],
  "Imperial Capital Delhi": ["India Gate", "Red Fort", "Humayun's Tomb"],
  "Marina Skyline Tower": ["Burj Khalifa", "Burj Al Arab", "Dubai Marina"],
  "Haram View Hotel": ["Masjid al-Haram", "Abraj Al Bait", "Mecca"],
  "Madinah Noor Hotel": ["Al-Masjid an-Nabawi", "Quba Mosque", "Medina"],
  "Eiffel Prestige Paris": ["Eiffel Tower", "Louvre", "Arc de Triomphe"],
  "Harbour Grand Singapore": ["Marina Bay Sands", "Gardens by the Bay", "Merlion"],
  "Coral Overwater Resort": ["Overwater bungalow", "Maldives", "Snorkeling"],
};

export const ROOM_QUERIES = {
  "Deluxe Room": "hotel room bed",
  "Executive Suite": "hotel suite living room",
  "Presidential Suite": "luxury hotel suite",
};

// The alt text of every picture is the package, hotel or room name, so it is used to find the photo.
export function specFor(alt) {
  if (!alt) return null;
  if (PACKAGE_PHOTOS[alt]) return { wiki: PACKAGE_PHOTOS[alt] };
  const m = /^(.*) photo (\d)$/.exec(alt);
  const name = m ? m[1] : alt;
  const index = m ? Number(m[2]) - 1 : 0;
  if (HOTEL_PHOTOS[name]) return { wiki: HOTEL_PHOTOS[name][index % HOTEL_PHOTOS[name].length] };
  if (ROOM_QUERIES[alt]) return { commons: ROOM_QUERIES[alt] };
  return null;
}

let stored = {};
try {
  stored = JSON.parse(localStorage.getItem(STORE) || "{}");
} catch {
  stored = {};
}
const persist = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(stored));
  } catch {
    /* storage blocked or full: the photos are simply fetched again next time */
  }
};

async function fetchWikiThumbs(titles) {
  const url = `${WIKI_API}?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=1200&titles=${encodeURIComponent(titles.join("|"))}`;
  const data = await (await fetch(url)).json();
  const q = data.query || {};
  const alias = {};
  [...(q.normalized || []), ...(q.redirects || [])].forEach((r) => { alias[r.from] = r.to; });
  const finalTitle = (t) => {
    let cur = t;
    for (let i = 0; i < 5 && alias[cur]; i += 1) cur = alias[cur];
    return cur;
  };
  const byTitle = {};
  Object.values(q.pages || {}).forEach((p) => { if (p.thumbnail) byTitle[p.title] = p.thumbnail.source; });
  const out = {};
  titles.forEach((t) => { out[t] = byTitle[finalTitle(t)] || null; });
  return out;
}

async function fetchCommons(query) {
  const url = `${COMMONS_API}?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=900`;
  const data = await (await fetch(url)).json();
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
  const good = pages
    .map((p) => p.imageinfo?.[0])
    .filter((i) => i && i.mime === "image/jpeg" && i.width >= 1200 && i.width > i.height && i.thumburl);
  return good.length ? good[0].thumburl : null;
}

// Many images ask for photos at the same moment, so the titles are batched into a single request.
const pending = new Map();
let queue = [];
let timer = null;

function flush() {
  const batch = queue;
  queue = [];
  timer = null;
  for (let i = 0; i < batch.length; i += 40) {
    const chunk = batch.slice(i, i + 40);
    fetchWikiThumbs(chunk.map((c) => c.title))
      .then((found) => chunk.forEach((c) => c.done(found[c.title] || null)))
      .catch(() => chunk.forEach((c) => c.done(null)));
  }
}

function wikiImage(title) {
  const key = `w:${title}`;
  if (stored[key]) return Promise.resolve(stored[key]);
  if (pending.has(key)) return pending.get(key);
  const promise = new Promise((resolve) => {
    queue.push({
      title,
      done: (url) => {
        if (url) { stored[key] = url; persist(); }
        pending.delete(key);
        resolve(url);
      },
    });
    if (!timer) timer = setTimeout(flush, 30);
  });
  pending.set(key, promise);
  return promise;
}

function commonsImage(query) {
  const key = `c:${query}`;
  if (stored[key]) return Promise.resolve(stored[key]);
  if (pending.has(key)) return pending.get(key);
  const promise = fetchCommons(query)
    .then((url) => { if (url) { stored[key] = url; persist(); } return url; })
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

export function resolveImage(alt) {
  const spec = specFor(alt);
  if (!spec) return Promise.resolve(null);
  return spec.wiki ? wikiImage(spec.wiki) : commonsImage(spec.commons);
}
