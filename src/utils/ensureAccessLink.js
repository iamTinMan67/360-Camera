export async function ensureAccessLink({
  supabaseUrl,
  supabaseKey,
  adminPassword,
  eventId,
  expiresHours = 48
}) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/ensure-access-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      ...(supabaseKey?.startsWith('eyJ') ? { Authorization: `Bearer ${supabaseKey}` } : {}),
      'x-admin-password': adminPassword
    },
    body: JSON.stringify({ event_id: eventId, expires_hours: expiresHours })
  })

  const data = await resp.json().catch(() => ({}))

  if (!resp.ok) {
    throw new Error(data?.error || `ensure-access-link failed (${resp.status})`)
  }

  if (!data?.token) {
    throw new Error('ensure-access-link returned no token')
  }

  return data
}

