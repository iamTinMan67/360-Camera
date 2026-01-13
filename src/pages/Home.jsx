import { Link } from 'react-router-dom'
import { Camera, Video, Image as ImageIcon, ArrowRight } from 'lucide-react'
import { useEvents } from '../context/EventContext'

export default function Home() {
  const { currentEvent } = useEvents()

  // Show blank page if no event is selected
  if (!currentEvent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-400 mb-2">No Event Selected</h2>
          <p className="text-gray-500">Please wait for an event to be loaded</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-purple-600">
          {currentEvent.name}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Choose your mode to start capturing photos and videos
        </p>
      </div>

      {/* Navigation Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Photo Booth Card */}
        <Link
          to="/camera"
          className="card hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group cursor-pointer"
        >
          <div className="text-center space-y-6">
            <div className="bg-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto group-hover:bg-purple-200 transition-colors">
              <Camera className="h-12 w-12 text-purple-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-purple-600 mb-2">Photo Booth</h2>
              <p className="text-gray-600 mb-4">
                Capture stunning photos with your device camera. High-quality images saved instantly.
              </p>
              <div className="flex items-center justify-center text-purple-600 font-semibold group-hover:text-purple-700">
                <span className="mr-2">Get Started</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <ImageIcon className="h-4 w-4" />
                <span>Photo Capture</span>
              </div>
            </div>
          </div>
        </Link>

        {/* 360 Card */}
        <Link
          to="/camera?mode=video"
          className="card hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group cursor-pointer"
        >
          <div className="text-center space-y-6">
            <div className="bg-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto group-hover:bg-purple-200 transition-colors">
              <Video className="h-12 w-12 text-purple-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-purple-600 mb-2">360</h2>
              <p className="text-gray-600 mb-4">
                Record memorable videos of your events. Perfect for capturing special moments in motion.
              </p>
              <div className="flex items-center justify-center text-purple-600 font-semibold group-hover:text-purple-700">
                <span className="mr-2">Get Started</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Video className="h-4 w-4" />
                <span>Video Recording</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
