import type { ObservationEvent } from "@/types/event"
import type { RadioTransmission } from "@/lib/radio-types"
import { isTunedToMhz, minDistanceToSpectrumMhz } from "@/lib/radio-frequency"

const FADE_SEC = 0.4

export interface RadioAudioEngineParams {
  enabled: boolean
  tunedMhz: number
  events: ObservationEvent[]
  transmissions: RadioTransmission[]
  /** Evento mostrado en popup (carrusel) o último clic. */
  focusedEventId: string | null
}

function rampGain(gain: GainNode, value: number, ctx: AudioContext) {
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(gain.gain.value, t)
  gain.gain.linearRampToValueAtTime(value, t + FADE_SEC)
}

export class RadioAudioEngine {
  private ctx: AudioContext | null = null
  private noiseBufferSource: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private bandpass: BiquadFilterNode | null = null
  private eventAudio: HTMLAudioElement | null = null
  private txAudio: HTMLAudioElement | null = null
  private eventUrl = ""
  private txUrl = ""

  unlock(): void {
    const AC = typeof window !== "undefined" && window.AudioContext ? window.AudioContext : null
    if (!AC) return
    if (!this.ctx) {
      this.ctx = new AC()
      this.ensureNoise()
    }
    if (this.ctx.state === "suspended") void this.ctx.resume()
  }

  private ensureNoise() {
    if (!this.ctx || this.noiseGain) return
    const ctx = this.ctx
    const seconds = 2
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = 1100
    bp.Q.value = 0.65
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(bp)
    bp.connect(g)
    g.connect(ctx.destination)
    src.start(0)
    this.noiseBufferSource = src
    this.bandpass = bp
    this.noiseGain = g
  }

  private setStaticLevel(level: number) {
    if (!this.ctx || !this.noiseGain) return
    rampGain(this.noiseGain, Math.max(0, Math.min(0.45, level)), this.ctx)
    if (this.bandpass) {
      const wobble = 700 + (Math.sin(this.ctx.currentTime * 2.1) * 0.5 + 0.5) * 600
      try {
        this.bandpass.frequency.setTargetAtTime(wobble, this.ctx.currentTime, 0.08)
      } catch {
        /* noop */
      }
    }
  }

  private fadeEventVol(target: number) {
    if (!this.eventAudio) return
    this.eventAudio.volume = Math.max(0, Math.min(1, target))
  }

  private fadeTxVol(target: number) {
    if (!this.txAudio) return
    this.txAudio.volume = Math.max(0, Math.min(1, target))
  }

  private playEvent(url: string) {
    if (this.eventUrl === url && this.eventAudio && !this.eventAudio.paused) return
    if (this.eventAudio) {
      this.eventAudio.pause()
      this.eventAudio.src = ""
    }
    this.eventUrl = url
    const el = new Audio(url)
    el.loop = false
    el.volume = 0
    this.eventAudio = el
    void el.play().then(() => {
      this.fadeEventVol(0.9)
    }).catch(() => {
      this.eventAudio = null
      this.eventUrl = ""
    })
  }

  private playTx(url: string, loop: boolean) {
    if (this.txUrl === url && this.txAudio && !this.txAudio.paused) return
    if (this.txAudio) {
      this.txAudio.pause()
      this.txAudio.src = ""
    }
    this.txUrl = url
    const el = new Audio(url)
    el.loop = loop
    el.volume = 0
    this.txAudio = el
    void el.play().then(() => {
      this.fadeTxVol(0.85)
    }).catch(() => {
      this.txAudio = null
      this.txUrl = ""
    })
  }

  private stopEvent() {
    this.fadeEventVol(0)
    if (this.eventAudio) {
      window.setTimeout(() => {
        if (this.eventAudio && this.eventAudio.volume < 0.05) {
          this.eventAudio.pause()
          this.eventAudio.src = ""
          this.eventAudio = null
          this.eventUrl = ""
        }
      }, FADE_SEC * 1000 + 50)
    }
  }

  private stopTx() {
    this.fadeTxVol(0)
    if (this.txAudio) {
      window.setTimeout(() => {
        if (this.txAudio && this.txAudio.volume < 0.05) {
          this.txAudio.pause()
          this.txAudio.src = ""
          this.txAudio = null
          this.txUrl = ""
        }
      }, FADE_SEC * 1000 + 50)
    }
  }

  tick(p: RadioAudioEngineParams) {
    if (!p.enabled) {
      this.setStaticLevel(0)
      this.stopEvent()
      this.stopTx()
      return
    }
    this.unlock()
    if (!this.noiseGain) this.ensureNoise()

    const txWithAudio = p.transmissions.filter((t) => t.audioUrl && t.audioUrl.length > 0)
    const eventFreqs = p.events
      .filter((e) => typeof e.frequencyMhz === "number")
      .map((e) => e.frequencyMhz as number)
    const txFreqs = p.transmissions.map((t) => t.frequency)
    const spectrum = [...eventFreqs, ...txFreqs]
    const dist = minDistanceToSpectrumMhz(p.tunedMhz, spectrum)
    let staticLevel = 0.1 + Math.min(0.38, dist * 0.22)

    const focused = p.focusedEventId
      ? p.events.find((e) => e.id === p.focusedEventId)
      : null

    const p1 =
      focused &&
      focused.audioUrl &&
      typeof focused.frequencyMhz === "number" &&
      isTunedToMhz(p.tunedMhz, focused.frequencyMhz)

    if (p1) {
      staticLevel *= 0.12
      this.stopTx()
      this.playEvent(focused.audioUrl as string)
    } else {
      this.stopEvent()
      const txHit = txWithAudio.find((t) => isTunedToMhz(p.tunedMhz, t.frequency))
      if (txHit) {
        staticLevel *= 0.15
        this.playTx(txHit.audioUrl, txHit.isLoop)
      } else {
        this.stopTx()
      }
    }

    this.setStaticLevel(staticLevel)
  }

  dispose() {
    this.stopEvent()
    this.stopTx()
    if (this.noiseBufferSource) {
      try {
        this.noiseBufferSource.stop()
      } catch {
        /* noop */
      }
      this.noiseBufferSource.disconnect()
    }
    this.noiseBufferSource = null
    if (this.noiseGain) this.noiseGain.disconnect()
    this.noiseGain = null
    this.bandpass = null
    if (this.ctx) void this.ctx.close()
    this.ctx = null
  }
}
