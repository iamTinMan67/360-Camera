import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Image as ImageIcon, Video, ArrowLeft, AlertCircle, Download } from 'lucide-react'
// For guest access we call the Edge Function directly (simpler + explicit JSON body).

export default function EventAccess() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [event, setEvent] = useState(null)
  const [media, setMedia] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const downloadMedia = async (item) => {
    const url = item.signed_url || item.public_url || item.url
    if (!url) return

    setDownloadingId(item.id)
    try {
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`Download failed: ${resp.status} ${resp.statusText}`)
      }
      const blob = await resp.blob()

      const extFromPath = (path) => {
        if (!path) return null
        const last = path.split('/').pop() || ''
        const parts = last.split('.')
        return parts.length > 1 ? parts.pop() : null
      }

      const ext =
        extFromPath(item.storage_path) ||
        (item.type === 'photo' ? 'jpg' : 'webm')

      const filename = `${event?.name || 'event'}-${item.type}-${item.id}.${ext}`

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      // Fallback: open in a new tab so the user can manually save
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    const loadEventByToken = async () => {
      setLoading(true)
      setError(null)

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/guest-gallery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            // If you're using a publishable key (sb_publishable_...), it is NOT a JWT.
            // In that case you must disable "Verify JWT" for the Edge Function in Supabase.
            ...(supabaseAnonKey?.startsWith('eyJ') ? { Authorization: `Bearer ${supabaseAnonKey}` } : {})
          },
          body: JSON.stringify({ token })
        })

        const data = await resp.json().catch(() => ({}))

        if (!resp.ok) {
          throw new Error(data?.error || `Unable to load guest gallery (${resp.status})`)
        }

        if (!data?.event) {
          throw new Error(data?.error || 'Invalid or expired access link.')
        }

        setEvent(data.event)
        setMedia(data.media || [])
      } catch (err) {
        setError(err.message || 'Something went wrong loading this event.')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadEventByToken()
    }
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-600">Loading event gallery...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Cannot Access Event</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link to="/" className="btn-primary">
            <ArrowLeft className="inline-block mr-2 h-5 w-5" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!event) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-purple-600 mb-2">{event.name}</h1>
          {event.date && (
            <p className="text-gray-600">
              {new Date(event.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>
        <Link to="/" className="inline-flex items-center text-purple-500 hover:text-purple-600">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Link>
      </div>

      {media.length === 0 ? (
        <div className="card text-center py-12">
          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Media Available</h2>
          <p className="text-gray-600">Media for this event is not available yet. Please check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative bg-black rounded-lg overflow-hidden aspect-square"
            >
              <button
                type="button"
                onClick={() => downloadMedia(item)}
                disabled={downloadingId === item.id}
                className="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-60 w-10 h-10"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </button>
              {item.type === 'photo' ? (
                <img
                  src={item.signed_url || item.public_url || item.url}
                  alt={`Photo from ${event.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={item.signed_url || item.public_url || item.url}
                    className="w-full h-full object-cover"
                    controls
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Video className="h-12 w-12 text-white opacity-80" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

