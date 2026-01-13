import { useState, useRef, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Camera as CameraIcon, Video, Square, Download, X, AlertCircle, RefreshCw, Cloud, Share2, Copy, Check } from 'lucide-react'
import { useEvents } from '../context/EventContext'
import { uploadToFileIO, uploadMultipleToFileIO } from '../utils/fileio'

export default function Camera() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'photo' // 'photo' or 'video'
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  
  const [stream, setStream] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [capturedMedia, setCapturedMedia] = useState(null)
  const [facingMode, setFacingMode] = useState('user') // 'user' or 'environment'
  const [cameraError, setCameraError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shotCount, setShotCount] = useState(1) // 1, 2, or 3 shots
  const [videoSpeed, setVideoSpeed] = useState(1.0) // 0.5 (slow-mo), 1.0 (normal), 2.0 (fast)
  const [capturedShots, setCapturedShots] = useState([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedLinks, setUploadedLinks] = useState([])
  const [copiedLink, setCopiedLink] = useState(null)
  
  const { currentEvent, addMediaToEvent } = useEvents()

  // Auto-start camera when component mounts
  useEffect(() => {
    const initCamera = async () => {
      if (!stream && !cameraError) {
        await startCamera()
      }
    }
    initCamera()
    
    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  useEffect(() => {
    // Cleanup stream when it changes
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const getErrorMessage = (error) => {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return {
        title: 'Camera Permission Denied',
        message: 'Please allow camera access in your browser settings.',
        steps: [
          'Look for the camera icon in your browser\'s address bar',
          'Click it and select "Allow" for camera and microphone',
          'Refresh the page and try again',
          'Alternatively, check your browser settings:',
          '  • Chrome/Edge: Settings > Privacy and security > Site settings > Camera',
          '  • Firefox: Preferences > Privacy & Security > Permissions > Camera',
          '  • Safari: Preferences > Websites > Camera'
        ]
      }
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return {
        title: 'No Camera Found',
        message: 'No camera device was detected on your system.',
        steps: [
          'Make sure a camera is connected to your device',
          'Check if another application is using the camera',
          'Try disconnecting and reconnecting your camera',
          'On mobile devices, ensure the camera app is closed'
        ]
      }
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return {
        title: 'Camera Already in Use',
        message: 'The camera is being used by another application.',
        steps: [
          'Close other applications that might be using the camera',
          'Close video conferencing apps (Zoom, Teams, etc.)',
          'Close other browser tabs using the camera',
          'Try refreshing the page'
        ]
      }
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      return {
        title: 'Camera Constraints Not Supported',
        message: 'Your camera doesn\'t support the requested settings.',
        steps: [
          'Try using a different camera (switch between front/back)',
          'Refresh the page and try again',
          'Your camera may not support the requested resolution'
        ]
      }
    } else {
      return {
        title: 'Camera Access Error',
        message: `An error occurred: ${error.message || error.name}`,
        steps: [
          'Make sure you\'re using a modern browser (Chrome, Firefox, Edge, Safari)',
          'Check if your browser supports camera access',
          'Try refreshing the page',
          'Ensure you\'re using HTTPS (or localhost for development)'
        ]
      }
    }
  }

  const startCamera = async () => {
    setCameraError(null)
    setIsLoading(true)
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      setCameraError(null)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      const errorInfo = getErrorMessage(error)
      setCameraError(errorInfo)
    } finally {
      setIsLoading(false)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCapturedMedia(null)
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return

    setIsCapturing(true)
    const shots = []
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    // Determine delay based on shot count: 2 shots = 2 seconds, 3 shots = 3 seconds
    const delayBetweenShots = shotCount === 2 ? 2000 : shotCount === 3 ? 3000 : 0

    for (let i = 0; i < shotCount; i++) {
      // Capture immediately for first shot, then wait for subsequent shots
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenShots))
      }
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0)

      const blob = await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95)
      })

      if (blob) {
        const url = URL.createObjectURL(blob)
        shots.push({
          type: 'photo',
          url: url,
          blob: blob,
          timestamp: new Date().toISOString()
        })
      }
    }

    setCapturedShots(shots)
    if (shots.length > 0) {
      setCapturedMedia(shots[0]) // Show first shot as preview
    }
    setIsCapturing(false)
  }

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    // Fallback to default
    return ''
  }

  const startRecording = () => {
    if (!stream) return

    chunksRef.current = []
    
    // Apply playback rate to video element for preview
    if (videoRef.current) {
      videoRef.current.playbackRate = videoSpeed
    }

    const mimeType = getSupportedMimeType()
    const options = mimeType ? { mimeType } : {}

    let mediaRecorder
    let recordedMimeType = mimeType || 'video/webm'

    try {
      mediaRecorder = new MediaRecorder(stream, options)
      // Store the actual mime type used by the recorder
      recordedMimeType = mediaRecorder.mimeType || recordedMimeType
    } catch (error) {
      console.error('Error creating MediaRecorder:', error)
      // Try without mime type specification
      try {
        mediaRecorder = new MediaRecorder(stream)
        recordedMimeType = mediaRecorder.mimeType || 'video/webm'
      } catch (fallbackError) {
        console.error('Error creating MediaRecorder (fallback):', fallbackError)
        alert('Unable to start video recording. Your browser may not support video recording.')
        return
      }
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      // Use the actual mime type from the recorder, or fallback
      const blobType = recordedMimeType.split(';')[0] || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: blobType })
      const url = URL.createObjectURL(blob)
      setCapturedMedia({
        type: 'video',
        url: url,
        blob: blob,
        timestamp: new Date().toISOString(),
        speed: videoSpeed,
        mimeType: recordedMimeType
      })
    }

    mediaRecorder.start()
    mediaRecorderRef.current = mediaRecorder
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const saveMedia = async () => {
    if (!currentEvent) {
      alert('No event selected. Please log in as admin to select an event.')
      return
    }

    const eventId = currentEvent.id
    setIsUploading(true)
    setUploadedLinks([])

    try {
      if (mode === 'photo' && capturedShots.length > 0) {
        // Save all shots with file.io upload
        const shotCount = capturedShots.length
        const files = capturedShots.map((shot, index) => 
          new File(
            [shot.blob],
            `photo-${currentEvent.name}-${Date.now()}-${index + 1}.jpg`,
            { type: 'image/jpeg' }
          )
        )

        // Upload all shots to file.io
        const uploadResults = await uploadMultipleToFileIO(files, {
          maxDownloads: 100, // Allow multiple downloads
          autoDelete: false
        })

        const links = []
        for (let i = 0; i < capturedShots.length; i++) {
          const shot = capturedShots[i]
          const uploadResult = uploadResults[i]
          
          // Save to local storage (base64)
          const file = files[i]
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64Data = reader.result
            addMediaToEvent(eventId, {
              type: 'photo',
              data: base64Data,
              timestamp: shot.timestamp,
              fileioLink: uploadResult.success ? uploadResult.link : null,
              fileioKey: uploadResult.success ? uploadResult.key : null
            })
          }
          reader.readAsDataURL(file)

          if (uploadResult.success) {
            links.push(uploadResult.link)
          }
        }

        setUploadedLinks(links)
        setCapturedShots([])
        setCapturedMedia(null)
        
        if (links.length > 0) {
          alert(`${shotCount} photo(s) saved and uploaded to cloud! ${links.length} file.io link(s) created.`)
        } else {
          alert(`${shotCount} photo(s) saved locally. Cloud upload failed.`)
        }
      } else if (capturedMedia) {
        // Save single video or photo with file.io upload
        const file = new File(
          [capturedMedia.blob],
          `${capturedMedia.type}-${currentEvent.name}-${Date.now()}.${capturedMedia.type === 'photo' ? 'jpg' : 'webm'}`,
          { type: capturedMedia.type === 'photo' ? 'image/jpeg' : 'video/webm' }
        )

        // Upload to file.io
        const uploadResult = await uploadToFileIO(file, {
          maxDownloads: 100,
          autoDelete: false
        })

        // Save to local storage
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Data = reader.result
          addMediaToEvent(eventId, {
            type: capturedMedia.type,
            data: base64Data,
            timestamp: capturedMedia.timestamp,
            speed: capturedMedia.speed,
            fileioLink: uploadResult.success ? uploadResult.link : null,
            fileioKey: uploadResult.success ? uploadResult.key : null
          })
        }
        reader.readAsDataURL(file)

        if (uploadResult.success) {
          setUploadedLinks([uploadResult.link])
          alert('Media saved and uploaded to cloud! File.io link created.')
        } else {
          alert('Media saved locally. Cloud upload failed: ' + uploadResult.error)
        }

        setCapturedMedia(null)
      }
    } catch (error) {
      console.error('Error saving media:', error)
      alert('Error saving media: ' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const downloadMedia = () => {
    if (!capturedMedia) return

    const videoExtension = capturedMedia.mimeType?.includes('mp4') ? 'mp4' : 'webm'
    const a = document.createElement('a')
    a.href = capturedMedia.url
    a.download = `${capturedMedia.type}-${Date.now()}.${capturedMedia.type === 'photo' ? 'jpg' : videoExtension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
    stopCamera()
    setTimeout(() => startCamera(), 100)
  }


  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            {mode === 'video' ? '360 Video' : 'Photo Booth'}
          </h1>
          <Link
            to="/"
            className="text-purple-600 hover:text-purple-700 text-sm font-semibold"
          >
            ← Back to Home
          </Link>
        </div>
        
        {mode === 'photo' ? (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Select Number of Shots:</label>
            <div className="flex gap-3">
              <button
                onClick={() => setShotCount(1)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  shotCount === 1
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                1 Shot
              </button>
              <button
                onClick={() => setShotCount(2)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  shotCount === 2
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                2 Shots
              </button>
              <button
                onClick={() => setShotCount(3)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  shotCount === 3
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                3 Shots
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Video Speed:</label>
            <div className="flex gap-3">
              <button
                onClick={() => setVideoSpeed(0.5)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  videoSpeed === 0.5
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Slow-Mo (0.5x)
              </button>
              <button
                onClick={() => setVideoSpeed(1.0)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  videoSpeed === 1.0
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Normal (1x)
              </button>
              <button
                onClick={() => setVideoSpeed(2.0)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  videoSpeed === 2.0
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Fast (2x)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {stream ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                {capturedMedia && (
                  <div className="absolute inset-0 bg-black">
                    {capturedMedia.type === 'photo' ? (
                      <img
                        src={capturedMedia.url}
                        alt="Captured"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <video
                        src={capturedMedia.url}
                        controls
                        className="w-full h-full"
                      />
                    )}
                  </div>
                )}
              </>
            ) : cameraError ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{cameraError.title}</h3>
                <p className="text-gray-300 mb-4">{cameraError.message}</p>
                <div className="bg-gray-900 rounded-lg p-4 max-w-md w-full text-left">
                  <p className="text-sm font-semibold text-white mb-2">Troubleshooting Steps:</p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    {cameraError.steps.map((step, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-purple-400 mr-2">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={startCamera}
                    className="btn-primary"
                  >
                    <RefreshCw className="inline-block mr-2 h-4 w-4" />
                    Try Again
                  </button>
                  <button
                    onClick={() => setCameraError(null)}
                    className="btn-secondary"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-16 w-16 mb-4 animate-spin" />
                    <p className="text-sm">Starting camera...</p>
                  </>
                ) : (
                  <>
                    <CameraIcon className="h-16 w-16 mb-4" />
                    <p className="text-sm">Camera will start automatically</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap justify-center gap-4">
            {isLoading ? (
              <div className="flex items-center space-x-2 text-purple-600">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Starting camera...</span>
              </div>
            ) : stream ? (
              <>
                <button onClick={toggleFacingMode} className="btn-secondary">
                  Switch Camera
                </button>
                {mode === 'photo' ? (
                  <button 
                    onClick={capturePhoto} 
                    className="btn-primary" 
                    disabled={!!capturedMedia || isCapturing}
                  >
                    <CameraIcon className="inline-block mr-2 h-5 w-5" />
                    {isCapturing ? `Capturing ${capturedShots.length + 1}/${shotCount}...` : `Take ${shotCount} Photo${shotCount > 1 ? 's' : ''}`}
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <button onClick={startRecording} className="btn-primary" disabled={!!capturedMedia}>
                        <Video className="inline-block mr-2 h-5 w-5" />
                        Record Video
                      </button>
                    ) : (
                      <button onClick={stopRecording} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg">
                        <Square className="inline-block mr-2 h-5 w-5" />
                        Stop Recording
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <button 
                onClick={startCamera} 
                className="btn-primary"
              >
                <RefreshCw className="inline-block mr-2 h-5 w-5" />
                Retry Camera
              </button>
            )}

            {(capturedMedia || capturedShots.length > 0) && (
              <>
                <button onClick={downloadMedia} className="btn-secondary" disabled={isUploading}>
                  <Download className="inline-block mr-2 h-5 w-5" />
                  Download
                </button>
                {currentEvent && (
                  <button 
                    onClick={saveMedia} 
                    className="btn-primary"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Cloud className="inline-block mr-2 h-5 w-5 animate-pulse" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Cloud className="inline-block mr-2 h-5 w-5" />
                        Save & Upload
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setCapturedMedia(null)
                    setCapturedShots([])
                    setUploadedLinks([])
                  }}
                  className="btn-secondary"
                  disabled={isUploading}
                >
                  <X className="inline-block mr-2 h-5 w-5" />
                  Discard
                </button>
              </>
            )}

            {uploadedLinks.length > 0 && (
              <div className="card bg-purple-50 border-2 border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-purple-700 flex items-center">
                    <Share2 className="h-5 w-5 mr-2" />
                    Cloud Upload Complete!
                  </h3>
                </div>
                <div className="space-y-2">
                  {uploadedLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-3">
                      <input
                        type="text"
                        value={link}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(link)
                          setCopiedLink(index)
                          setTimeout(() => setCopiedLink(null), 2000)
                        }}
                        className="btn-secondary text-sm px-3 py-2"
                        title="Copy link"
                      >
                        {copiedLink === index ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary text-sm px-3 py-2"
                      >
                        Open
                      </a>
                    </div>
                  ))}
                  <p className="text-xs text-gray-600 mt-2">
                    Files are stored in the cloud and can be shared via these links
                  </p>
                </div>
              </div>
            )}
          </div>

          {isRecording && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span className="font-semibold">Recording... ({videoSpeed}x speed)</span>
              </div>
            </div>
          )}
          {isCapturing && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-full">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span className="font-semibold">Capturing {capturedShots.length + 1}/{shotCount}...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
