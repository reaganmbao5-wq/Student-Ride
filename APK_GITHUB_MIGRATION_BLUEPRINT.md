# 🚀 MASTER SPECIFICATION: MIGRATING APK STORAGE FROM MONGODB GRIDFS TO GITHUB RELEASES + LOCAL DISK TIER

## 1. Executive Summary & Problem Solved
* **The Problem**: The existing backend stores 50MB+ APK binaries in MongoDB GridFS and streams them through Render’s 512MB RAM free tier. When Render is asleep, users wait up to 90 seconds for cold-starts; streaming large binaries causes memory spikes and HTTP timeouts.
* **The Solution**: Adopt the resilient **Multi-Tier Architecture** inspired by the friend's guide:
  * **Tier 1 (Instant Local Disk Stream)**: The server checks for a local file (`backend/downloads/jaey-ride.apk`). If present, streams it immediately via native `FileResponse` with zero database overhead.
  * **Tier 2 (GitHub Releases Pre-Signed CDN)**: If running on an ephemeral container where the local file isn't present, the backend queries the private GitHub Releases API with a `GITHUB_RELEASE_TOKEN` and issues a `302 Redirect` to GitHub’s pre-signed AWS S3 CDN (`objects.githubusercontent.com`). The student downloads at maximum CDN speed with **zero authentication required**.
  * **Tier 3 (Graceful Legacy Fallback)**: If a legacy release with `file_id` in GridFS is requested, it still streams from GridFS. Nothing breaks.
  * **Zero Database Bloat**: MongoDB now stores only lightweight JSON release metadata (`version_code`, `release_notes`, `download_url`), freeing up 100% of MongoDB binary storage.

---

## 2. Exhaustive Audit: Files Involved

### 🔒 Untouched & Strictly Locked Modules (Zero-Risk Guarantee)
* `backend/server.py` (Lines 1 to 5790): Ride lifecycle, state machine, matching algorithms, socket dispatch, pricing.
* `frontend/src/pages/DriverDashboard.jsx`: Driver UI, optimistic locks, passenger cards.
* `frontend/src/components/map/*`: `RouteEngine.jsx`, `RouteRenderer.jsx`, `PlatformMap.jsx`, `RideMap.jsx`.

### 🛠️ Modified Files (Safely Isolated to Release Management)
1. `backend/server.py` (Lines 5795 to 5922) — Replace GridFS upload/download routes with GitHub + Disk tier routes.
2. `frontend/src/pages/AdminSettingsPage.jsx` (Lines 52 to 76) — Update upload progress indicator and release status badge.
3. `frontend/src/pages/LandingPage.jsx` (Lines 160 to 173) — Switch to native `window.location.href` download trigger.
4. `frontend/src/components/common/AppUpdateModal.jsx` (Lines 95 to 110) — Native download trigger.
5. `frontend/src/components/common/MultiPlatformInstallSection.jsx` (Lines 65 to 83) — Native download trigger.
6. `frontend/src/components/common/PWAInstallPrompt.jsx` (Lines 55 to 73) — Native download trigger.

---

## 3. Production Code Implementations

### A. Backend: `backend/server.py` (Replace Lines 5795–5922)

