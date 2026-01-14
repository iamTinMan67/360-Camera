import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Image as ImageIcon, Video, ArrowLeft, AlertCircle } from 'lucide-react'
import { supabase } from '../config/supabase'

export default function EventAccess() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [event, setEvent] = useState(null)
  const [media, setMedia] = useState([])

  useEffect(() => {
    const loadEventByToken = async () => {
      setLoading(true)
      setError(null)

      try {
        // Look up the access link by token
        const { data: accessLink, error: accessError } = await supabase
          .from('event_access_links')
          .select('event_id, expires_at')
          .eq('token', token)
          .limit(1)
          .maybeSingle()

        if (accessError) {
          // Surface the real error (often RLS / missing policy)
          throw new Error(`Access link lookup failed: ${accessError.message}`)
        }

        if (!accessLink) {
          throw new Error('Invalid or expired access link (no match for this token).')
        }

        if (accessLink.expires_at && new Date(accessLink.expires_at) < new Date()) {
          throw new Error('This access link has expired.')
        }

        // Fetch event details
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', accessLink.event_id)
          .single()

        if (eventError) {
          throw new Error(`Event lookup failed: ${eventError.message}`)
        }

        if (!eventData) {
          throw new Error('Event not found (no match for event_id).')
        }

        // Fetch media for this event
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('event_id', accessLink.event_id)
          .order('created_at', { ascending: false })

        if (mediaError) {
          throw new Error(`Media lookup failed: ${mediaError.message}`)
        }

        setEvent(eventData)
        setMedia(mediaData || [])
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
              {item.type === 'photo' ? (
                <img
                  src={item.public_url || item.url}
                  alt={`Photo from ${event.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={item.public_url || item.url}
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

