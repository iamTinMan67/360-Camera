import { useState, useRef, useEffect } from 'react'
import { useSearchParams, Link, useLocation } from 'react-router-dom'
import { Camera as CameraIcon, Video, Square, Download, X, AlertCircle, RefreshCw, Cloud, Turtle, Rabbit, Gauge } from 'lucide-react'
import { useEvents } from '../context/EventContext'
import { useAuth } from '../context/AuthContext'
import { uploadMediaToSupabase } from '../utils/supabaseMedia'
import { supabase } from '../config/supabase'

export default function Camera() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'photo' // 'photo' or 'video'
  const location = useLocation()
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const recordingTimeoutRef = useRef(null)

  const [stream, setStream] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [capturedMedia, setCapturedMedia] = useState(null)
  // Fixed device profile: iPad (A16) using front camera
  const [facingMode] = useState('user')
  const [cameraError, setCameraError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shotCount, setShotCount] = useState(1) // 1, 2, 3, or 4 shots
  const [videoSpeed, setVideoSpeed] = useState(1.0) // 0.5 (slow-mo), 1.0 (normal), 2.0 (fast)
  const [capturedShots, setCapturedShots] = useState([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [countdownValue, setCountdownValue] = useState(0)
  const [initialCountdownValue, setInitialCountdownValue] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [streamIsLandscape, setStreamIsLandscape] = useState(false)
  const [isLoopRecording, setIsLoopRecording] = useState(false)
  
  const { currentEvent, addMediaToEvent, updateEvent } = useEvents()
  const { isAuthenticated } = useAuth()

  const requestFullscreenOrientation = async (orientation) => {
    // Best-effort: iOS Safari usually requires a user gesture for fullscreen/orientation lock.
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // ignore
    }

    try {
      if (screen?.orientation?.lock) {
        await screen.orientation.lock(orientation)
      }
    } catch {
      // ignore
    }
  }

  // Detect Safari browser
  const isSafari = () => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
           (navigator.userAgent.includes('Mac') && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'))
  }

  // Detect mobile/tablet devices
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform))
  }

  // Detect if device has multiple cameras (for better camera selection)
  const hasMultipleCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      return videoDevices.length > 1
    } catch {
      return false
    }
  }

  const getErrorMessage = (error) => {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      const safariSteps = isSafari() ? [
        'Click the "Enable Camera" button above to request permission',
        'When prompted, click "Allow" to grant camera access',
        'If you previously denied access, go to Safari > Preferences > Websites > Camera',
        'Find this website and change the setting to "Allow"',
        'Refresh the page and try again'
      ] : []
      
      return {
        title: 'Camera Permission Denied',
        message: 'Please allow camera access in your browser settings.',
        steps: [
          ...safariSteps,
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
        title: 'Camera Cannot Start',
        message: 'The camera could not be started. This usually means it\'s in use or there\'s a hardware issue.',
        steps: [
          'Close other applications that might be using the camera (Zoom, Teams, Skype, etc.)',
          'Close other browser tabs that are using the camera',
          'Try refreshing the page',
          'If on mobile, close the camera app and try again',
          'Restart your browser if the issue persists',
          'Check if your camera works in other applications',
          'On Windows: Settings > Privacy > Camera - ensure browser has permission',
          'On Mac: System Settings > Privacy & Security > Camera - ensure browser has permission'
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
    } else if (error.message && (error.message.toLowerCase().includes('videoinput') || error.message.toLowerCase().includes('starting videoinput'))) {
      return {
        title: 'Camera Hardware Initialization Failed',
        message: 'The camera hardware could not be started. All constraint attempts failed. This usually means the camera is in use or there\'s a hardware/driver issue.',
        steps: [
          '🔴 IMPORTANT: Close ALL other applications that might be using the camera:',
          '  • Video conferencing apps (Zoom, Teams, Skype, Google Meet)',
          '  • Other browser tabs with camera access',
          '  • Camera apps on your device',
          '  • Screen recording software',
          '',
          '🔄 Try these steps in order:',
          '1. Close this tab and all other browser tabs',
          '2. Completely quit and restart your browser',
          '3. Check Task Manager (Windows) or Activity Monitor (Mac) for camera processes',
          '4. Restart your computer',
          '',
          '💻 System-level checks:',
          '• Windows: Settings > Privacy > Camera - ensure browser has permission',
          '• Mac: System Settings > Privacy & Security > Camera - ensure browser has permission',
          '• Windows: Device Manager > Cameras - check for yellow warning icons',
          '• Test your camera in the native camera app to verify it works',
          '',
          '🌐 Browser-specific:',
          '• Try a different browser (Chrome, Firefox, Edge, Safari)',
          '• Clear browser cache and cookies',
          '• Try incognito/private mode',
          '',
          '🔌 Hardware (if external camera):',
          '• Unplug and reconnect the camera',
          '• Try a different USB port',
          '• Check if camera works in other applications'
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
          'Ensure you\'re using HTTPS (or localhost for development)',
          'Close other applications that might be using the camera',
          'Try restarting your browser'
        ]
      }
    }
  }

  const startCamera = async () => {
    setCameraError(null)
    setIsLoading(true)
    
    // Clean up any existing stream first (only if there is one)
    if (stream) {
      console.log('🎥 CAMERA DEBUG: Cleaning up existing stream before starting new one')
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
      // Wait a moment after cleanup before requesting new stream
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      // iOS Safari often needs more time to release the camera between sessions
      await new Promise(resolve => setTimeout(resolve, isLocalhost ? 150 : 800))
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null
    }
    
    try {
      const wantLandscape = mode === 'video'
      await requestFullscreenOrientation(wantLandscape ? 'landscape' : 'portrait')
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }

      // Fixed device profile: iPad (A16)
      const hasMultipleCams = await hasMultipleCameras()
      
      console.log('🎥 CAMERA DEBUG: Device profile:', {
        profile: 'ipad-a16-front-portrait',
        hasMultipleCams,
        userAgent: navigator.userAgent.substring(0, 50)
      })

      // Try with ideal constraints first, then fallback to basic constraints
      // Mobile devices: start with lower resolution for better performance
      // Desktop: start with higher resolution
      const photoConstraints = [
        // iPad A16 front camera, prefer portrait 3:4, higher quality first
        {
          video: {
            facingMode: { ideal: 'user' },
            // Avoid strict aspect ratio constraints on iOS Safari; we rotate/crop in UI/canvas as needed.
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1440 }
          },
          // Photo booth does not need microphone; requesting audio can break getUserMedia on iOS/production.
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        }
      ]

      const videoConstraints = [
        // iPhone 16 Pro Max front camera, prefer landscape 16:9 (video)
        {
          video: {
            facingMode: { ideal: 'user' },
            // Avoid strict aspect ratio constraints; keep requests conservative for iOS Safari reliability.
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          },
          // Start camera without microphone to reduce "Starting videoinput failed" cases on iOS.
          // (MediaRecorder may still record video-only; we can add mic later if desired.)
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          },
          audio: false
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        }
      ]

      const tryConstraints = [
        ...(mode === 'video' ? videoConstraints : photoConstraints),
        // fallbacks
        { video: { facingMode: { ideal: 'user' } }, audio: false },
        { video: true, audio: false },
        { video: { facingMode: { ideal: 'user' } }, audio: false },
        { video: true, audio: false }
      ]

      let mediaStream = null
      let lastError = null

      // Try to enumerate devices first to see what's available
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        console.log('🎥 CAMERA DEBUG: Available video devices:', videoDevices.length)
        videoDevices.forEach((device, index) => {
          console.log(`🎥 CAMERA DEBUG: Device ${index + 1}:`, {
            label: device.label || 'Unknown',
            deviceId: device.deviceId.substring(0, 20) + '...'
          })
        })
      } catch (enumError) {
        console.warn('⚠️ CAMERA DEBUG: Could not enumerate devices:', enumError)
      }

      // Wait before trying to access camera (gives hardware time to initialize/release)
      // Shorter delay for localhost, longer for production
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const waitTime = isLocalhost ? 100 : 500
      console.log(`🎥 CAMERA DEBUG: Waiting ${waitTime}ms before camera access (hardware initialization)`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Try each constraint set until one works
      for (let i = 0; i < tryConstraints.length; i++) {
        try {
          console.log(`🎥 CAMERA DEBUG: Trying camera constraints (attempt ${i + 1}/${tryConstraints.length}):`, tryConstraints[i])
          mediaStream = await navigator.mediaDevices.getUserMedia(tryConstraints[i])
          console.log('✅ CAMERA DEBUG: Camera access successful with constraints:', tryConstraints[i])
          break
        } catch (error) {
          console.warn(`⚠️ CAMERA DEBUG: Camera constraint attempt ${i + 1} failed:`, {
            name: error.name,
            message: error.message,
            constraint: tryConstraints[i]
          })
          lastError = error
          // Permission errors can be caused by microphone denial when audio:true.
          // If this attempt requested audio, try subsequent constraints that disable audio.
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            const requestedAudio = Boolean(tryConstraints[i]?.audio)
            const hasAudioFalseFallback = tryConstraints.slice(i + 1).some(c => c?.audio === false)
            if (requestedAudio && hasAudioFalseFallback) {
              continue
            }
            throw error
          }
          // If it's NotReadableError or videoinput error and we have more attempts, continue
          if (i < tryConstraints.length - 1) {
            // Wait before trying next constraint (gives hardware time to reset/release)
            // Shorter delay for localhost
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            const waitTime = error.message?.includes('videoinput') 
              ? (isLocalhost ? 200 : 500) 
              : (isLocalhost ? 100 : 300)
            console.log(`🎥 CAMERA DEBUG: Waiting ${waitTime}ms before next attempt (hardware reset)`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
      }

      if (!mediaStream) {
        // Log all failed attempts for debugging
        console.error('❌ CAMERA DEBUG: All constraint attempts failed')
        console.error('❌ CAMERA DEBUG: Last error:', lastError)
        
        // Provide more helpful error message
        const errorMessage = lastError?.message || 'Unknown error'
        if (errorMessage.includes('videoinput') || errorMessage.includes('Starting videoinput')) {
          // One more conservative retry after a longer delay (helps iOS Safari release the camera)
          console.warn('⚠️ CAMERA DEBUG: videoinput failed; retrying once with minimal constraints after delay...')
          await new Promise(resolve => setTimeout(resolve, 1500))
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          } catch (retryErr) {
            console.error('❌ CAMERA DEBUG: Minimal retry also failed:', retryErr)
            throw new Error('Camera hardware initialization failed. Please close other apps using the camera and try again.')
          }
        }
        if (!mediaStream) {
          throw lastError || new Error('Could not access camera with any constraints')
        }
      }

      setStream(mediaStream)
      setCameraError(null)
      setIsLoading(false) // Clear loading state immediately when stream is obtained
      
      console.log('🎥 CAMERA DEBUG: Stream obtained, setting to video element')
      console.log('🎥 CAMERA DEBUG: Stream tracks:', mediaStream.getTracks().map(t => ({
        kind: t.kind,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState
      })))
      
      // Wait for video element to be available (it might not be mounted yet)
      let retries = 0
      const maxRetries = 10
      while (!videoRef.current && retries < maxRetries) {
        console.log(`🎥 CAMERA DEBUG: Waiting for video element... (attempt ${retries + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }
      
      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = mediaStream
        // Ensure the element is actually visible to the browser's video pipeline (iOS Safari quirk)
        video.style.display = 'block'
        video.style.visibility = 'visible'
        video.style.opacity = '1'
        
        console.log('🎥 CAMERA DEBUG: Video element srcObject set')
        console.log('🎥 CAMERA DEBUG: Video element state:', {
          srcObject: !!video.srcObject,
          paused: video.paused,
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        })
        
        // Wait a moment for the stream to attach
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Explicitly play the video, especially important for Safari
        // Check if stream is still active before playing
        const activeTracks = mediaStream.getTracks().filter(t => t.readyState === 'live')
        if (activeTracks.length === 0) {
          console.warn('⚠️ CAMERA DEBUG: No active tracks in stream, cannot play video')
        } else {
          try {
            await video.play()
            console.log('🎥 CAMERA DEBUG: Video play() successful')
            
            // Check if ready immediately after play
            setTimeout(() => {
              const checkReady = () => {
                console.log('🎥 CAMERA DEBUG: Checking video readiness:', {
                  videoWidth: video.videoWidth,
                  videoHeight: video.videoHeight,
                  readyState: video.readyState,
                  paused: video.paused,
                  currentTime: video.currentTime
                })
                
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  console.log('✅ CAMERA DEBUG: Video ready! Dimensions:', {
                    width: video.videoWidth,
                    height: video.videoHeight
                  })
                  setVideoReady(true)
                } else {
                  console.warn('⚠️ CAMERA DEBUG: Video not ready yet, will keep checking...')
                  // Keep checking every 200ms for up to 3 seconds
                  setTimeout(() => {
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      console.log('✅ CAMERA DEBUG: Video ready after delay!')
                      setVideoReady(true)
                    } else {
                      console.warn('⚠️ CAMERA DEBUG: Video still not ready after delay')
                    }
                  }, 200)
                }
              }
              checkReady()
            }, 100)
          } catch (playError) {
            if (playError.name === 'AbortError' || playError.message?.includes('aborted')) {
              console.warn('⚠️ CAMERA DEBUG: Video play aborted (may be autoplay policy or element replaced)')
              // The useEffect will handle retrying when the element is ready
            } else {
              console.error('❌ CAMERA DEBUG: Video autoplay failed:', playError)
            }
          }
        }
      } else {
        console.warn('⚠️ CAMERA DEBUG: videoRef.current is still null after waiting, but stream is set. useEffect should handle it.')
        // The useEffect hook will handle setting the video element when it becomes available
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      const errorInfo = getErrorMessage(error)
      setCameraError(errorInfo)
      // Ensure stream is cleaned up on error
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }
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

  // Auto-start camera when component mounts (only on localhost).
  // On iOS / production browsers, camera permission often requires a user gesture.
  useEffect(() => {
    const initCamera = async () => {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

      if (isLocalhost && !isSafari() && !stream && !cameraError) {
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

  // If mode changes (photo <-> video), reset mode-specific state and restart the camera with new constraints.
  useEffect(() => {
    // Clear any captured overlay that can make the camera look "frozen"
    setCapturedMedia(null)
    setCapturedShots([])
    setIsRecording(false)
    setIsLoopRecording(false)
    setVideoReady(false)
    setStreamIsLandscape(false)

    // Restart camera to apply the correct constraints for the new mode.
    // Safari requires user interaction, so we don't auto-start there.
    stopCamera()
    if (!isSafari()) {
      startCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Ensure video plays when stream is set and check when it's ready (important for Safari)
  useEffect(() => {
    console.log('🎥 CAMERA DEBUG: useEffect triggered, stream:', !!stream, 'videoRef:', !!videoRef.current)
    
    // Clear loading state when stream is available
    if (stream) {
      setIsLoading(false)
    }
    
    if (stream && videoRef.current) {
      const video = videoRef.current
      
      // Set srcObject if it's not already set
      if (!video.srcObject || video.srcObject !== stream) {
        console.log('🎥 CAMERA DEBUG: Setting srcObject in useEffect')
        console.log('🎥 CAMERA DEBUG: Stream tracks before setting:', stream.getTracks().map(t => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted
        })))
        video.srcObject = stream
        console.log('🎥 CAMERA DEBUG: srcObject set, video state:', {
          srcObject: !!video.srcObject,
          readyState: video.readyState,
          paused: video.paused
        })
      } else {
        console.log('🎥 CAMERA DEBUG: srcObject already set correctly')
      }
      
      setVideoReady(false) // Reset ready state when stream changes
      
      console.log('🎥 CAMERA DEBUG: Setting up video readiness detection')
      
      const playVideo = async () => {
        // Check if stream is still active before trying to play
        if (!stream || stream.getTracks().length === 0) {
          console.warn('⚠️ CAMERA DEBUG: Stream not available, skipping play')
          return
        }
        
        const activeTracks = stream.getTracks().filter(t => t.readyState === 'live')
        if (activeTracks.length === 0) {
          console.warn('⚠️ CAMERA DEBUG: No active tracks, skipping play')
          return
        }
        
        // Check if video element is still valid
        if (!videoRef.current || videoRef.current.srcObject !== stream) {
          console.warn('⚠️ CAMERA DEBUG: Video element not valid, skipping play')
          return
        }
        
        console.log('🎥 CAMERA DEBUG: Attempting to play video, current state:', {
          paused: video.paused,
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          srcObject: !!video.srcObject
        })
        
        try {
          // Force play - sometimes need to call multiple times
          if (video.paused) {
            await video.play()
            console.log('✅ CAMERA DEBUG: Video play() successful in useEffect')
          } else {
            console.log('🎥 CAMERA DEBUG: Video already playing')
          }
        } catch (error) {
          // Handle specific error types
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            console.warn('⚠️ CAMERA DEBUG: Video play aborted by browser (may be autoplay policy or element replaced)')
            // Retry after a delay
            setTimeout(() => {
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.play().catch(err => console.warn('Retry play failed:', err))
              }
            }, 500)
          } else {
            console.error('❌ CAMERA DEBUG: Video play error in useEffect:', error)
            // Try again after a delay
            setTimeout(() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(err => console.warn('Retry play failed:', err))
              }
            }, 1000)
          }
        }
      }
      
      // Force play immediately and with delays - sometimes needed for browser autoplay policies
      playVideo()
      setTimeout(() => {
        playVideo()
      }, 100)
      setTimeout(() => {
        playVideo()
      }, 500)
      setTimeout(() => {
        playVideo()
      }, 1000)
      
      // Check if video is ready (more lenient check - just need valid dimensions)
      const checkVideoReady = () => {
        const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0
        const isReady = hasDimensions || video.readyState >= 2
        
        console.log('🎥 CAMERA DEBUG: checkVideoReady called:', {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState,
          hasDimensions,
          isReady,
          paused: video.paused,
          currentTime: video.currentTime
        })
        
        if (isReady) {
          console.log('✅ CAMERA DEBUG: Video is ready!')
          setVideoReady(true)
        } else {
          console.log('⚠️ CAMERA DEBUG: Video not ready yet')
          setVideoReady(false)
        }
      }
      
      // Check immediately
      checkVideoReady()
      
      // Also handle when video metadata is loaded
      const handleLoadedMetadata = () => {
        console.log('🎥 CAMERA DEBUG: Video metadata loaded')
        // Check if stream is still active before playing
        if (stream && stream.getTracks().some(t => t.readyState === 'live')) {
          video.play().catch(err => {
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
              console.warn('⚠️ CAMERA DEBUG: Video play aborted in handleLoadedMetadata (may be autoplay policy)')
            } else {
              console.warn('⚠️ CAMERA DEBUG: Video play on metadata loaded failed:', err)
            }
          })
        }
        checkVideoReady()
      }
      
      // Handle when video starts playing
      const handlePlaying = () => {
        console.log('Video is playing')
        checkVideoReady()
      }
      
      // Handle when video dimensions change
      const handleResize = () => {
        console.log('Video dimensions changed')
        checkVideoReady()
      }
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('playing', handlePlaying)
      video.addEventListener('resize', handleResize)
      
      // Periodic check as fallback - run for up to 10 seconds
      let checkCount = 0
      const maxChecks = 100 // 10 seconds at 100ms intervals
      const readyCheckInterval = setInterval(() => {
        // Check if video element and stream are still valid
        if (!videoRef.current || !stream || !videoRef.current.srcObject) {
          console.warn('⚠️ CAMERA DEBUG: Video element or stream no longer valid, stopping checks')
          clearInterval(readyCheckInterval)
          return
        }
        
        // Check if stream tracks are still active
        const activeTracks = stream.getTracks().filter(t => t.readyState === 'live')
        if (activeTracks.length === 0) {
          console.warn('⚠️ CAMERA DEBUG: No active tracks in stream, stopping checks')
          clearInterval(readyCheckInterval)
          return
        }
        
        checkVideoReady()
        checkCount++
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          console.log('✅ CAMERA DEBUG: Video ready detected in periodic check')
          clearInterval(readyCheckInterval)
        } else if (checkCount >= maxChecks) {
          // After 10 seconds, if still not ready, log warning
          console.warn('⚠️ CAMERA DEBUG: Video not ready after 10 seconds')
          console.warn('⚠️ CAMERA DEBUG: Video state:', {
            width: video.videoWidth,
            height: video.videoHeight,
            readyState: video.readyState,
            paused: video.paused,
            error: video.error?.message
          })
          clearInterval(readyCheckInterval)
        }
      }, 100)
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('playing', handlePlaying)
        video.removeEventListener('resize', handleResize)
        clearInterval(readyCheckInterval)
      }
    } else {
      setVideoReady(false)
    }
  }, [stream])

  // Countdown function with circular progress
  const startCountdown = (seconds) => {
    return new Promise((resolve) => {
      setIsCountingDown(true)
      setInitialCountdownValue(seconds)
      setCountdownValue(seconds)
      
      const interval = setInterval(() => {
        setCountdownValue((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            setIsCountingDown(false)
            setCountdownValue(0)
            setInitialCountdownValue(0)
            resolve()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    })
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing || isCountingDown) {
      console.warn('Capture blocked:', { 
        hasVideo: !!videoRef.current, 
        hasCanvas: !!canvasRef.current, 
        isCapturing,
        isCountingDown
      })
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Check if video is ready and has valid dimensions
    if (!video.videoWidth || !video.videoHeight) {
      console.error('Video not ready for capture:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        ended: video.ended
      })
      alert('Camera is not ready. Please wait a moment and try again.')
      return
    }

    console.log('Starting photo capture:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      shotCount
    })

    setIsCapturing(true)
    const shots = []
    const context = canvas.getContext('2d')

    // 5 second countdown before first shot, 3 seconds between subsequent shots
    const initialCountdown = 5
    const delayBetweenShots = 3

    try {
      // 5 second countdown before first shot
      await startCountdown(initialCountdown)

      for (let i = 0; i < shotCount; i++) {
        // 2 second delay after first shot, then 3 second countdown before subsequent shots
        if (i > 0) {
          // Wait 2 seconds after first shot
          await new Promise(resolve => setTimeout(resolve, 2000))
          // Then start 3 second countdown
          await startCountdown(delayBetweenShots)
          // Re-check video dimensions after delay
          if (!video.videoWidth || !video.videoHeight) {
            console.error('Video lost during capture')
            break
          }
        }
        
        // Force portrait output for iPad front camera
        const vw = video.videoWidth
        const vh = video.videoHeight
        const landscape = vw > vh

        if (landscape) {
          // Rotate 90deg clockwise into portrait canvas
          canvas.width = vh
          canvas.height = vw
          context.save()
          context.translate(canvas.width, 0)
          context.rotate(Math.PI / 2)
          context.drawImage(video, 0, 0, vw, vh)
          context.restore()
        } else {
          canvas.width = vw
          canvas.height = vh
          context.drawImage(video, 0, 0)
        }

        const blob = await new Promise((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              console.error('Failed to create blob from canvas')
            }
            resolve(blob)
          }, 'image/jpeg', 0.95)
        })

        if (blob) {
          const url = URL.createObjectURL(blob)
          shots.push({
            type: 'photo',
            url: url,
            blob: blob,
            timestamp: new Date().toISOString()
          })
          console.log(`Photo ${i + 1} captured successfully`)
        } else {
          console.error(`Failed to capture photo ${i + 1}`)
        }
      }

      setCapturedShots(shots)
      if (shots.length > 0) {
        setCapturedMedia(shots[0]) // Show first shot as preview
        console.log('Photo capture complete:', shots.length, 'shots')
        
        // Automatically download all captured shots
        setTimeout(() => {
          shots.forEach((shot, index) => {
            const a = document.createElement('a')
            a.href = shot.url
            a.download = `photo-${Date.now()}-${index + 1}.jpg`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            // Small delay between downloads to avoid browser blocking
            if (index < shots.length - 1) {
              setTimeout(() => {}, 100)
            }
          })
        }, 500) // Small delay to ensure UI updates
      } else {
        console.error('No photos captured')
        alert('Failed to capture photo. Please try again.')
      }
    } catch (error) {
      console.error('Error during photo capture:', error)
      alert('An error occurred while capturing the photo. Please try again.')
    } finally {
      setIsCapturing(false)
      setIsCountingDown(false)
      setCountdownValue(0)
    }
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

  const MAX_RECORDING_MS = 24000

  const autoSaveVideoAndLoop = async (blob, mimeType, timestamp) => {
    if (!currentEvent) {
      console.warn('Loop recording: no current event, skipping auto-save')
      return
    }

    const eventId = currentEvent.id

    try {
      // Create a file for upload
      const extension = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm'
      const file = new File(
        [blob],
        `video-${currentEvent.name}-${Date.now()}.${extension}`,
        { type: mimeType || 'video/webm' }
      )

      // Sync event to Supabase if needed (for loop recording)
      let supabaseEventId = currentEvent.supabaseEventId
      if (!supabaseEventId) {
        // Try to find or create event in Supabase
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id')
          .eq('name', currentEvent.name)
          .eq('date', currentEvent.date)
          .limit(1)
          .maybeSingle()
        
        if (existingEvent?.id) {
          supabaseEventId = existingEvent.id
          updateEvent(currentEvent.id, { supabaseEventId })
        } else {
          const { data: newEvent } = await supabase
            .from('events')
            .insert({
              name: currentEvent.name,
              type: currentEvent.type || 'other',
              date: currentEvent.date
            })
            .select('id')
            .single()
          
          if (newEvent?.id) {
            supabaseEventId = newEvent.id
            updateEvent(currentEvent.id, { supabaseEventId })
          }
        }
      }

      // Upload to Supabase (only)
      let supabaseUrl = null
      if (supabaseEventId) {
        const supabaseResult = await uploadMediaToSupabase(file, supabaseEventId, 'video')
        if (supabaseResult.success) {
          supabaseUrl = supabaseResult.publicUrl
        } else {
          console.error('Failed to upload video in loop:', supabaseResult.error, supabaseResult.details)
        }
      } else {
        console.warn('No supabaseEventId available for loop recording, skipping Supabase upload')
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const base64Data = reader.result
        addMediaToEvent(eventId, {
          type: 'video',
          data: base64Data,
          timestamp,
          speed: videoSpeed,
          supabaseUrl
        })
      }
      reader.readAsDataURL(file)

      // After saving, if loop is still enabled, start a new recording
      if (isLoopRecording) {
        startRecording()
      }
    } catch (error) {
      console.error('Error in loop auto-save:', error)
    }
  }

  const startRecording = async () => {
    if (!stream) {
      console.error('Cannot start recording: no stream available')
      alert('Camera stream is not available. Please ensure the camera is enabled.')
      return
    }

    // If there's already a captured video, discard it
    if (capturedMedia) {
      setCapturedMedia(null)
      // no-op: removed "Supabase Upload Complete" panel
    }

    // 5 second countdown before starting recording
    await startCountdown(5)

    console.log('Starting video recording:', {
      streamActive: stream.active,
      tracks: stream.getTracks().length,
      videoSpeed
    })

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
      console.log('MediaRecorder created:', {
        mimeType: recordedMimeType,
        state: mediaRecorder.state
      })
    } catch (error) {
      console.error('Error creating MediaRecorder:', error)
      // Try without mime type specification
      try {
        mediaRecorder = new MediaRecorder(stream)
        recordedMimeType = mediaRecorder.mimeType || 'video/webm'
        console.log('MediaRecorder created (fallback):', {
          mimeType: recordedMimeType,
          state: mediaRecorder.state
        })
      } catch (fallbackError) {
        console.error('Error creating MediaRecorder (fallback):', fallbackError)
        alert('Unable to start video recording. Your browser may not support video recording.')
        return
      }
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
        console.log('Recording data available:', event.data.size, 'bytes')
      }
    }

    mediaRecorder.onstop = () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }

      console.log('Recording stopped, chunks:', chunksRef.current.length)
      // Use the actual mime type from the recorder, or fallback
      const blobType = recordedMimeType.split(';')[0] || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: blobType })
      const url = URL.createObjectURL(blob)
      console.log('Video blob created:', {
        size: blob.size,
        type: blob.type
      })
      const videoData = {
        type: 'video',
        url: url,
        blob: blob,
        timestamp: new Date().toISOString(),
        speed: videoSpeed,
        mimeType: recordedMimeType
      }

      setCapturedMedia(videoData)

      // Auto-download recorded video for user convenience (similar to photo auto-download)
      try {
        const videoExtension = recordedMimeType?.includes('mp4') ? 'mp4' : 'webm'
        const a = document.createElement('a')
        a.href = url
        a.download = `video-${Date.now()}.${videoExtension}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch (downloadError) {
        console.error('Automatic video download failed:', downloadError)
      }

      // If loop recording is enabled, auto-save and restart
      if (isLoopRecording) {
        autoSaveVideoAndLoop(blob, recordedMimeType, videoData.timestamp)
      }
    }

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event)
      alert('An error occurred during recording. Please try again.')
      setIsRecording(false)
    }

    try {
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

      // Enforce max recording duration
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
      }
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('Max recording duration reached, stopping recording')
          mediaRecorderRef.current.stop()
          setIsRecording(false)
        }
      }, MAX_RECORDING_MS)

      console.log('Recording started successfully')
    } catch (error) {
      console.error('Error starting MediaRecorder:', error)
      alert('Failed to start recording. Please try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }
    }
  }

  const saveMedia = async () => {
    if (!currentEvent) {
      alert('No event selected. Please log in as admin to select an event.')
      return
    }

    const eventId = currentEvent.id
    setIsUploading(true)

    try {
      // Sync event to Supabase if it doesn't have a supabaseEventId
      let supabaseEventId = currentEvent.supabaseEventId
      if (!supabaseEventId) {
        console.log('Event missing Supabase ID, syncing to Supabase...')
        
        // Try to find existing event in Supabase by name and date
        const { data: existingEvent, error: findError } = await supabase
          .from('events')
          .select('id')
          .eq('name', currentEvent.name)
          .eq('date', currentEvent.date)
          .limit(1)
          .maybeSingle()
        
        if (findError) {
          console.error('Error checking for existing event:', findError)
        }
        
        if (existingEvent?.id) {
          supabaseEventId = existingEvent.id
          console.log('Found existing event in Supabase:', supabaseEventId)
          updateEvent(eventId, { supabaseEventId })
        } else {
          // Create new event in Supabase
          const { data: newEvent, error: createError } = await supabase
            .from('events')
            .insert({
              name: currentEvent.name,
              type: currentEvent.type || 'other',
              date: currentEvent.date
            })
            .select('id')
            .single()
          
          if (createError) {
            console.error('Failed to create event in Supabase:', createError)
            alert(`Failed to sync event to Supabase: ${createError.message}. Media will be saved locally only.`)
          } else {
            supabaseEventId = newEvent.id
            console.log('Created new event in Supabase:', supabaseEventId)
            updateEvent(eventId, { supabaseEventId })
          }
        }
      }
      if (mode === 'photo' && capturedShots.length > 0) {
        // Save all shots (Supabase)
        const shotCount = capturedShots.length
        const files = capturedShots.map((shot, index) => 
          new File(
            [shot.blob],
            `photo-${currentEvent.name}-${Date.now()}-${index + 1}.jpg`,
            { type: 'image/jpeg' }
          )
        )

      // Removed the "Supabase Upload Complete" links panel; keep uploads + alerts only.
        let supabaseSuccessCount = 0
        for (let i = 0; i < capturedShots.length; i++) {
          const shot = capturedShots[i]
          const file = files[i]
          
        // Upload to Supabase (only)
          let supabaseUrl = null
          if (supabaseEventId) {
            const supabaseResult = await uploadMediaToSupabase(file, supabaseEventId, 'photo')
            if (supabaseResult.success) {
              supabaseUrl = supabaseResult.publicUrl
              supabaseSuccessCount += 1
            } else {
              console.error(`Failed to upload photo ${i + 1}:`, supabaseResult.error, supabaseResult.details)
            }
          } else {
            console.warn('No supabaseEventId available, skipping Supabase upload')
          }
          
          // Save to local storage (base64)
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64Data = reader.result
            addMediaToEvent(eventId, {
              type: 'photo',
              data: base64Data,
              timestamp: shot.timestamp,
              supabaseUrl
            })
          }
          reader.readAsDataURL(file)
        }

        setCapturedShots([])
        setCapturedMedia(null)
        
        const parts = [`${shotCount} photo(s) saved locally.`]
        if (supabaseSuccessCount > 0) {
          parts.push(`${supabaseSuccessCount} uploaded to Supabase.`)
        } else {
          parts.push('Supabase upload failed. Check browser console for details.')
        }
        alert(parts.join(' '))
      } else if (capturedMedia) {
        // Save single video or photo (Supabase)
        const file = new File(
          [capturedMedia.blob],
          `${capturedMedia.type}-${currentEvent.name}-${Date.now()}.${capturedMedia.type === 'photo' ? 'jpg' : 'webm'}`,
          { type: capturedMedia.type === 'photo' ? 'image/jpeg' : 'video/webm' }
        )

        // Upload to Supabase (only)
        let supabaseUrl = null
        let supabaseSuccess = false
        if (supabaseEventId) {
          const supabaseResult = await uploadMediaToSupabase(file, supabaseEventId, capturedMedia.type)
          if (supabaseResult.success) {
            supabaseUrl = supabaseResult.publicUrl
            supabaseSuccess = true
          } else {
            console.error('Failed to upload media:', supabaseResult.error, supabaseResult.details)
          }
        } else {
          console.warn('No supabaseEventId available, skipping Supabase upload')
        }

        // Save to local storage
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Data = reader.result
          addMediaToEvent(eventId, {
            type: capturedMedia.type,
            data: base64Data,
            timestamp: capturedMedia.timestamp,
            speed: capturedMedia.speed,
            supabaseUrl
          })
        }
        reader.readAsDataURL(file)

        const parts = ['Media saved locally.']
        if (supabaseSuccess) {
          parts.push('Uploaded to Supabase.')
        } else {
          parts.push('Supabase upload failed. Check browser console for details.')
        }
        alert(parts.join(' '))

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
    // If multiple shots were captured, download all of them
    if (capturedShots.length > 0) {
      capturedShots.forEach((shot, index) => {
        const a = document.createElement('a')
        a.href = shot.url
        a.download = `photo-${Date.now()}-${index + 1}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // Small delay between downloads to avoid browser blocking
        if (index < capturedShots.length - 1) {
          setTimeout(() => {}, 100)
        }
      })
    } else if (capturedMedia) {
      // Download single media item
      const videoExtension = capturedMedia.mimeType?.includes('mp4') ? 'mp4' : 'webm'
      const a = document.createElement('a')
      a.href = capturedMedia.url
      a.download = `${capturedMedia.type}-${Date.now()}.${capturedMedia.type === 'photo' ? 'jpg' : videoExtension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // Device is fixed (iPad A16) using the front camera; no toggle.


  // Calculate progress percentage for circular progress (0-100)
  const countdownProgress = isCountingDown && countdownValue > 0 && initialCountdownValue > 0
    ? ((initialCountdownValue - countdownValue) / initialCountdownValue) * 100
    : 0

  return (
    <div className="fixed inset-0 bg-black z-40 overflow-hidden">
      {/* Countdown Overlay */}
      {isCountingDown && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative w-64 h-64">
            {/* Circular Progress Background */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#ef4444"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - countdownProgress / 100)}`}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            {/* Countdown Number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl font-bold text-white">{countdownValue}</span>
            </div>
          </div>
        </div>
      )}
      {!stream && cameraError && (
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
      )}
      <div className="card absolute top-4 left-4 right-4 z-50 max-h-[38vh] overflow-auto bg-white/85 backdrop-blur-lg">
        {mode === 'photo' ? (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Shots (3 secs):</label>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => setShotCount(1)}
                className={`py-4 px-4 rounded-lg font-semibold transition-colors flex flex-col items-center justify-center gap-2 ${
                  shotCount === 1
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="1 Shot"
              >
                <CameraIcon className="h-8 w-8" />
                <span className="text-xs">1</span>
              </button>
              <button
                onClick={() => setShotCount(2)}
                className={`py-4 px-4 rounded-lg font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  shotCount === 2
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="2 Shots (3 second delay)"
              >
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <CameraIcon className="h-10 w-10 absolute top-0 left-0" />
                  <CameraIcon className="h-10 w-10 absolute top-1 left-1" />
                </div>
                <span className="text-xs">2</span>
              </button>
              <button
                onClick={() => setShotCount(3)}
                className={`py-4 px-4 rounded-lg font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  shotCount === 3
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="3 Shots (3 second delay)"
              >
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <CameraIcon className="h-10 w-10 absolute top-0 left-0" />
                  <CameraIcon className="h-10 w-10 absolute top-1 left-1" />
                  <CameraIcon className="h-10 w-10 absolute top-2 left-2" />
                </div>
                <span className="text-xs">3</span>
              </button>
              <button
                onClick={() => setShotCount(4)}
                className={`py-4 px-4 rounded-lg font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  shotCount === 4
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="4 Shots (3 second delay)"
              >
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <CameraIcon className="h-10 w-10 absolute top-0 left-0" />
                  <CameraIcon className="h-10 w-10 absolute top-1 left-1" />
                  <CameraIcon className="h-10 w-10 absolute top-2 left-2" />
                  <CameraIcon className="h-10 w-10 absolute top-3 left-3" />
                </div>
                <span className="text-xs">4</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Video Speed:</label>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setVideoSpeed(0.5)}
                className={`py-3 px-6 rounded-lg font-semibold transition-colors ${
                  videoSpeed === 0.5
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Turtle className="h-10 w-10" />
                  <span className="text-xs">0.5x</span>
                </div>
              </button>
              <button
                onClick={() => setVideoSpeed(1.0)}
                className={`py-3 px-6 rounded-lg font-semibold transition-colors ${
                  videoSpeed === 1.0
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Gauge className="h-10 w-10" />
                  <span className="text-xs">1x</span>
                </div>
              </button>
              <button
                onClick={() => setVideoSpeed(2.0)}
                className={`py-3 px-6 rounded-lg font-semibold transition-colors ${
                  videoSpeed === 2.0
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Rabbit className="h-10 w-10" />
                  <span className="text-xs">2x</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 z-10">
        <div className="absolute top-4 left-4 z-50">
          <Link
            to={isAuthenticated ? '/' : '/login?next=/events'}
            state={!isAuthenticated ? { backgroundLocation: location } : undefined}
            className="inline-flex items-center gap-2 bg-black/60 text-white hover:bg-black/80 px-3 py-2 rounded-lg"
          >
            <X className="h-5 w-5" />
            Exit
          </Link>
        </div>

        <div className="space-y-4 h-full">
          {/* Video Preview */}
          <div className="absolute inset-0 bg-black overflow-hidden">
            {/* Always render video element so ref is available */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute top-1/2 left-1/2 object-cover"
              style={{ 
                // Keep the video element in the layout even before the stream is ready.
                // On iOS Safari, display:none can prevent metadata/dimensions from ever populating.
                display: 'block',
                visibility: 'visible',
                opacity: stream ? 1 : 0,
                width: streamIsLandscape !== (mode === 'video') ? '100vh' : '100vw',
                height: streamIsLandscape !== (mode === 'video') ? '100vw' : '100vh',
                transform:
                  streamIsLandscape !== (mode === 'video')
                    ? 'translate(-50%, -50%) rotate(90deg) scaleX(-1)'
                    : 'translate(-50%, -50%) scaleX(-1)'
              }}
              onLoadedMetadata={() => {
                    console.log('🎥 CAMERA DEBUG: onLoadedMetadata event fired')
                    // Ensure video plays when metadata is loaded (Safari)
                    if (videoRef.current) {
                      const video = videoRef.current
                      console.log('🎥 CAMERA DEBUG: onLoadedMetadata - video state:', {
                        paused: video.paused,
                        readyState: video.readyState,
                        videoWidth: video.videoWidth,
                        videoHeight: video.videoHeight
                      })
                      if (video.paused) {
                        video.play().then(() => {
                          console.log('✅ CAMERA DEBUG: Video play successful in onLoadedMetadata')
                        }).catch(err => {
                          console.warn('⚠️ CAMERA DEBUG: Video autoplay failed in onLoadedMetadata:', err)
                          // Retry after delay
                          setTimeout(() => {
                            if (videoRef.current && videoRef.current.paused) {
                              videoRef.current.play().catch(e => console.warn('Retry play in onLoadedMetadata failed:', e))
                            }
                          }, 500)
                        })
                      }
                      // Check if ready after metadata loads - try multiple times
                      const checkReady = () => {
                        console.log('🎥 CAMERA DEBUG: onLoadedMetadata checkReady:', {
                          width: video.videoWidth,
                          height: video.videoHeight,
                          readyState: video.readyState
                        })
                        if (video.videoWidth > 0 && video.videoHeight > 0) {
                          console.log('✅ CAMERA DEBUG: Video ready from onLoadedMetadata!')
                          setStreamIsLandscape(video.videoWidth > video.videoHeight)
                          setVideoReady(true)
                        } else {
                          // Try again after a short delay
                          setTimeout(checkReady, 50)
                        }
                      }
                      setTimeout(checkReady, 50)
                    }
                  }}
                  onPlaying={() => {
                    console.log('🎥 CAMERA DEBUG: onPlaying event fired')
                    // Video started playing, check if ready
                    if (videoRef.current) {
                      const video = videoRef.current
                      console.log('🎥 CAMERA DEBUG: onPlaying check:', {
                        width: video.videoWidth,
                        height: video.videoHeight,
                        readyState: video.readyState
                      })
                      if (video.videoWidth > 0 && video.videoHeight > 0) {
                        console.log('✅ CAMERA DEBUG: Video ready from onPlaying!')
                        setStreamIsLandscape(video.videoWidth > video.videoHeight)
                        setVideoReady(true)
                      }
                    }
                  }}
                  onLoadedData={() => {
                    console.log('🎥 CAMERA DEBUG: onLoadedData event fired')
                    // Additional check when video data is loaded
                    if (videoRef.current) {
                      const video = videoRef.current
                      console.log('🎥 CAMERA DEBUG: onLoadedData check:', {
                        width: video.videoWidth,
                        height: video.videoHeight,
                        readyState: video.readyState
                      })
                      if (video.videoWidth > 0 && video.videoHeight > 0) {
                        console.log('✅ CAMERA DEBUG: Video ready from onLoadedData!')
                        setStreamIsLandscape(video.videoWidth > video.videoHeight)
                        setVideoReady(true)
                      }
                    }
                  }}
                  onError={(e) => {
                    console.error('Video element error:', e)
                    setCameraError({
                      title: 'Video Playback Error',
                      message: 'The camera stream could not be displayed.',
                      steps: [
                        'Try refreshing the page',
                        'Check if another application is using the camera',
                        'Ensure your browser supports video playback'
                      ]
                    })
                  }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {stream && (
              <>
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
            )}
            {!stream && !cameraError && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-16 w-16 mb-4 animate-spin" />
                    <p className="text-sm">Starting camera...</p>
                  </>
                ) : (
                  <>
                    <CameraIcon className="h-16 w-16 mb-4 text-purple-500" />
                    <p className="text-sm mb-4 text-center">
                      Tap below to enable camera access.
                    </p>
                    {isSafari() && (
                      <p className="text-xs mb-4 text-center text-gray-500">
                        iPad/iPhone browsers require a tap to start the camera.
                      </p>
                    )}
                    <button
                      onClick={startCamera}
                      className="btn-primary mt-2"
                    >
                      <CameraIcon className="inline-block mr-2 h-5 w-5" />
                      Enable Camera
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute inset-x-0 bottom-0 z-30 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-wrap justify-center gap-4">
            {isLoading && !stream ? (
              <div className="flex items-center space-x-2 text-purple-600">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Starting camera...</span>
              </div>
            ) : stream && videoRef.current && videoRef.current.paused && !videoReady ? (
              <button
                onClick={async () => {
                  if (videoRef.current && stream) {
                    console.log('🎥 CAMERA DEBUG: Manual play button clicked')
                    const video = videoRef.current
                    
                    // Ensure srcObject is set
                    if (!video.srcObject || video.srcObject !== stream) {
                      console.log('🎥 CAMERA DEBUG: Setting srcObject in manual play')
                      video.srcObject = stream
                      // Wait for stream to attach
                      await new Promise(resolve => setTimeout(resolve, 100))
                    }
                    
                    // Check track states
                    const tracks = stream.getTracks()
                    console.log('🎥 CAMERA DEBUG: Stream tracks:', tracks.map(t => ({
                      kind: t.kind,
                      readyState: t.readyState,
                      enabled: t.enabled
                    })))
                    
                    // Ensure tracks are enabled
                    tracks.forEach(track => {
                      if (!track.enabled) {
                        console.log(`🎥 CAMERA DEBUG: Enabling ${track.kind} track`)
                        track.enabled = true
                      }
                    })
                    
                    // Ensure video is visible (required for some browsers on HTTPS)
                    video.style.display = 'block'
                    video.style.visibility = 'visible'
                    video.style.opacity = '1'
                    
                    // Wait a moment for the stream to be fully attached
                    await new Promise(resolve => setTimeout(resolve, 300))
                    
                    // Check if video has srcObject after wait
                    console.log('🎥 CAMERA DEBUG: Video state before play:', {
                      srcObject: !!video.srcObject,
                      paused: video.paused,
                      readyState: video.readyState,
                      videoWidth: video.videoWidth,
                      videoHeight: video.videoHeight
                    })
                    
                    // Now try to play
                    try {
                      const playPromise = video.play()
                      if (playPromise !== undefined) {
                        await playPromise
                        console.log('✅ CAMERA DEBUG: Manual play successful')
                        
                        // Force check for dimensions after play
                        const checkDimensions = () => {
                          if (videoRef.current) {
                            const v = videoRef.current
                            console.log('🎥 CAMERA DEBUG: Checking dimensions after play:', {
                              paused: v.paused,
                              readyState: v.readyState,
                              videoWidth: v.videoWidth,
                              videoHeight: v.videoHeight,
                              currentTime: v.currentTime
                            })
                            
                            if (v.videoWidth > 0 && v.videoHeight > 0) {
                              console.log('✅ CAMERA DEBUG: Video has dimensions!')
                              setVideoReady(true)
                            } else if (v.readyState >= 2) {
                              // Video has data but no dimensions yet, keep checking
                              setTimeout(checkDimensions, 100)
                            }
                          }
                        }
                        
                        // Check immediately and then periodically
                        setTimeout(checkDimensions, 100)
                        setTimeout(checkDimensions, 500)
                        setTimeout(checkDimensions, 1000)
                      }
                    } catch (error) {
                      console.error('❌ CAMERA DEBUG: Manual play failed:', error)
                      console.error('❌ CAMERA DEBUG: Error details:', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                      })
                      alert(`Video play failed: ${error.message || error.name}. Please check browser permissions.`)
                    }
                  }
                }}
                className="btn-primary"
              >
                <Video className="inline-block mr-2 h-5 w-5" />
                Start Video
              </button>
            ) : stream ? (
              <>
                {mode === 'photo' ? (
                  <button 
                    onClick={capturePhoto} 
                    className={`font-semibold py-2 px-4 rounded-lg transition-colors ${
                      isCapturing || isCountingDown || isUploading || !videoReady
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                    disabled={isCapturing || isCountingDown || isUploading || !videoReady}
                    title={!videoReady ? 'Waiting for camera to be ready...' : ''}
                  >
                    <CameraIcon className="inline-block mr-2 h-5 w-5" />
                    {isCapturing ? `Capturing ${capturedShots.length + 1}/${shotCount}...` : `Take ${shotCount} Photo${shotCount > 1 ? 's' : ''}`}
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <div className="flex flex-wrap gap-3 justify-center">
                        <button 
                          onClick={startRecording} 
                          className={`font-semibold py-2 px-4 rounded-lg transition-colors ${
                            isCountingDown || isUploading || !videoReady
                              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                          disabled={isCountingDown || isUploading || !videoReady}
                          title={!videoReady ? 'Waiting for camera to be ready...' : ''}
                        >
                          <Video className="inline-block mr-2 h-5 w-5" />
                          Record Video
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!currentEvent) {
                              alert('Loop recording requires an event. Please select or create an event first.')
                              return
                            }
                            setIsLoopRecording((prev) => !prev)
                          }}
                          className={`font-semibold py-2 px-4 rounded-lg border transition-colors ${
                            isLoopRecording
                              ? 'bg-green-500 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          <RefreshCw className="inline-block mr-2 h-5 w-5" />
                          {isLoopRecording ? 'Loop: On (24s max)' : 'Start Loop (24s max)'}
                        </button>
                      </div>
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
                {isSafari() ? (
                  <>
                    <CameraIcon className="inline-block mr-2 h-5 w-5" />
                    Enable Camera
                  </>
                ) : (
                  <>
                    <RefreshCw className="inline-block mr-2 h-5 w-5" />
                    Retry Camera
                  </>
                )}
              </button>
            )}

            {(capturedMedia || capturedShots.length > 0) && (
              <>
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
              </>
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
