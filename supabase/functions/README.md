# Supabase Edge Functions

This project uses a public guest gallery that is accessed via a QR token.

## Function: `guest-gallery`

Validates a QR token, enforces expiry, and returns:
- event metadata
- media rows (for that event)
- signed URLs for each media item (1 hour)

### Required secrets

Set these in Supabase Dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Deploy (CLI)

```bash
supabase functions deploy guest-gallery
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co" SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