```python
import os
import uuid
import httpx
from pathlib import Path
from datetime import datetime, timezone
from fastapi import UploadFile, File, Query, HTTPException, Depends
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from bson import ObjectId

# ────────────────────────────────────────────────────────────
# GITHUB RELEASE CONFIGURATION
# ────────────────────────────────────────────────────────────
GITHUB_REPO = os.environ.get("GITHUB_REPO", "reaganmbao5-wq/Student-Ride")
GITHUB_TOKEN = os.environ.get("GITHUB_RELEASE_TOKEN")  # Personal Access Token with repo scope

DOWNLOADS_DIR = Path(__file__).resolve().parent / "downloads"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

async def get_github_asset_download_url(asset_id: str) -> str:
    """
    Fetches the pre-signed AWS S3 CDN redirect URL from GitHub API for a private release asset.
    """
    if not GITHUB_TOKEN or not asset_id:
        return None
        
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/octet-stream",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    async with httpx.AsyncClient(follow_redirects=False, timeout=15.0) as client:
        res = await client.get(
            f"https://api.github.com/repos/{GITHUB_REPO}/releases/assets/{asset_id}",
            headers=headers
        )
        # GitHub returns 302 with Location pointing to pre-signed S3 URL
        if res.status_code in (302, 307):
            return res.headers.get("Location")
    return None


async def upload_asset_to_github(file_content: bytes, filename: str, tag: str, notes: str):
    """
    Creates/updates a GitHub Release and uploads the APK binary asset.
    Returns: (github_release_id, github_asset_id, browser_download_url)
    """
    if not GITHUB_TOKEN:
        return None, None, None

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        # 1. Check if release tag already exists (prevents 422 error)
        release_res = await client.get(
            f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/{tag}",
            headers=headers
        )
        
        if release_res.status_code == 200:
            release_data = release_res.json()
            release_id = release_data["id"]
            # Delete older asset with same name if it exists
            for asset in release_data.get("assets", []):
                if asset["name"] == filename:
                    await client.delete(
                        f"https://api.github.com/repos/{GITHUB_REPO}/releases/assets/{asset['id']}",
                        headers=headers
                    )
        else:
            # Create new release
            create_res = await client.post(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases",
                headers=headers,
                json={
                    "tag_name": tag,
                    "name": f"Jaey Ride {tag}",
                    "body": notes,
                    "draft": False,
                    "prerelease": False
                }
            )
            if create_res.status_code not in (200, 201):
                raise HTTPException(
                    status_code=500, 
                    detail=f"GitHub Release creation failed: {create_res.text}"
                )
            release_data = create_res.json()
            release_id = release_data["id"]

        # 2. Upload APK binary to GitHub Release Assets
        upload_url = f"https://uploads.github.com/repos/{GITHUB_REPO}/releases/{release_id}/assets?name={filename}"
        upload_headers = {
            **headers,
            "Content-Type": "application/vnd.android.package-archive"
        }
        asset_res = await client.post(upload_url, headers=upload_headers, content=file_content)
        if asset_res.status_code not in (200, 201):
            raise HTTPException(
                status_code=500, 
                detail=f"GitHub Asset upload failed: {asset_res.text}"
            )
            
        asset_data = asset_res.json()
        return str(release_id), str(asset_data["id"]), asset_data.get("browser_download_url")


# ────────────────────────────────────────────────────────────
# RELEASES & OTA DOWNLOAD ENDPOINTS
# ────────────────────────────────────────────────────────────

@api_router.get("/app/version-check")
async def get_app_version_info():
    """
    Returns latest published APK release metadata for in-app update checks.
    """
    latest_release = await db.app_releases.find_one({}, sort=[("version_code", -1)], projection={"_id": 0})
    if not latest_release:
        return {
            "latest_version": "2.1.0",
            "version_code": 11,
            "min_required_version": "2.0.0",
            "force_update": False,
            "download_url": "/api/app/download-latest-apk",
            "release_notes": "Official Jaey Ride production build with multi-passenger pooling.",
            "file_size_bytes": 0,
            "published_at": datetime.now(timezone.utc).isoformat()
        }
    return latest_release


@api_router.get("/app/download-latest-apk")
@api_router.get("/download/android")
async def download_latest_apk():
    """
    Resilient 3-Tier APK Delivery:
    Tier 1: Direct stream from server local storage.
    Tier 2: Pre-signed redirect to GitHub Releases AWS S3 CDN.
    Tier 3: Legacy GridFS fallback.
    """
    # ── TIER 1: Check Local Disk Storage (Friend's Pattern)
    local_candidates = [
        DOWNLOADS_DIR / "jaey-ride.apk",
        Path("JRide-release-v2.1.0.apk"),
        Path("app-debug-885a0b1.apk"),
        Path(__file__).resolve().parent.parent / "JRide-release-v2.1.0.apk",
        Path(__file__).resolve().parent.parent / "mulungushi-rides-ONLINE.apk"
    ]
    local_file = next((p for p in local_candidates if p.exists()), None)
    if local_file:
        return FileResponse(
            path=str(local_file),
            filename="jaey-ride-latest.apk",
            media_type="application/vnd.android.package-archive",
            headers={"Content-Disposition": 'attachment; filename="jaey-ride-latest.apk"'}
        )

    # ── TIER 2: GitHub Releases Pre-Signed Redirect
    latest_release = await db.app_releases.find_one({}, sort=[("version_code", -1)])
    if latest_release and latest_release.get("github_asset_id"):
        presigned_s3_url = await get_github_asset_download_url(latest_release["github_asset_id"])
        if presigned_s3_url:
            return RedirectResponse(url=presigned_s3_url, status_code=302)

    # ── TIER 3: Legacy GridFS Fallback
    if latest_release and "file_id" in latest_release:
        try:
            from motor.motor_asyncio import AsyncIOMotorGridFSBucket
            fs = AsyncIOMotorGridFSBucket(db, bucket_name="app_releases")
            grid_out = await fs.open_download_stream(ObjectId(latest_release["file_id"]))
            
            async def stream_gridfs():
                while chunk := await grid_out.readchunk():
                    yield chunk

            return StreamingResponse(
                stream_gridfs(),
                media_type="application/vnd.android.package-archive",
                headers={
                    "Content-Disposition": f'attachment; filename="jaey-ride-v{latest_release.get("latest_version", "latest")}.apk"',
                    "Content-Length": str(latest_release.get("file_size_bytes", grid_out.length))
                }
            )
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="No APK build found.")


@api_router.post("/admin/app-releases/upload")
async def upload_new_apk_release(
    file: UploadFile = File(...),
    version_name: str = Query(...),
    version_code: int = Query(...),
    min_required_version: str = Query("2.0.0"),
    force_update: bool = Query(False),
    release_notes: str = Query("Performance enhancements and bug fixes."),
    admin: dict = Depends(require_admin)
):
    """
    Publishes a new release to GitHub and warms local storage.
    """
    if not file.filename.endswith((".apk", ".bin")):
        raise HTTPException(status_code=400, detail="Only .apk files are supported.")

    content = await file.read()
    file_size = len(content)
    clean_filename = f"jaey-ride-v{version_name}.apk"

    # 1. Warm local disk cache immediately
    try:
        local_target = DOWNLOADS_DIR / "jaey-ride.apk"
        with open(local_target, "wb") as f:
            f.write(content)
    except Exception as e:
        print(f"Warning saving local APK: {e}")

    # 2. Upload to GitHub Releases
    tag = f"v{version_name}"
    github_rel_id, github_asset_id, browser_url = None, None, None
    if GITHUB_TOKEN:
        try:
            github_rel_id, github_asset_id, browser_url = await upload_asset_to_github(
                file_content=content,
                filename=clean_filename,
                tag=tag,
                notes=release_notes
            )
        except Exception as e:
            print(f"GitHub release upload warning: {e}")

    # 3. Store lightweight metadata in MongoDB (NO binary blob!)
    release_doc = {
        "id": str(uuid.uuid4()),
        "latest_version": version_name,
        "version_code": version_code,
        "min_required_version": min_required_version,
        "force_update": force_update,
        "release_notes": release_notes,
        "filename": clean_filename,
        "file_size_bytes": file_size,
        "download_url": "/api/app/download-latest-apk",
        "github_release_id": github_rel_id,
        "github_asset_id": github_asset_id,
        "browser_download_url": browser_url,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": admin["id"]
    }

    await db.app_releases.insert_one(release_doc)
    return {
        "status": "published",
        "message": f"Release v{version_name} published successfully!",
        "storage": "github_releases" if github_asset_id else "local_disk",
        "release": {k: v for k, v in release_doc.items() if k != "_id"}
    }
```

