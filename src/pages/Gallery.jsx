import { Link } from 'react-router-dom'
import { Image as ImageIcon, Video, Calendar, ArrowRight } from 'lucide-react'
import { useEvents } from '../context/EventContext'

export default function Gallery() {
  const { events } = useEvents()

  // Get all media from all events
  const allMedia = events.flatMap(event =>
    event.media.map(media => ({
      ...media,
      eventName: event.name,
      eventId: event.id,
      eventType: event.type
    }))
  )

  // Sort by timestamp (newest first)
  const sortedMedia = [...allMedia].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  )

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

  if (sortedMedia.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gallery</h1>
        <div className="card text-center py-12">
          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Media Yet</h2>
          <p className="text-gray-600 mb-6">Start capturing photos and videos to see them here</p>
          <Link to="/camera" className="btn-primary">
            Start Capturing
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gallery</h1>
        <div className="text-sm text-gray-600">
          {sortedMedia.length} {sortedMedia.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedMedia.map(media => (
          <Link
            key={media.id}
            to={`/events/${media.eventId}`}
            className="relative group bg-black rounded-lg overflow-hidden aspect-square"
          >
            {media.type === 'photo' ? (
              <img
                src={media.data}
                alt={`Photo from ${media.eventName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="relative w-full h-full">
                <video
                  src={media.data}
                  className="w-full h-full object-cover"
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="h-12 w-12 text-white opacity-80" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="text-white text-sm font-semibold mb-1">{media.eventName}</div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getEventTypeColor(media.eventType)}`}>
                    {media.eventType}
                  </span>
                  <ArrowRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
