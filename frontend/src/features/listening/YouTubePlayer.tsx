import { useEffect, useRef } from 'react'

/* Minimal typings for the parts of the YouTube IFrame Player API we use. */
interface YTPlayer {
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, options: object) => YTPlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/** Loads https://www.youtube.com/iframe_api once and resolves when it's ready. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        resolve(window.YT!)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        apiPromise = null
        reject(new Error('YouTube could not be loaded.'))
      }
      document.head.appendChild(script)
    })
  }
  return apiPromise
}

export interface PlaybackReport {
  position: number
  duration: number
  ended: boolean
}

interface YouTubePlayerProps {
  videoId: string
  title: string
  /** Called every ~10 seconds while playing, and on pause/end. */
  onProgress: (report: PlaybackReport) => void
  onError?: (message: string) => void
}

const REPORT_EVERY_MS = 10_000

export function YouTubePlayer({ videoId, title, onProgress, onError }: YouTubePlayerProps) {
  const container = useRef<HTMLDivElement>(null)
  const reportRef = useRef(onProgress)
  const errorRef = useRef(onError)
  useEffect(() => {
    reportRef.current = onProgress
    errorRef.current = onError
  })

  useEffect(() => {
    const host = container.current
    let player: YTPlayer | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let cancelled = false
    const report = (ended = false) => {
      if (!player) return
      const duration = Math.round(player.getDuration() || 0)
      reportRef.current({ position: Math.round(ended ? duration : player.getCurrentTime() || 0), duration, ended })
    }

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host) return
        const mount = document.createElement('div')
        host.appendChild(mount)
        player = new YT.Player(mount, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (event: { data: number }) => {
              clearInterval(timer)
              if (event.data === YT.PlayerState.PLAYING) timer = setInterval(() => report(), REPORT_EVERY_MS)
              if (event.data === YT.PlayerState.PAUSED) report()
              if (event.data === YT.PlayerState.ENDED) report(true)
            },
            onError: () => errorRef.current?.('This video can’t be played here. It may have been removed or made private.'),
          },
        })
      })
      .catch((e: Error) => errorRef.current?.(e.message))

    return () => {
      cancelled = true
      clearInterval(timer)
      player?.destroy()
      if (host) host.innerHTML = ''
    }
  }, [videoId])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-forest [&_iframe]:size-full" role="region" aria-label={`Video player: ${title}`}>
      <div ref={container} className="absolute inset-0" />
    </div>
  )
}
