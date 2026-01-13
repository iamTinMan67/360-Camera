import { useState } from 'react'
import { Calendar, Plus, X } from 'lucide-react'
import { useEvents } from '../context/EventContext'

export default function EventSelector({ selectedEvent, onSelectEvent, onCreateEvent }) {
  const { events } = useEvents()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [newEventType, setNewEventType] = useState('wedding')
  const [newEventDate, setNewEventDate] = useState('')

  const handleCreateEvent = (e) => {
    e.preventDefault()
    if (!newEventName.trim()) {
      alert('Please enter an event name')
      return
    }

    const event = onCreateEvent({
      name: newEventName,
      type: newEventType,
      date: newEventDate || new Date().toISOString().split('T')[0],
      description: ''
    })

    onSelectEvent(event.id)
    setShowCreateModal(false)
    setNewEventName('')
    setNewEventDate('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          Select Event:
        </label>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-sm"
        >
          <Plus className="inline-block h-4 w-4 mr-1" />
          New Event
        </button>
      </div>

      <select
        value={selectedEvent || ''}
        onChange={(e) => onSelectEvent(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
      >
        <option value="">-- Select an event --</option>
        {events.map(event => (
          <option key={event.id} value={event.id}>
            {event.name} ({event.type}) - {new Date(event.date).toLocaleDateString()}
          </option>
        ))}
      </select>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-yellow-50 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Create New Event</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
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
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                >
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
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
