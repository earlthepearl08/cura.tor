# In-app help videos

Cura.Tor shows three ~60s guides on **Help & tips** (`/help`):

| Clip id | Topic | Config entry | Suggested file |
|---------|--------|--------------|----------------|
| `single-card` | Single card scan | `HELP_CLIPS[0]` | `public/help/single-card.mp4` |
| `multi-card` | Multi-card layout | `HELP_CLIPS[1]` | `public/help/multi-card.mp4` |
| `log-sheet` | Log / sign-in sheet | `HELP_CLIPS[2]` | `public/help/log-sheet.mp4` |

Config lives in `src/config/helpVideos.ts`.

## Drop in an MP4

1. Export a short vertical-or-landscape clip (target **≤60 seconds**, H.264 MP4).
2. Place the file under `public/help/` using the suggested name (create the folder if missing).
3. In `src/config/helpVideos.ts`, uncomment / set:

```ts
mp4Src: '/help/single-card.mp4',
```

4. Redeploy. The Help card will play the file with native controls.

Keep files reasonably small (aim under ~8–12 MB each) for mobile PWA users.

## Or use YouTube

1. Upload the clip unlisted or public on YouTube.
2. In `src/config/helpVideos.ts`, set:

```ts
youtubeUrl: 'https://www.youtube.com/watch?v=YOUR_ID',
```

Supports `youtube.com/watch?v=…`, `youtu.be/…`, and `/embed/…` URLs.

If both `mp4Src` and `youtubeUrl` are set, **MP4 wins**.

## Deep links

| URL | Behavior |
|-----|----------|
| `/help` | Full help surface |
| `/help?clip=single-card` | Scrolls / highlights single-card card |
| `/help?clip=multi-card` | Multi-card card |
| `/help?clip=log-sheet` | Log sheet card |

Scan screens link here via the header help icon. Settings → **Help & tips** opens `/help`.

## Placeholder behavior

Until media is configured, each slot shows a polished placeholder (icon + drop instructions + framing tips) and a **Try it** CTA to the live scan route.

## Related onboarding

First-run tip sheets (log / multi-card) may land in a separate PR. Prefer linking those “Watch video” / Help actions to `/help?clip=…` rather than duplicating video embeds.
