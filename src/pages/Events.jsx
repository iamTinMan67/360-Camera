import { useNavigate } from 'react-router-dom'
import { Calendar, Plus, Trash2, Image as ImageIcon, Video, Edit2, X, QrCode, AlertCircle } from 'lucide-react'
import { useEvents } from '../context/EventContext'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../config/supabase'
import { ensureAccessLink } from '../utils/ensureAccessLink'

export default function Events() {
  const navigate = useNavigate()
  const { events, deleteEvent, setCurrentEvent, getEventById, createEvent, updateEvent } = useEvents()
  const { isAuthenticated, logout } = useAuth()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showEditModal, setShowEditModal] = useState(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrEvent, setQrEvent] = useState(null)
  const [qrToken, setQrToken] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState(null)
  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const [albumEvent, setAlbumEvent] = useState(null)
  const [albumLoading, setAlbumLoading] = useState(false)
  const [albumError, setAlbumError] = useState(null)
  const [albumMedia, setAlbumMedia] = useState([])
  const [albumSelected, setAlbumSelected] = useState(null)
  const [albumDeletingId, setAlbumDeletingId] = useState(null)
  const [albumSelectedIds, setAlbumSelectedIds] = useState([])
  const [albumBulkDownloading, setAlbumBulkDownloading] = useState(false)
  const [albumBulkProgress, setAlbumBulkProgress] = useState({ current: 0, total: 0 })
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: '',
    date: new Date().toISOString().slice(0, 10) // default to today
  })

  const ensureSupabaseEventId = async (event) => {
    let supabaseEventId = event.supabaseEventId
    if (supabaseEventId) return supabaseEventId

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
      updateEvent(event.id, { supabaseEventId })
      return supabaseEventId
    }

    const { data: createdEvent, error: createError } = await supabase
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

    supabaseEventId = createdEvent.id
    updateEvent(event.id, { supabaseEventId })
    return supabaseEventId
  }

  const openGuestQr = async (event) => {
    if (!isAuthenticated) {
      alert('Admin login required to generate guest QR codes.')
      return
    }

    setShowQrModal(true)
    setQrEvent(event)
    setQrToken(null)
    setQrError(null)
    setQrLoading(true)

    try {
      // Ensure the event has a Supabase UUID
      const supabaseEventId = await ensureSupabaseEventId(event)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { token } = await ensureAccessLink({
        supabaseUrl,
        supabaseKey,
        adminPassword: 'Sal@SB',
        eventId: supabaseEventId,
        expiresHours: 48
      })

      setQrToken(token)
    } catch (e) {
      setQrError(e.message || 'Unable to generate QR code.')
    } finally {
      setQrLoading(false)
    }
  }

  const openAlbum = async (event) => {
    if (!isAuthenticated) {
      alert('Admin login required to view the album.')
      return
    }

    setShowAlbumModal(true)
    setAlbumEvent(event)
    setAlbumSelected(null)
    setAlbumSelectedIds([])
    setAlbumError(null)
    setAlbumMedia([])
    setAlbumLoading(true)

    try {
      const supabaseEventId = await ensureSupabaseEventId(event)

      const { data: mediaRows, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', supabaseEventId)
        .eq('type', 'photo')
        .order('created_at', { ascending: false })

      if (mediaError) {
        throw new Error(`Failed to load media: ${mediaError.message}`)
      }

      const withSigned = await Promise.all(
        (mediaRows || []).map(async (item) => {
          if (!item.storage_path) return item
          const { data: signed, error: signedError } = await supabase.storage
            .from('event-media')
            .createSignedUrl(item.storage_path, 60 * 60)

          if (signedError) return item
          return { ...item, signed_url: signed.signedUrl }
        })
      )

      setAlbumMedia(withSigned)
    } catch (e) {
      setAlbumError(e.message || 'Unable to load album.')
    } finally {
      setAlbumLoading(false)
    }
  }

  const deleteAlbumItem = async (item) => {
    if (!isAuthenticated) return
    if (!item?.id) return

    const ok = window.confirm('Delete this photo? This will remove it from Supabase Storage and the media table.')
    if (!ok) return

    setAlbumDeletingId(item.id)
    try {
      // Best effort: remove from storage first
      if (item.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('event-media')
          .remove([item.storage_path])
        if (storageError) {
          throw new Error(`Storage delete failed: ${storageError.message}`)
        }
      }

      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', item.id)

      if (dbError) {
        throw new Error(`DB delete failed: ${dbError.message}`)
      }

      setAlbumMedia((prev) => prev.filter((m) => m.id !== item.id))
      if (albumSelected?.id === item.id) setAlbumSelected(null)
    } catch (e) {
      alert(e.message || 'Delete failed.')
    } finally {
      setAlbumDeletingId(null)
    }
  }

  const toggleAlbumSelect = (id) => {
    setAlbumSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllAlbum = () => {
    setAlbumSelectedIds(albumMedia.map((m) => m.id))
  }

  const clearAlbumSelection = () => {
    setAlbumSelectedIds([])
  }

  const downloadAlbumItem = async (item) => {
    const url = item?.signed_url || item?.public_url
    if (!url) throw new Error('No downloadable URL available for this item.')

    const extFromPath = (path) => {
      if (!path) return null
      const last = path.split('/').pop() || ''
      const parts = last.split('.')
      return parts.length > 1 ? parts.pop() : null
    }

    const ext = extFromPath(item.storage_path) || 'jpg'
    const safeName = (albumEvent?.name || 'event').replace(/[^\w\- ]+/g, '').trim() || 'event'
    const filename = `${safeName}-photo-${item.id}.${ext}`

    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`)
    const blob = await resp.blob()

    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  }

  const downloadSelectedAlbum = async () => {
    const selected = albumMedia.filter((m) => albumSelectedIds.includes(m.id))
    if (selected.length === 0) return

    setAlbumBulkDownloading(true)
    setAlbumBulkProgress({ current: 0, total: selected.length })
    try {
      for (let i = 0; i < selected.length; i++) {
        setAlbumBulkProgress({ current: i + 1, total: selected.length })
        // eslint-disable-next-line no-await-in-loop
        await downloadAlbumItem(selected[i])
        // Small delay to reduce browser “multiple downloads” throttling
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250))
      }
    } catch (e) {
      alert(e.message || 'Bulk download failed.')
    } finally {
      setAlbumBulkDownloading(false)
      setAlbumBulkProgress({ current: 0, total: 0 })
    }
  }

  const handleSelectEvent = (eventId) => {
    const event = getEventById(eventId)
    if (event) {
      setCurrentEvent(event)
      // Device is fixed (iPad A16). Kiosk flow: auto-logout admin and go to Home.
      logout()
      navigate('/')
    }
  }

  const handleDelete = (eventId) => {
    if (!isAuthenticated) {
      alert('Admin login required to delete events. Please log in first.')
      setShowDeleteConfirm(null)
      return
    }
    deleteEvent(eventId)
    setShowDeleteConfirm(null)
  }

  const handleSaveEvent = async (e) => {
    e.preventDefault()
    if (showEditModal === 'new') {
      const payload = {
        ...editFormData,
        // If event type is blank, store as 'other' for consistent styling
        type: editFormData.type || 'other'
      }
      const newEvent = await createEvent(payload)
      setCurrentEvent(newEvent)
      // Device is fixed (iPad A16). Kiosk flow: auto-logout admin and go to Home.
      logout()
      navigate('/')
    } else {
      const payload = {
        ...editFormData,
        type: editFormData.type || 'other'
      }
      updateEvent(showEditModal, payload)
    }
    setShowEditModal(null)
    setEditFormData({
      name: '',
      type: '',
      date: new Date().toISOString().slice(0, 10)
    })
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
      <div className="flex items-center justify-between">
        <div className="w-24" /> {/* Spacer to balance the button width */}
        <h1 className="text-3xl font-bold text-center flex-1">Events</h1>
        <button
          onClick={() => setShowEditModal('new')}
          className="btn-primary w-24"
        >
          <Plus className="inline-block mr-2 h-5 w-5" />
          New Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Events Yet</h2>
          <p className="text-gray-600 mb-6">Create your first event to start capturing memories</p>
          <button
            onClick={() => setShowEditModal('new')}
            className="btn-primary"
          >
            <Plus className="inline-block mr-2 h-5 w-5" />
            Create Your First Event
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map(event => (
            <div key={event.id} className="card hover:shadow-2xl transition-shadow py-6 px-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-purple-700 mb-3">{event.name}</h3>
                  <div className="flex items-center space-x-3 mb-3">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getEventTypeColor(event.type)}`}>
                      {event.type}
                    </span>
                  </div>
                  <div className="flex items-center text-base text-gray-700 mb-3">
                    <Calendar className="h-5 w-5 mr-2" />
                    {new Date(event.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                {isAuthenticated && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openGuestQr(event)}
                      className="text-purple-600 hover:text-purple-700 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                      title="Guest QR"
                    >
                      <QrCode className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openAlbum(event)}
                      className="text-purple-600 hover:text-purple-700 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                      title="Album"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditFormData({
                          name: event.name,
                          type: event.type,
                          date: event.date
                        })
                        setShowEditModal(event.id)
                      }}
                      className="text-purple-600 hover:text-purple-700 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                      title="Edit event"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(event.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete event"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-base text-gray-600 mb-5">
                <div className="flex items-center space-x-6">
                  <span className="flex items-center">
                    <ImageIcon className="h-5 w-5 mr-2" />
                    {typeof event.photoCount === 'number'
                      ? event.photoCount
                      : event.media.filter(m => m.type === 'photo').length}
                  </span>
                  <span className="flex items-center">
                    <Video className="h-5 w-5 mr-2" />
                    {typeof event.videoCount === 'number'
                      ? event.videoCount
                      : event.media.filter(m => m.type === 'video').length}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleSelectEvent(event.id)}
                className="block w-full btn-primary text-center"
              >
                Select App
              </button>
            </div>
          ))}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-yellow-50 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Delete Event?</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this event? All associated media will be deleted as well.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-yellow-50 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {showEditModal === 'new' ? 'Create New Event' : 'Edit Event'}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(null)
                  setEditFormData({ name: '', type: '', date: '' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  placeholder="e.g., John & Jane's Wedding"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={editFormData.type}
                  onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                >
                  <option value="">Optional</option>
                  <option value="wedding">Wedding</option>
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="corporate">Corporate Event</option>
                  <option value="graduation">Graduation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(null)
                    setEditFormData({ name: '', type: '', date: '' })
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  {showEditModal === 'new' ? 'Create Event' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 relative">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              title="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold mb-2 text-center">Guest Gallery QR</h2>
            <p className="text-sm text-gray-600 text-center mb-4">
              {qrEvent ? `Event: ${qrEvent.name}` : ''}
            </p>
            {qrLoading ? (
              <div className="text-center text-gray-600">Preparing QR…</div>
            ) : qrError ? (
              <p className="text-red-600 text-center">{qrError}</p>
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
                {qrToken && (
                  <div className="text-xs text-gray-600 break-all text-center">
                    {`${window.location.origin}/event-access/${qrToken}`}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showAlbumModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAlbumModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              title="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold mb-2">Album</h2>
            <p className="text-sm text-gray-600 mb-4">
              {albumEvent ? `Event: ${albumEvent.name}` : ''}
            </p>

            {albumLoading ? (
              <div className="text-center text-gray-600">Loading photos…</div>
            ) : albumError ? (
              <div className="card bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-red-700">Could not load album</div>
                    <div className="text-sm text-red-700">{albumError}</div>
                  </div>
                </div>
              </div>
            ) : albumMedia.length === 0 ? (
              <div className="card text-center py-10">
                <ImageIcon className="h-14 w-14 text-gray-400 mx-auto mb-3" />
                <div className="text-xl font-semibold text-gray-700 mb-1">No photos yet</div>
                <div className="text-gray-600">Upload photos to Supabase to see them here.</div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{albumSelectedIds.length}</span> selected
                    {albumBulkDownloading && (
                      <span className="ml-2 text-gray-500">
                        Downloading {albumBulkProgress.current}/{albumBulkProgress.total}…
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllAlbum}
                      className="btn-secondary text-sm px-3 py-2"
                      disabled={albumMedia.length === 0 || albumBulkDownloading}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearAlbumSelection}
                      className="btn-secondary text-sm px-3 py-2"
                      disabled={albumSelectedIds.length === 0 || albumBulkDownloading}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={downloadSelectedAlbum}
                      className="btn-primary text-sm px-3 py-2"
                      disabled={albumSelectedIds.length === 0 || albumBulkDownloading}
                      title="Download selected photos"
                    >
                      Download selected
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {albumMedia.map((item) => (
                    <div key={item.id} className="relative group bg-black rounded-lg overflow-hidden aspect-square">
                      <div className="absolute top-2 left-2 z-20">
                        <label className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 cursor-pointer">
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={albumSelectedIds.includes(item.id)}
                            onChange={() => toggleAlbumSelect(item.id)}
                            disabled={albumBulkDownloading}
                          />
                          <span
                            className={`w-4 h-4 rounded-sm border border-white ${
                              albumSelectedIds.includes(item.id) ? 'bg-white' : 'bg-transparent'
                            }`}
                          />
                        </label>
                      </div>
                      <img
                        src={item.signed_url || item.public_url}
                        alt="Event photo"
                        className="w-full h-full object-cover"
                        onClick={() => setAlbumSelected(item)}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between gap-2">
                        <span className="truncate">Photo</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteAlbumItem(item)
                          }}
                          disabled={albumDeletingId === item.id}
                          className="text-white hover:text-red-200 disabled:opacity-60"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {albumSelected && (
                  <div
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
                    onClick={() => setAlbumSelected(null)}
                  >
                    <div className="max-w-5xl w-full max-h-full">
                      <button
                        type="button"
                        onClick={() => setAlbumSelected(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 z-[61] bg-black/50 rounded-full p-2"
                        title="Close"
                      >
                        <X className="h-6 w-6" />
                      </button>
                      <img
                        src={albumSelected.signed_url || albumSelected.public_url}
                        alt="Full size"
                        className="max-w-full max-h-[90vh] mx-auto object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
