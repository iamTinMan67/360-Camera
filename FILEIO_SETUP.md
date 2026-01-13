# File.io Cloud Upload Integration

This app uses file.io for cloud storage and sharing of photos and videos.

## How It Works

When you save media (photos or videos) to an event:
1. **Local Storage**: Media is saved locally in your browser (base64 encoded)
2. **Cloud Upload**: Media is automatically uploaded to file.io cloud storage
3. **Share Links**: You receive file.io download links that can be shared

## Features

- ✅ Automatic cloud upload when saving media
- ✅ Shareable download links for each file
- ✅ Copy link to clipboard with one click
- ✅ Open links directly in browser
- ✅ Files stored with 100 download limit (configurable)
- ✅ Files don't auto-delete (configurable)

## File.io Links

After uploading, you'll see:
- **Share Links**: Clickable file.io URLs for each uploaded file
- **Copy Button**: Copy link to clipboard
- **Open Button**: Open file in new tab

## File.io Plans

### Free Plan (Default)
- Files up to 2 GB
- Hourly upload limit: 4 GB
- Files auto-deleted after 1 download (we override this)

### Basic Plan ($25/month)
- Files up to 10 GB
- Unlimited downloads
- 2 TB permanent storage

### Premium Plan ($99/month)
- Files up to 100 GB
- 3 TB permanent storage
- Custom domain

## Configuration

Upload settings are configured in `src/utils/fileio.js`:
- `maxDownloads: 100` - Allow up to 100 downloads per file
- `autoDelete: false` - Don't auto-delete files

## Accessing Cloud Links

1. **After Upload**: Links appear immediately after saving media
2. **In Event Detail**: Hover over media items to see share button (if cloud link exists)
3. **Copy & Share**: Click the share icon to copy the link to clipboard

## Notes

- Files are stored both locally (for offline access) and in the cloud (for sharing)
- Cloud links are saved with each media item
- If cloud upload fails, media is still saved locally
- File.io links can be shared with anyone

## API Documentation

For more information about file.io API, visit:
https://www.file.io/developers
