# Testing Camera Permissions on Vercel

## Configuration Checklist

✅ **Headers Configured** (`vercel.json`):
- `Permissions-Policy: camera=*, microphone=*` (Modern browsers)
- `Feature-Policy: camera *; microphone *` (Legacy browsers)

✅ **HTTPS Required**: Vercel automatically provides HTTPS, which is required for camera access

✅ **Camera API**: Using `navigator.mediaDevices.getUserMedia()` correctly

## Testing Steps

### 1. Verify Headers Are Active

After deployment, check the response headers:

**Using Browser DevTools:**
1. Open your Vercel deployment URL
2. Open DevTools (F12)
3. Go to **Network** tab
4. Refresh the page
5. Click on the main document request (usually `index.html` or your domain)
6. Check **Headers** tab → **Response Headers**
7. Look for:
   - `Permissions-Policy: camera=*, microphone=*`
   - `Feature-Policy: camera *; microphone *`

**Using curl (command line):**
```bash
curl -I https://your-vercel-app.vercel.app
```

### 2. Test Camera Access

1. **Navigate to Camera Page**: Go to `/camera` or click "Photo Booth" card
2. **Check Browser Console**: Open DevTools Console (F12)
3. **Look for Errors**: Check for any permission-related errors
4. **Grant Permission**: When prompted, click "Allow" for camera and microphone
5. **Verify Video Stream**: The camera preview should appear

### 3. Browser-Specific Testing

#### Chrome/Edge
- Should auto-request permission on first visit
- Check address bar for camera icon
- Settings: `chrome://settings/content/camera`

#### Firefox
- May require explicit permission grant
- Check address bar lock icon → Permissions
- Settings: `about:preferences#privacy`

#### Safari
- Requires user interaction (button click)
- May need to click "Enable Camera" button
- Settings: Safari > Preferences > Websites > Camera

### 4. Common Issues & Solutions

#### Issue: "Permission denied" even after allowing
**Solution:**
- Clear browser cache and cookies for the site
- Check if site is using HTTPS (required)
- Verify headers are present in response
- Try incognito/private window

#### Issue: Camera works on localhost but not Vercel
**Solution:**
- Ensure Vercel deployment is using HTTPS (should be automatic)
- Check browser console for specific error messages
- Verify headers are being sent (see step 1)
- Check if browser extensions are blocking camera access

#### Issue: Headers not appearing
**Solution:**
- Verify `vercel.json` is in the root directory
- Check Vercel deployment logs for errors
- Ensure `vercel.json` syntax is correct (valid JSON)
- Redeploy after making changes

### 5. Debugging Commands

**Test camera access in browser console:**
```javascript
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    console.log('✅ Camera access granted!');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => {
    console.error('❌ Camera access denied:', error);
  });
```

**Check if getUserMedia is available:**
```javascript
console.log('MediaDevices available:', !!navigator.mediaDevices);
console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);
```

**Check current permissions:**
```javascript
navigator.permissions.query({ name: 'camera' })
  .then(result => console.log('Camera permission:', result.state));
```

## Expected Behavior

✅ **On First Visit:**
- Browser prompts for camera/microphone permission
- User clicks "Allow"
- Camera preview appears automatically (except Safari)

✅ **After Permission Granted:**
- Camera starts automatically (non-Safari browsers)
- Video preview shows immediately
- "Take Photo" / "Record Video" buttons become enabled when video is ready

✅ **Safari:**
- Shows "Enable Camera" button
- User must click button to request permission
- After permission granted, camera starts

## Verification Checklist

- [ ] Headers are present in response (check Network tab)
- [ ] Site is using HTTPS (check address bar)
- [ ] Browser prompts for permission (or shows "Enable Camera" button)
- [ ] Permission can be granted successfully
- [ ] Camera preview appears
- [ ] Video stream has valid dimensions (check console logs)
- [ ] "Take Photo" / "Record Video" buttons become enabled
- [ ] Photo capture works
- [ ] Video recording works

## Still Having Issues?

1. **Check Vercel Deployment Logs**: Look for any build or runtime errors
2. **Browser Console**: Check for JavaScript errors
3. **Network Tab**: Verify headers are being sent
4. **Try Different Browser**: Test in Chrome, Firefox, and Safari
5. **Check Browser Extensions**: Disable ad blockers or privacy extensions temporarily
6. **System Permissions**: Ensure OS-level camera permissions are granted for your browser

## Support

If issues persist:
- Share browser console errors
- Share Network tab headers screenshot
- Share browser and OS version
- Share specific error messages from the app
