/**
 * Records what the user sees and hears: a 1280×720 compositor canvas that mirrors whichever view
 * is on screen (chart, sheet music, spectrogram) plus the audio output, via MediaRecorder.
 * Produces a video (with sound) and a separate audio-only file.
 */

export interface Recording {
  readonly video: Blob | null
  readonly audio: Blob | null
  readonly durationSec: number
}

export const VIDEO_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
]
export const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

/** First MIME type the browser can record, or '' to let it choose. */
export function pickMimeType(
  candidates: readonly string[],
  isSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
): string {
  return candidates.find((type) => isSupported(type)) ?? ''
}

/** File extension for a recorded MIME type. */
export const extensionFor = (mimeType: string) =>
  mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'

export const canRecord = () =>
  typeof MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  'captureStream' in HTMLCanvasElement.prototype

export interface SessionRecorderOptions {
  /** Output audio, or null for silent video. */
  audio: MediaStream | null
  /** The canvas currently on screen (read every frame, so switching views is captured). */
  getSource: () => HTMLCanvasElement | null
  /** Caption drawn in the corner, e.g. preset and digit position. */
  getCaption: () => string
  width?: number
  height?: number
  fps?: number
}

function record(stream: MediaStream, mimeType: string) {
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }))
  })
  recorder.start(1000)
  return { recorder, done }
}

export class SessionRecorder {
  private readonly canvas: HTMLCanvasElement
  private frame = 0
  private startedAt = 0
  private video: ReturnType<typeof record> | null = null
  private audio: ReturnType<typeof record> | null = null

  constructor(private readonly options: SessionRecorderOptions) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = options.width ?? 1280
    this.canvas.height = options.height ?? 720
  }

  get elapsedSec(): number {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0
  }

  start(): void {
    const { audio, fps = 30 } = this.options
    this.drawFrame()
    const videoStream = this.canvas.captureStream(fps)
    const tracks = [...videoStream.getVideoTracks(), ...(audio?.getAudioTracks() ?? [])]
    this.video = record(new MediaStream(tracks), pickMimeType(VIDEO_TYPES))
    if (audio) this.audio = record(audio, pickMimeType(AUDIO_TYPES))
    this.startedAt = performance.now()
    const loop = () => {
      this.drawFrame()
      this.frame = requestAnimationFrame(loop)
    }
    this.frame = requestAnimationFrame(loop)
  }

  async stop(): Promise<Recording> {
    cancelAnimationFrame(this.frame)
    const durationSec = this.elapsedSec
    this.video?.recorder.stop()
    this.audio?.recorder.stop()
    const [video, audio] = await Promise.all([this.video?.done ?? null, this.audio?.done ?? null])
    this.video?.recorder.stream.getVideoTracks().forEach((track) => track.stop())
    this.startedAt = 0
    return { video, audio, durationSec }
  }

  private drawFrame(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = this.canvas
    ctx.fillStyle = '#0b0b12'
    ctx.fillRect(0, 0, width, height)
    const source = this.options.getSource()
    const captionHeight = 56
    if (source && source.width > 0 && source.height > 0) {
      const scale = Math.min(width / source.width, (height - captionHeight) / source.height)
      const w = source.width * scale
      const h = source.height * scale
      ctx.drawImage(source, (width - w) / 2, (height - captionHeight - h) / 2, w, h)
    }
    ctx.fillStyle = '#8fd3ff'
    ctx.font = '600 26px Georgia, serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('π', 24, height - captionHeight / 2)
    ctx.fillStyle = '#e6ecf5'
    ctx.font = '20px system-ui, sans-serif'
    ctx.fillText(this.options.getCaption(), 56, height - captionHeight / 2)
  }
}

/** Save a blob through a temporary download link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** `charts-of-pie-<label>-20261003-191500.<ext>` */
export function exportFileName(label: string, extension: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  const safe =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'custom'
  return `charts-of-pie-${safe}-${stamp}.${extension}`
}
