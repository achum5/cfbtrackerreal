# R2 Image Uploads — Setup & Cutover

This replaces imgbb for image uploads with Cloudflare R2, using presigned URLs
so the browser uploads directly to R2 (free egress, CDN-cached reads, no
shared-key rate limits).

## How it works

```
browser: compress to webp
   │  POST /api/upload-url  (Firebase ID token)
   ▼
Vercel fn (api/upload-url.js): verify token → sign a PUT URL for
   images/{uid}/{yyyymm}/{uuid}.webp  → return { uploadUrl, publicUrl, headers }
   │  PUT bytes directly to R2 (uploadUrl)
   ▼
R2 bucket  ──public host (Cloudflare CDN)──>  reads served free + cached
```

The image is stored as a plain URL string, exactly like before, so local
(IndexedDB) and cloud (Firestore) save files behave identically.

Code already in place:
- `api/upload-url.js` — presign endpoint (auth-gated).
- `src/utils/imageUpload.js` — picks backend via `VITE_IMAGE_BACKEND`.
- `aws4fetch` dependency (SigV4 signing).

Nothing is live until you finish the steps below and flip `VITE_IMAGE_BACKEND`.

---

## 1. Create the R2 bucket

Cloudflare dashboard → R2 → Create bucket. Name it `dynasty-images`
(any name; it becomes `R2_BUCKET`). Note your **Account ID** (R2 overview page).

## 2. Create an R2 API token

R2 → Manage R2 API Tokens → Create API Token.
- Permission: **Object Read & Write**, scoped to the bucket.
- Save the **Access Key ID** and **Secret Access Key** (shown once).

## 3. Make objects publicly readable

**Quick start (works immediately, rate-limited — fine for testing):**
Bucket → Settings → enable the **r2.dev** managed public URL. Use that host
(e.g. `pub-xxxx.r2.dev`) as `R2_PUBLIC_HOST`.

**Production (recommended for scale):** connect a custom domain.
- The domain's DNS must be on Cloudflare. `dynastytracker.app` currently
  points at Vercel — either move the domain's DNS to Cloudflare (keep Vercel
  as the origin via CNAME) or use a domain already on Cloudflare.
- Bucket → Settings → Public access → Connect Domain → `img.dynastytracker.app`.
- Set `R2_PUBLIC_HOST=img.dynastytracker.app`.

Switching r2.dev → custom domain later is just an env-var change; old saved
URLs keep resolving on whatever host they were created with.

## 4. Set the bucket CORS policy

R2 bucket → Settings → CORS policy → paste:

```json
[
  {
    "AllowedOrigins": [
      "https://dynastytracker.app",
      "https://www.dynastytracker.app",
      "http://localhost:5000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

(The browser PUTs straight to R2, so R2 itself must allow these origins.)

## 5. Set environment variables

**Vercel → Project → Settings → Environment Variables** (Production + Preview):

| Name | Value |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from step 2 |
| `R2_SECRET_ACCESS_KEY` | from step 2 |
| `R2_BUCKET` | `dynasty-images` |
| `R2_PUBLIC_HOST` | `pub-xxxx.r2.dev` or `img.dynastytracker.app` |
| `VITE_IMAGE_BACKEND` | `r2`  ← the cutover switch (build-time) |

`R2_*` are server-only (no `VITE_` prefix) so they never reach the browser.
`VITE_IMAGE_BACKEND` is build-time — Vercel must **redeploy** after setting it.

**Local dev (`.env.local`)** so `npm run dev` uploads work against prod's
endpoint + R2:

```
VITE_IMAGE_BACKEND=r2
VITE_API_BASE=https://dynastytracker.app
```

(Dev has no serverless functions, so it borrows the deployed presign endpoint.
The PUT still goes straight to R2; `http://localhost:5000` is already in the
CORS allowlist.)

## 6. Deploy and test

Redeploy on Vercel. Upload an image anywhere (e.g. a player photo or a social
avatar). Confirm the saved URL points at `R2_PUBLIC_HOST` and the image loads.

To roll back instantly: set `VITE_IMAGE_BACKEND=imgbb` and redeploy.

---

## Future hardening (optional)

- **Hard size cap:** presigned PUT doesn't bind content-length, so an
  authenticated user could PUT a large file. Switch to a presigned POST with a
  `content-length-range` policy if this becomes a concern.
- **Rate limiting:** add a Cloudflare rate-limit rule on `/api/upload-url` and
  on the public image host.
- **Orphan cleanup:** keys are namespaced by `uid`, so a scheduled job can prune
  images no longer referenced by any of that user's dynasties.
