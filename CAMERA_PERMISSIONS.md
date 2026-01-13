# Camera Permissions Troubleshooting Guide

If you're getting a "Permission denied" error when trying to access the camera, follow these steps:

## Quick Fixes

### 1. Check Browser Address Bar
- Look for a camera icon (📷) or lock icon in your browser's address bar
- Click it and select "Allow" for both Camera and Microphone
- Refresh the page

### 2. Browser Settings

#### Chrome / Edge
1. Click the lock icon in the address bar
2. Select "Site settings"
3. Set Camera and Microphone to "Allow"
4. Refresh the page

Or:
1. Go to `chrome://settings/content/camera` (or `edge://settings/content/camera`)
2. Make sure the site is not blocked
3. Add `http://localhost:8080` to allowed sites if needed

#### Firefox
1. Click the lock icon in the address bar
2. Click "More Information"
3. Go to "Permissions" tab
4. Set Camera and Microphone to "Allow"
5. Refresh the page

Or:
1. Go to `about:preferences#privacy`
2. Scroll to "Permissions" section
3. Click "Settings" next to Camera
4. Ensure the site is allowed

#### Safari (macOS)
1. Safari menu > Settings > Websites
2. Select "Camera" from the left sidebar
3. Find your site and set to "Allow"
4. Do the same for "Microphone"

#### Safari (iOS)
1. Settings app > Safari
2. Camera & Microphone Access > Allow

### 3. System-Level Permissions

#### Windows
1. Settings > Privacy > Camera
2. Make sure "Allow apps to access your camera" is ON
3. Make sure your browser is allowed

#### macOS
1. System Settings > Privacy & Security > Camera
2. Make sure your browser is checked/enabled

#### iOS
1. Settings > Privacy & Security > Camera
2. Make sure your browser is enabled

#### Android
1. Settings > Apps > [Your Browser]
2. Permissions > Camera > Allow

## Common Issues

### "Camera Already in Use"
- Close other apps using the camera (Zoom, Teams, Skype, etc.)
- Close other browser tabs that might be using the camera
- Restart your browser

### "No Camera Found"
- Make sure a camera is connected
- Check if the camera works in other apps
- Try unplugging and reconnecting USB cameras
- On mobile: ensure the camera app is closed

### "Permission Denied" After Allowing
1. Clear browser cache and cookies for the site
2. Close and reopen the browser
3. Try in an incognito/private window
4. Check if browser extensions are blocking camera access

### HTTPS Requirement
- Camera access requires HTTPS in production
- For development, `localhost` works fine
- If deploying, ensure your site uses HTTPS

## Testing Camera Access

You can test if your browser can access the camera by:

1. Opening browser console (F12)
2. Running this command:
   ```javascript
   navigator.mediaDevices.getUserMedia({ video: true, audio: true })
     .then(stream => {
       console.log('Camera access granted!');
       stream.getTracks().forEach(track => track.stop());
     })
     .catch(error => {
       console.error('Camera access denied:', error);
     });
   ```

## Still Having Issues?

1. **Try a different browser** - Some browsers handle permissions differently
2. **Check browser extensions** - Ad blockers or privacy extensions might block camera access
3. **Update your browser** - Make sure you're using the latest version
4. **Check firewall/antivirus** - Some security software blocks camera access
5. **Restart your device** - Sometimes a simple restart fixes permission issues

## Browser Compatibility

- ✅ Chrome 60+ (Recommended)
- ✅ Edge 79+
- ✅ Firefox 55+
- ✅ Safari 11+ (macOS/iOS)
- ⚠️ Older browsers may have limited support

## Need More Help?

If none of these solutions work:
1. Check the browser console for detailed error messages
2. Try the app in a different browser
3. Ensure your device has a working camera
4. Check if other websites can access your camera
