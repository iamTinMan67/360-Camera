# Authentication Setup

This app requires admin login to delete events and media. The app is accessible to everyone, but delete operations are protected.

## Setup Instructions

1. **Copy the example auth file:**
   ```bash
   cp src/config/auth.example.js src/config/auth.js
   ```

2. **Edit `src/config/auth.js` with your credentials:**
   ```javascript
   export const ADMIN_CREDENTIALS = {
     username: 'your_username',
     password: 'your_secure_password'
   }
   ```

3. **The `auth.js` file is gitignored** - it will not be committed to the repository for security.

## Default Credentials

The default credentials are:
- **Username:** `admin`
- **Password:** `admin123`

**⚠️ IMPORTANT:** Change these credentials immediately in production!

## How It Works

- **App Access:** Anyone can access the app and use all features (camera, create events, view gallery)
- **Delete Protection:** Delete buttons are visible to everyone, but clicking them requires admin login
- **Login:** Navigate to `/login` to log in as admin
- **Session:** Login persists in sessionStorage until browser is closed
- **Logout:** Click the logout button in the navigation bar

## Security Notes

- Credentials are stored in a JavaScript file (not encrypted)
- This is a client-side only solution
- For production use, consider implementing:
  - Server-side authentication
  - Encrypted password storage
  - JWT tokens
  - Role-based access control

## File Structure

```
src/
  config/
    auth.js          # Your credentials (gitignored)
    auth.example.js  # Example template (committed)
  context/
    AuthContext.jsx  # Authentication state management
  pages/
    Login.jsx       # Login page
```
