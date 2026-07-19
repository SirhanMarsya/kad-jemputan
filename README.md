# Wedding Invitation — Ahmad & Nurul

Responsive single-page digital wedding invitation with glass-door opening animation, RSVP & wishes via Google Sheets, countdown, gallery, calendar links, and background music.

## Quick start

1. Open `index.html` in a browser (or serve the folder with any static host).
2. Replace Unsplash placeholder images with your own in `assets/` and update paths in `index.html` / `css/style.css`.
3. Add your music file as `assets/music.mp3` (or set a YouTube ID in `js/music.js`).

### Personalized guest link

```
index.html?to=Ali+Hassan
```

## Google Sheets setup

1. Create a Google Spreadsheet.
2. Create two sheets (tabs): **RSVP** and **Wishes**.
3. Headers:
   - **RSVP:** `Name | Attend | Guests | Message | Timestamp`
   - **Wishes:** `Name | Wish | Timestamp`
4. **Extensions → Apps Script** — paste `google-app-script/Code.gs`.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the web app URL into `js/config.js` → `scriptUrl`

Without a URL, RSVP and wishes still work in **local demo mode** (browser `localStorage`).

## Customize

| What | Where |
|------|--------|
| Couple names & date | `index.html`, `js/main.js` (`WEDDING_DATE`), `js/calendar.js` |
| Maps / Waze | Location buttons in `index.html` |
| Music (MP3) | `assets/music.mp3` |
| Music (YouTube) | `YOUTUBE_VIDEO_ID` in `js/music.js` |
| Spotify playlist link | Music panel link in `index.html` |

## Hosting (free)

Works on GitHub Pages, Netlify, Cloudflare Pages, or any static host. No database required.

## Structure

```
wedding-invitation/
├── index.html
├── css/          style.css · responsive.css · animation.css
├── js/           main.js · rsvp.js · wishes.js · calendar.js · music.js
├── assets/       bride · groom · gallery · flowers · music.mp3
└── google-app-script/Code.gs
```
