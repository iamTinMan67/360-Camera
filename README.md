# 360 Camera - Event Photo Booth App

A modern web application for capturing and managing photos and videos at social events like weddings, birthdays, and celebrations. Built with React, Tailwind CSS, and WebRTC.

## Features

- 📸 **Photo Capture**: Take high-quality photos using your device camera
- 🎥 **Video Recording**: Record videos with audio support
- 📅 **Event Management**: Create and organize events (weddings, birthdays, etc.)
- 🖼️ **Media Gallery**: View all captured media in a beautiful gallery
- 💾 **Local Storage**: All data stored locally in your browser
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- 🔄 **Camera Switching**: Switch between front and back cameras
- 📥 **Download**: Download your photos and videos

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:8080`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Create an Event**: Go to the Camera page and create a new event (e.g., "John & Jane's Wedding")
2. **Start Camera**: Click "Start Camera" to access your device's camera
3. **Capture Media**: 
   - Click "Take Photo" to capture a photo
   - Click "Record Video" to start recording, then "Stop Recording" when done
4. **Save to Event**: Select an event and click "Save to Event" to save your media
5. **View Events**: Navigate to the Events page to see all your events
6. **Browse Gallery**: Visit the Gallery page to see all media from all events

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari (iOS 11+)
- Mobile browsers with camera support

**Note**: Camera access requires HTTPS in production. For local development, localhost works fine.

## Data Storage

All events and media are stored locally in your browser using:
- `localStorage` for event metadata
- Base64 encoding for media storage

**Important**: Data is stored locally and will be cleared if you clear your browser data. Consider implementing cloud backup for production use.

## Features Roadmap

- [ ] Cloud storage integration
- [ ] Background music support
- [ ] Photo filters and effects
- [ ] Countdown timer for photos
- [ ] QR code sharing
- [ ] Social media sharing
- [ ] Print support
- [ ] Multiple camera support (for 360 booths)

## License

This project is open source and available for personal and commercial use.

## Support

For issues or questions, please open an issue on GitHub.
