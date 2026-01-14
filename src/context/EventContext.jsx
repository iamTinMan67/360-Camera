import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

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
  const [deviceType, setDeviceType] = useState(() => {
    // Load device type preference from localStorage
    const saved = localStorage.getItem('cameraDeviceType')
    return saved || 'mobile' // Default to mobile
  })

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

  const createEvent = async (eventData) => {
    const localId = Date.now().toString()
    
    // Create event in Supabase first
    let supabaseEventId = null
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          name: eventData.name,
          type: eventData.type || 'other',
          date: eventData.date
        })
        .select('id')
        .single()
      
      if (error) {
        console.error('Error creating event in Supabase:', error)
        // Continue anyway - event will work locally but QR won't work
      } else {
        supabaseEventId = data.id
      }
    } catch (error) {
      console.error('Error syncing event to Supabase:', error)
      // Continue anyway
    }
    
    const newEvent = {
      id: localId,
      supabaseEventId, // Store Supabase UUID for QR access
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

  // Save device type to localStorage
  useEffect(() => {
    localStorage.setItem('cameraDeviceType', deviceType)
  }, [deviceType])

  const value = {
    events,
    currentEvent,
    setCurrentEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    addMediaToEvent,
    deleteMediaFromEvent,
    getEventById,
    deviceType,
    setDeviceType
  }

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}
