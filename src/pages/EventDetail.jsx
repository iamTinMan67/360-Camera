import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Image as ImageIcon, Video, Trash2, Download, X, Share2, Check, QrCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEvents } from '../context/EventContext'
import { useAuth } from '../context/AuthContext'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../config/supabase'

export default function EventDetail() {
  const { eventId } = useParams()
  const { getEventById, deleteMediaFromEvent, updateEvent } = useEvents()
  const { isAuthenticated } = useAuth()
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [qrToken, setQrToken] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState(null)
  const [showQrModal, setShowQrModal] = useState(false)

  const event = getEventById(eventId)

  useEffect(() => {
    const ensureAccessLink = async () => {
      if (!eventId || !isAuthenticated || !event) return

      setQrLoading(true)
      setQrError(null)

      try {
        // If event doesn't have a Supabase ID, try to create/find it in Supabase
        let supabaseEventId = event.supabaseEventId
        
        if (!supabaseEventId) {
          // Try to find existing event in Supabase by name and date
          const { data: existingEvent, error: findError } = await supabase
            .from('events')
            .select('id')
            .eq('name', event.name)
            .eq('date', event.date)
            .limit(1)
            .maybeSingle()
          
          if (findError) {
            throw new Error(`Failed to check Supabase: ${findError.message}`)
          }
          
          if (existingEvent?.id) {
            supabaseEventId = existingEvent.id
            // Update local event with Supabase ID
            updateEvent(eventId, { supabaseEventId })
          } else {
            // Create new event in Supabase
            const { data: newEvent, error: createError } = await supabase
              .from('events')
              .insert({
                name: event.name,
                type: event.type || 'other',
                date: event.date
              })
              .select('id')
              .single()
            
            if (createError) {
              throw new Error(`Failed to create event in Supabase: ${createError.message}`)
            }
            
            supabaseEventId = newEvent.id
            // Update local event with Supabase ID
            updateEvent(eventId, { supabaseEventId })
          }
        }

        // Try to find an existing access link for this event
        const { data: existing, error: fetchError } = await supabase
          .from('event_access_links')
          .select('token')
          .eq('event_id', supabaseEventId)
          .limit(1)
          .maybeSingle()

        if (fetchError) {
          throw fetchError
        }

        if (existing?.token) {
          setQrToken(existing.token)
          return
        }

        // Create a new access link if none exists
        const token = crypto.randomUUID()

        const { data: created, error: insertError } = await supabase
          .from('event_access_links')
          .insert({
            event_id: supabaseEventId,
            token
          })
          .select('token')
          .single()

        if (insertError) {
          throw insertError
        }

        setQrToken(created.token)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating event access link', error)
        setQrError(`Unable to generate QR access link: ${error.message || 'Unknown error'}`)
      } finally {
        setQrLoading(false)
      }
    }

    ensureAccessLink()
  }, [eventId, isAuthenticated, event])

  if (!event) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Event Not Found</h2>
        <Link to="/events" className="btn-primary mt-4">
          <ArrowLeft className="inline-block mr-2 h-5 w-5" />
          Back to Events
        </Link>
      </div>
    )
  }

  const handleDeleteMedia = (mediaId) => {
    if (!isAuthenticated) {
      alert('Admin login required to delete media. Please log in first.')
      setShowDeleteConfirm(null)
      return
    }
    deleteMediaFromEvent(eventId, mediaId)
    setShowDeleteConfirm(null)
    if (selectedMedia?.id === mediaId) {
      setSelectedMedia(null)
    }
  }

  const handleDeleteClick = (mediaId, mediaType) => {
    if (!isAuthenticated) {
      alert('Admin login required to delete media. Please log in first.')
      return
    }
    setShowDeleteConfirm({ id: mediaId, type: mediaType })
  }

  const downloadMedia = (media) => {
    const link = document.createElement('a')
    link.href = media.supabaseUrl || media.data
    link.download = `${media.type}-${media.id}.${media.type === 'photo' ? 'jpg' : 'webm'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getEventTypeColor = (type) => {
    const colors = {
      wedding: 'bg-pink-100 text-pink-700',
      birthday: 'bg-purple-100 text-purple-700',
      anniversary: 'bg-purple-100 text-purple-700',
      corporate: 'bg-gray-100 text-gray-700',
      graduation: 'bg-green-100 text-green-700',
      other: 'bg-yellow-100 text-yellow-700'
    }
    return colors[type] || colors.other
  }

  return (
    <div className="space-y-6">
      <Link to="/events" className="inline-flex items-center text-purple-500 hover:text-purple-600">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back to Events
      </Link>

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-purple-600 mb-2">{event.name}</h1>
            <div className="flex items-center space-x-4 text-gray-600">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getEventTypeColor(event.type)}`}>
                {event.type}
              </span>
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(event.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {event.media.filter(m => m.type === 'photo').length}
              </div>
              <div className="text-sm text-gray-600">Photos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {event.media.filter(m => m.type === 'video').length}
              </div>
              <div className="text-sm text-gray-600">Videos</div>
            </div>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                disabled={qrLoading || !qrToken}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <QrCode className="h-5 w-5 mr-2" />
                {qrLoading ? 'Preparing QR…' : 'Guest QR Access'}
              </button>
            )}
          </div>
        </div>
      </div>

      {event.media.length === 0 ? (
        <div className="card text-center py-12">
          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Media Yet</h2>
          <p className="text-gray-600 mb-6">Start capturing photos and videos for this event</p>
          <Link to="/camera" className="btn-primary">
            Start Capturing
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {event.media.map(media => (
              <div
                key={media.id}
                className="relative group cursor-pointer bg-black rounded-lg overflow-hidden aspect-square"
                onClick={() => setSelectedMedia(media)}
              >
                {media.type === 'photo' ? (
                  <img
                    src={media.supabaseUrl || media.data}
                    alt={`Photo from ${event.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <video
                      src={media.supabaseUrl || media.data}
                      className="w-full h-full object-cover"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="h-12 w-12 text-white opacity-80" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadMedia(media)
                      }}
                      className="bg-white text-purple-600 p-2 rounded-full hover:bg-gray-100"
                      title="Download"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    {media.supabaseUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(media.supabaseUrl)
                          setCopiedLink(media.id)
                          setTimeout(() => setCopiedLink(null), 2000)
                        }}
                        className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700"
                        title="Copy Supabase link"
                      >
                        {copiedLink === media.id ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Share2 className="h-5 w-5" />
                        )}
                      </button>
                    )}
                    {isAuthenticated && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(media.id, media.type)
                        }}
                        className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                        title="Delete media"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedMedia && (
            <div
              className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedMedia(null)}
            >
              <div className="max-w-5xl w-full max-h-full">
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
                >
                  <X className="h-6 w-6" />
                </button>
                {selectedMedia.type === 'photo' ? (
                  <img
                    src={selectedMedia.supabaseUrl || selectedMedia.data}
                    alt="Full size"
                    className="max-w-full max-h-[90vh] mx-auto object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <video
                    src={selectedMedia.supabaseUrl || selectedMedia.data}
                    controls
                    autoPlay
                    className="max-w-full max-h-[90vh] mx-auto"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 relative">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold mb-4 text-center">Guest Access QR</h2>
            {qrError ? (
              <p className="text-red-600 text-center mb-4">{qrError}</p>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  {qrToken && (
                    <QRCodeCanvas
                      value={`${window.location.origin}/event-access/${qrToken}`}
                      size={220}
                      level="H"
                      includeMargin
                    />
                  )}
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Guests can scan this code to view photos and videos for this event.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-yellow-50 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Delete Media?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this {showDeleteConfirm.type}? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMedia(showDeleteConfirm.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
