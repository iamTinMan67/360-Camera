import { createContext, useContext, useState, useEffect } from 'react'

const EventContext = createContext()

export function useEvents() {
  const context = useContext(EventContext)
  if (!context) {
    throw new Error('useEvents must be used within EventProvider')
  }
  return context
}

export function EventProvider({ children }) {
  const [events, setEvents] = useState([])
  const [currentEvent, setCurrentEvent] = useState(null)

  // Load events and current event from localStorage on mount
  useEffect(() => {
    const savedEvents = localStorage.getItem('events')
    if (savedEvents) {
      try {
        const parsedEvents = JSON.parse(savedEvents)
        setEvents(parsedEvents)
      } catch (error) {
        console.error('Error loading events:', error)
      }
    }
    
    const savedCurrentEvent = localStorage.getItem('currentEvent')
    if (savedCurrentEvent) {
      try {
        setCurrentEvent(JSON.parse(savedCurrentEvent))
      } catch (error) {
        console.error('Error loading current event:', error)
      }
    }
  }, [])

  // Save current event to localStorage whenever it changes
  useEffect(() => {
    if (currentEvent) {
      localStorage.setItem('currentEvent', JSON.stringify(currentEvent))
    } else {
      localStorage.removeItem('currentEvent')
    }
  }, [currentEvent])

  // Save events to localStorage whenever they change
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('events', JSON.stringify(events))
    }
  }, [events])

  const createEvent = (eventData) => {
    const newEvent = {
      id: Date.now().toString(),
      ...eventData,
      createdAt: new Date().toISOString(),
      media: []
    }
    setEvents(prev => [...prev, newEvent])
    return newEvent
  }

  const updateEvent = (eventId, updates) => {
    setEvents(prev =>
      prev.map(event =>
        event.id === eventId ? { ...event, ...updates } : event
      )
    )
  }

  const deleteEvent = (eventId) => {
    setEvents(prev => prev.filter(event => event.id !== eventId))
    if (currentEvent?.id === eventId) {
      setCurrentEvent(null)
    }
  }

  const addMediaToEvent = (eventId, mediaItem) => {
    setEvents(prev =>
      prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            media: [...event.media, { ...mediaItem, id: Date.now().toString(), timestamp: new Date().toISOString() }]
          }
        }
        return event
      })
    )
  }

  const deleteMediaFromEvent = (eventId, mediaId) => {
    setEvents(prev =>
      prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            media: event.media.filter(m => m.id !== mediaId)
          }
        }
        return event
      })
    )
  }

  const getEventById = (eventId) => {
    return events.find(event => event.id === eventId)
  }

  const value = {
    events,
    currentEvent,
    setCurrentEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    addMediaToEvent,
    deleteMediaFromEvent,
    getEventById
  }

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}