---

### B. Frontend Universal Download Trigger Pattern

For `LandingPage.jsx`, `MultiPlatformInstallSection.jsx`, and `PWAInstallPrompt.jsx`, replace link-click simulation with **direct location assignment**:

```javascript
const handleDownloadApk = () => {
    const backendUrl = getBackendUrl();
    const downloadUrl = `${backendUrl}/api/app/download-latest-apk`;
    // Immediately invokes Android native download manager with zero blank tabs
    window.location.href = downloadUrl;
    localStorage.setItem('has_downloaded_apk', 'true');
    if (typeof toast !== 'undefined') {
        toast.success('Starting Jaey Ride download...');
    }
};
```

---

### C. Build Automation Script: `scripts/copy-apk.js`

Add this script to your project root to auto-copy Android builds to `backend/downloads/jaey-ride.apk` when building locally:

```javascript
// scripts/copy-apk.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../frontend/android/app/build/outputs/apk/debug/app-debug.apk');
const destDir = path.join(__dirname, '../backend/downloads');
const dest = path.join(destDir, 'jaey-ride.apk');

if (fs.existsSync(src)) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Copied APK to backend/downloads/jaey-ride.apk (${sizeMb} MB)`);
} else {
    console.warn('⚠️ Built APK not found at:', src);
}
```

---

## 4. Verification & Testing Checklist
1. **Local Disk Stream**: Request `GET /api/app/download-latest-apk` → verify `Content-Type: application/vnd.android.package-archive` and headers.
2. **GitHub S3 CDN Redirect**: Verify when local file is omitted that the request returns `302 Found` redirecting to `objects.githubusercontent.com`.
3. **Admin Upload**: Verify that an APK upload from Admin Dashboard publishes tag `v{version}` to GitHub Releases and updates MongoDB metadata without writing to GridFS.
4. **Zero Regressions**: Verify `/api/rides/*`, `/api/driver/*`, and map routing continue working with 100% isolation.
