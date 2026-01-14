import { useNavigate } from 'react-router-dom'
import { Calendar, Plus, Trash2, Image as ImageIcon, Video, Edit2, X, Smartphone } from 'lucide-react'
import { useEvents } from '../context/EventContext'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Events() {
  const navigate = useNavigate()
  const { events, deleteEvent, setCurrentEvent, getEventById, createEvent, updateEvent, deviceType, setDeviceType } = useEvents()
  const { isAuthenticated, logout } = useAuth()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showEditModal, setShowEditModal] = useState(null)
  const [showDeviceSelection, setShowDeviceSelection] = useState(false)
  const [pendingEventId, setPendingEventId] = useState(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: '',
    date: new Date().toISOString().slice(0, 10) // default to today
  })

  const handleSelectEvent = (eventId) => {
    const event = getEventById(eventId)
    if (event) {
      setCurrentEvent(event)
      // Show device selection modal before navigating
      setPendingEventId(eventId)
      setShowDeviceSelection(true)
    }
  }

  const handleDeviceSelected = () => {
    // Auto-logout admin after device selection
    logout()
    // Navigate to home page
    setShowDeviceSelection(false)
    setPendingEventId(null)
    navigate('/')
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

  const handleSaveEvent = (e) => {
    e.preventDefault()
    if (showEditModal === 'new') {
      const payload = {
        ...editFormData,
        // If event type is blank, store as 'other' for consistent styling
        type: editFormData.type || 'other'
      }
      const newEvent = createEvent(payload)
      setCurrentEvent(newEvent)
      // Show device selection modal before navigating
      setPendingEventId(newEvent.id)
      setShowDeviceSelection(true)
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
                    {event.media.filter(m => m.type === 'photo').length}
                  </span>
                  <span className="flex items-center">
                    <Video className="h-5 w-5 mr-2" />
                    {event.media.filter(m => m.type === 'video').length}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleSelectEvent(event.id)}
                className="block w-full btn-primary text-center"
              >
                Select Event
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

      {showDeviceSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-yellow-50 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Select Device Type</h2>
              <button
                onClick={() => {
                  setShowDeviceSelection(false)
                  setPendingEventId(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Choose the device type that will be used for this event. This optimizes camera settings for better performance.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => {
                  setDeviceType('mobile')
                  handleDeviceSelected()
                }}
                className="w-full py-4 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-3 bg-purple-600 text-white hover:bg-purple-700"
              >
                <Smartphone className="h-6 w-6" />
                <span>Mobile/Tablet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
