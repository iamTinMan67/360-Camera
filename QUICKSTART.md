# Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - The app will automatically open at `http://localhost:3000`
   - Or manually navigate to that URL

## First Steps

### 1. Create Your First Event

1. Go to the **Camera** page
2. Click **"New Event"** button
3. Fill in:
   - Event Name (e.g., "John & Jane's Wedding")
   - Event Type (Wedding, Birthday, etc.)
   - Event Date
4. Click **"Create Event"**

### 2. Start Capturing

1. Click **"Start Camera"** to access your device camera
2. Allow camera permissions when prompted
3. Use **"Switch Camera"** to toggle between front/back camera
4. **Take Photo**: Click "Take Photo" to capture a photo
5. **Record Video**: Click "Record Video" to start, then "Stop Recording" when done

### 3. Save Your Media

1. After capturing, you'll see a preview
2. Make sure an event is selected in the dropdown
3. Click **"Save to Event"** to save to your event
4. Or click **"Download"** to save to your device

### 4. View Your Events

1. Go to the **Events** page to see all your events
2. Click on any event to view all media
3. Click on any photo/video to view it full-screen

### 5. Browse Gallery

1. Go to the **Gallery** page to see all media from all events
2. Click on any item to go to its event page

## Tips

- **Camera Access**: Make sure to allow camera permissions in your browser
- **HTTPS Required**: In production, camera access requires HTTPS. Localhost works fine for development.
- **Storage**: All data is stored locally in your browser. Clearing browser data will delete your events and media.
- **Best Practices**: 
  - Create events before capturing media
  - Name events clearly for easy organization
  - Download important media regularly as backup

## Troubleshooting

### Camera Not Working?
- Check browser permissions
- Try a different browser (Chrome/Edge recommended)
- Make sure you're using HTTPS in production

### Media Not Saving?
- Make sure you've selected an event before saving
- Check browser console for errors
- Ensure you have enough storage space

### Can't See Videos?
- Videos are saved in WebM format
- Make sure your browser supports WebM playback
- Try downloading and playing in a media player

## Browser Support

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari (iOS 11+)
- ⚠️ Older browsers may have limited support

## Next Steps

- Customize the UI colors in `tailwind.config.js`
- Add cloud storage for backup
- Implement photo filters and effects
- Add countdown timer for photos
- Enable QR code sharing
