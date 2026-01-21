import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import { useAuth } from './AuthContext'

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
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const EVENTS_CACHE_KEY = 'events_cache_v1'
  const CURRENT_EVENT_KEY = 'currentEvent_v1'

  // Load current event from localStorage on mount (kiosk flow depends on this)
  useEffect(() => {
    const savedCurrentEvent = localStorage.getItem(CURRENT_EVENT_KEY)
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
      localStorage.setItem(CURRENT_EVENT_KEY, JSON.stringify(currentEvent))
    } else {
      localStorage.removeItem(CURRENT_EVENT_KEY)
    }
  }, [currentEvent])

  const cacheEvents = useCallback((nextEvents) => {
    try {
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(nextEvents || []))
    } catch (e) {
      console.warn('Failed to cache events:', e)
    }
  }, [])

  const loadEventsFromCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(EVENTS_CACHE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.warn('Failed to load cached events:', e)
      return []
    }
  }, [])

  const normalizeSupabaseEvent = (row) => ({
    id: row.id, // use Supabase UUID as primary ID
    supabaseEventId: row.id,
    name: row.name,
    type: row.type || 'other',
    date: row.date,
    createdAt: row.created_at || new Date().toISOString(),
    // Media is stored in Supabase `media` table; keep empty array here to avoid UI crashes.
    media: [],
    photoCount: 0,
    videoCount: 0
  })

  const loadEventsFromSupabase = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id,name,type,date,created_at')
      .order('date', { ascending: false })

    if (error) throw error

    const rows = data || []

    const countMedia = async (eventId, type) => {
      try {
        const { count, error: countError } = await supabase
          .from('media')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('type', type)

        if (countError) return 0
        return count || 0
      } catch {
        return 0
      }
    }

    // Best-effort counts so the admin event cards reflect Supabase uploads across browsers.
    return await Promise.all(
      rows.map(async (row) => {
        const base = normalizeSupabaseEvent(row)
        const [photoCount, videoCount] = await Promise.all([
          countMedia(row.id, 'photo'),
          countMedia(row.id, 'video')
        ])
        return { ...base, photoCount, videoCount }
      })
    )
  }, [])

  // Keep events list Supabase-primary for admins; cache to localStorage as fallback.
  useEffect(() => {
    if (authLoading) return

    const run = async () => {
      if (!isAuthenticated) {
        // Non-admin should not see event list; keep currentEvent for kiosk capture.
        setEvents([])
        return
      }

      try {
        const supaEvents = await loadEventsFromSupabase()
        setEvents(supaEvents)
        cacheEvents(supaEvents)
      } catch (e) {
        console.warn('Failed to load events from Supabase; using cached fallback.', e)
        const cached = loadEventsFromCache()
        setEvents(cached)
      }
    }

    run()
  }, [authLoading, isAuthenticated, loadEventsFromSupabase, cacheEvents, loadEventsFromCache])

  const createEvent = async (eventData) => {
    const localId = Date.now().toString()

    // Supabase-primary: create in Supabase first.
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
        throw error
      }

      const newEvent = {
        id: data.id,
        supabaseEventId: data.id,
        ...eventData,
        createdAt: new Date().toISOString(),
        media: []
      }

      setEvents(prev => {
        const next = [...prev, newEvent]
        cacheEvents(next)
        return next
      })
      return newEvent
    } catch (error) {
      console.error('Error creating event in Supabase (fallback to local cache):', error)
    }

    // Fallback: local-only event (won't be visible cross-browser until created in Supabase)
    const newEvent = {
      id: localId,
      supabaseEventId: null,
      ...eventData,
      createdAt: new Date().toISOString(),
      media: [],
      localOnly: true
    }
    setEvents(prev => {
      const next = [...prev, newEvent]
      cacheEvents(next)
      return next
    })
    return newEvent
  }

  const updateEvent = (eventId, updates) => {
    setEvents(prev => {
      const next = prev.map(event =>
        event.id === eventId ? { ...event, ...updates } : event
      )
      cacheEvents(next)
      return next
    })

    // Best-effort sync to Supabase if this event has a Supabase ID and admin is logged in
    const target = events.find(e => e.id === eventId)
    const supabaseId = target?.supabaseEventId
    if (isAuthenticated && supabaseId) {
      supabase
        .from('events')
        .update({
          name: updates.name,
          type: updates.type,
          date: updates.date
        })
        .eq('id', supabaseId)
        .then(({ error }) => {
          if (error) console.error('Supabase event update failed:', error)
        })
    }
  }

  const deleteEvent = (eventId) => {
    const target = events.find(e => e.id === eventId)
    const supabaseId = target?.supabaseEventId

    setEvents(prev => {
      const next = prev.filter(event => event.id !== eventId)
      cacheEvents(next)
      return next
    })

    if (currentEvent?.id === eventId) {
      setCurrentEvent(null)
    }

    // Best-effort delete in Supabase (admin only)
    if (isAuthenticated && supabaseId) {
      supabase
        .from('events')
        .delete()
        .eq('id', supabaseId)
        .then(({ error }) => {
          if (error) console.error('Supabase event delete failed:', error)
        })
    }
  }

  const addMediaToEvent = (eventId, mediaItem) => {
    setEvents(prev =>
      prev.map(event => {
        if (event.id === eventId) {
          // Don't store full base64 data in localStorage to avoid quota issues
          // Only store metadata and Supabase URL if available
          const mediaToStore = {
            ...mediaItem,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
          }
          
          // If we have a Supabase URL, prefer that over base64
          if (mediaItem.supabaseUrl) {
            // Store minimal data - just metadata and Supabase URL
            const { data, ...metadata } = mediaToStore
            return {
              ...event,
              media: [...event.media, { ...metadata, supabaseUrl: mediaItem.supabaseUrl }]
            }
          }
          
          // Fallback: store base64 but truncate if too large (>1MB)
          if (mediaItem.data && mediaItem.data.length > 1000000) {
            console.warn('Media too large for localStorage, storing metadata only')
            const { data, ...metadata } = mediaToStore
            return {
              ...event,
              media: [...event.media, metadata]
            }
          }
          
          return {
            ...event,
            media: [...event.media, mediaToStore]
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
