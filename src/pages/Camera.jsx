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
  // Default to 'environment' (back camera) on mobile, 'user' (front) on desktop
  const [facingMode, setFacingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform))
      return mobile ? 'environment' : 'user'
    }
    return 'user'
  })
  const [cameraError, setCameraError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shotCount, setShotCount] = useState(1) // 1, 2, 3, or 4 shots
  const [videoSpeed, setVideoSpeed] = useState(1.0) // 0.5 (slow-mo), 1.0 (normal), 2.0 (fast)
  const [capturedShots, setCapturedShots] = useState([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedLinks, setUploadedLinks] = useState([])
  const [copiedLink, setCopiedLink] = useState(null)
  const [videoReady, setVideoReady] = useState(false)
  
  const { currentEvent, addMediaToEvent, deviceType } = useEvents()

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
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null
    }
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }

      // Optimize constraints based on device type preference (set by admin) or auto-detect
      const useMobileSettings = deviceType === 'mobile' || (deviceType !== 'desktop' && isMobile())
      const hasMultipleCams = await hasMultipleCameras()
      
      console.log('🎥 CAMERA DEBUG: Device detection:', {
        deviceTypePreference: deviceType,
        useMobileSettings,
        autoDetectedMobile: isMobile(),
        hasMultipleCams,
        userAgent: navigator.userAgent.substring(0, 50)
      })

      // Try with ideal constraints first, then fallback to basic constraints
      // Mobile devices: start with lower resolution for better performance
      // Desktop: start with higher resolution
      const tryConstraints = useMobileSettings ? [
        // Mobile/Tablet optimized constraints
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          audio: true
        },
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: true
        },
        {
          video: {
            facingMode: facingMode
          },
          audio: true
        },
        {
          video: true,
          audio: true
        },
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        },
        {
          video: {
            facingMode: facingMode
          },
          audio: false
        },
        {
          video: true,
          audio: false
        }
      ] : [
        // Desktop constraints (higher resolution)
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true
        },
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        },
        {
          video: {
            facingMode: facingMode
          },
          audio: true
        },
        {
          video: true,
          audio: true
        },
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        },
        {
          video: {
            facingMode: facingMode
          },
          audio: false
        },
        {
          video: true,
          audio: false
        }
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
          // If it's a permission error, don't try other constraints
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
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
          throw new Error('Camera hardware initialization failed. The camera may be in use by another application or there may be a driver issue.')
        }
        throw lastError || new Error('Could not access camera with any constraints')
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

  // Auto-start camera when component mounts (but not for Safari - requires user interaction)
  useEffect(() => {
    const initCamera = async () => {
      // Safari requires user interaction to request camera permissions
      // So we skip auto-start for Safari and show a button instead
      if (!isSafari() && !stream && !cameraError) {
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

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) {
      console.warn('Capture blocked:', { 
        hasVideo: !!videoRef.current, 
        hasCanvas: !!canvasRef.current, 
        isCapturing 
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

    // Determine delay based on shot count: 3 seconds between shots for all multi-shot options
    const delayBetweenShots = shotCount > 1 ? 3000 : 0

    try {
      for (let i = 0; i < shotCount; i++) {
        // Capture immediately for first shot, then wait for subsequent shots
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenShots))
          // Re-check video dimensions after delay
          if (!video.videoWidth || !video.videoHeight) {
            console.error('Video lost during capture')
            break
          }
        }
        
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)

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
      } else {
        console.error('No photos captured')
        alert('Failed to capture photo. Please try again.')
      }
    } catch (error) {
      console.error('Error during photo capture:', error)
      alert('An error occurred while capturing the photo. Please try again.')
    } finally {
      setIsCapturing(false)
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

  const startRecording = () => {
    if (!stream) {
      console.error('Cannot start recording: no stream available')
      alert('Camera stream is not available. Please ensure the camera is enabled.')
      return
    }

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
      console.log('Recording stopped, chunks:', chunksRef.current.length)
      // Use the actual mime type from the recorder, or fallback
      const blobType = recordedMimeType.split(';')[0] || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: blobType })
      const url = URL.createObjectURL(blob)
      console.log('Video blob created:', {
        size: blob.size,
        type: blob.type
      })
      setCapturedMedia({
        type: 'video',
        url: url,
        blob: blob,
        timestamp: new Date().toISOString(),
        speed: videoSpeed,
        mimeType: recordedMimeType
      })
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
            {/* Always render video element so ref is available */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ 
                display: stream ? 'block' : 'none',
                visibility: stream ? 'visible' : 'hidden'
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
            {!stream && !cameraError && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-16 w-16 mb-4 animate-spin" />
                    <p className="text-sm">Starting camera...</p>
                  </>
                ) : isSafari() ? (
                  <>
                    <CameraIcon className="h-16 w-16 mb-4 text-purple-500" />
                    <p className="text-sm mb-4 text-center">
                      Safari requires permission to access your camera.
                    </p>
                    <p className="text-xs mb-4 text-center text-gray-500">
                      Click the button below to enable camera access.
                    </p>
                    <button
                      onClick={startCamera}
                      className="btn-primary mt-4"
                    >
                      <CameraIcon className="inline-block mr-2 h-5 w-5" />
                      Enable Camera
                    </button>
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
                <button onClick={toggleFacingMode} className="btn-secondary" disabled={isCapturing || isRecording || isUploading}>
                  Switch Camera
                </button>
                {mode === 'photo' ? (
                  <button 
                    onClick={capturePhoto} 
                    className="btn-primary" 
                    disabled={!!capturedMedia || isCapturing || !videoReady}
                    title={!videoReady ? 'Waiting for camera to be ready...' : ''}
                  >
                    <CameraIcon className="inline-block mr-2 h-5 w-5" />
                    {isCapturing ? `Capturing ${capturedShots.length + 1}/${shotCount}...` : `Take ${shotCount} Photo${shotCount > 1 ? 's' : ''}`}
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <button 
                        onClick={startRecording} 
                        className="btn-primary" 
                        disabled={!!capturedMedia || !videoReady}
                        title={!videoReady ? 'Waiting for camera to be ready...' : ''}
                      >
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
