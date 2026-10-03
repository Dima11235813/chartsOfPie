import { describe, expect, it } from 'vitest'
import {
  AUDIO_TYPES,
  exportFileName,
  extensionFor,
  pickMimeType,
  VIDEO_TYPES,
} from './sessionRecorder'

describe('recording helpers', () => {
  it('picks the first supported MIME type', () => {
    expect(pickMimeType(VIDEO_TYPES, (t) => t === 'video/webm')).toBe('video/webm')
    expect(pickMimeType(AUDIO_TYPES, (t) => t.startsWith('audio/mp4'))).toBe('audio/mp4')
    expect(pickMimeType(VIDEO_TYPES, () => false)).toBe('')
  })

  it('maps MIME types to file extensions', () => {
    expect(extensionFor('video/webm;codecs=vp9,opus')).toBe('webm')
    expect(extensionFor('audio/mp4')).toBe('mp4')
    expect(extensionFor('audio/ogg')).toBe('ogg')
  })

  it('builds safe, timestamped file names', () => {
    const date = new Date(2026, 9, 3, 19, 5, 7)
    expect(exportFileName('Lydian dream', 'mid', date)).toBe(
      'charts-of-pie-lydian-dream-20261003-190507.mid',
    )
    expect(exportFileName('Original (2019)', 'webm', date)).toBe(
      'charts-of-pie-original-2019-20261003-190507.webm',
    )
    expect(exportFileName('***', 'png', date)).toBe('charts-of-pie-custom-20261003-190507.png')
  })
})
