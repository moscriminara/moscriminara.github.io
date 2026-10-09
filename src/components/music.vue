<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch, nextTick } from 'vue'
import tracks from '../data/tracks.json'
import { audioAnalyser, getAudioContext } from '../tools/audioAnalyser'
import { startSpectrum } from '../tools/spectrum'

const loading = inject('loading')

const audio = inject('audio')
const playing = inject('playing')
const currentTrack = ref(null)

const currentTime = ref(0)
const duration = ref(0)

const analyser = inject('analyser')
const spectrumCanvas = inject('spectrumCanvas')

const shuffle = ref(false)

const history = ref([])
const historyIndex = ref(-1)

const seeking = ref(false)

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (currentTime.value / duration.value) * 100
})

async function playTrack(
    item,
    addHistory = true,
    toggle = true
) {
    if (toggle && currentTrack.value?.title === item.title) {
        if (audio.value.paused) {
            await audio.value.play()
        } else {
            audio.value.pause()
        }
        return
    }

    if (addHistory) {

        history.value = history.value.slice(
            0,
            historyIndex.value + 1
        )

        history.value.push(item)
        historyIndex.value++
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: item.title,
            artist: item.artist,
            artwork: [
                {
                    src: item.cover
                }
            ]
        })

        navigator.mediaSession.playbackState = 'playing'
    }

    currentTrack.value = item

    audio.value.src = item.audio
    audio.value.currentTime = 0

    if (!analyser.value) {
        analyser.value = audioAnalyser(audio.value)
        startSpectrum(spectrumCanvas.value)
    }

    if ('audioSession' in navigator) {
        navigator.audioSession.type = 'playback'
    }

    await audio.value.play()
}

async function restoreAudioContext() {
    if (document.visibilityState !== 'visible') return
    if (!audio.value || audio.value.paused) return

    const context = getAudioContext()

    if (!context) return

    await context.suspend()
    await context.resume()
}

function togglePlay() {
    if (!currentTrack.value) return

    if (audio.value.paused) {
        audio.value.play()
    } else {
        audio.value.pause()
    }
}

function lastTrack() {
    if (!currentTrack.value) return
    if (historyIndex.value <= 0) return

    historyIndex.value--

    playTrack(history.value[historyIndex.value], false, false)
}

function nextTrack() {
    if (!currentTrack.value) return

    if (historyIndex.value < history.value.length - 1) {
        historyIndex.value++
        playTrack(history.value[historyIndex.value], false, false)
        return
    }

    if (shuffle.value) {
        randomTrack()
        return
    }

    const index = tracks.track.findIndex(
        item => item.title === currentTrack.value.title
    )

    playTrack(tracks.track[
            (index + 1) % tracks.track.length
        ]
    )
}

function toggleShuffle() {
    shuffle.value = !shuffle.value

    if (shuffle.value) {
        history.value = []
        historyIndex.value = -1
    }
}

function randomTrack() {
    let index

    do {
        index = Math.floor(Math.random() * tracks.track.length)
    } while (
        tracks.track[index].audio === currentTrack.value?.audio &&
        tracks.track.length > 1
    )

    playTrack(tracks.track[index], true, false)
}

function autoCoutinue() {
    nextTrack()
}

function mediaSession() {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.setActionHandler('play', () => {
        audio.value?.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
        audio.value?.pause()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        lastTrack()
    })
}

function setSeekPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect()

    let percent = (event.clientX - rect.left) / rect.width

    percent = Math.max(0, Math.min(1, percent))

    currentTime.value = percent * duration.value
    audio.value.currentTime = currentTime.value
}

function startSeek(event) {
    seeking.value = true
    event.currentTarget.setPointerCapture(event.pointerId)

    setSeekPosition(event)
}

function moveSeek(event) {
    if (!seeking.value) return

    setSeekPosition(event)
}

function endSeek() {
    seeking.value = false
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'

    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    return `${minutes}:${secs.toString().padStart(2, '0')}`
}


const floatingStates = new Map()

let animationFrame = null
let lastFrameTime = null

const FLOAT_SPEED = 0.02
const RESET_SMOOTHNESS = 250

function getCurrentY(img) {
    const transform = getComputedStyle(img).transform

    if (transform === 'none') return 0

    return new DOMMatrixReadOnly(transform).m42
}

function getFloatingRange(img) {
    const card = img.closest('.trackcard')

    if (!card) return { top: 0, bottom: 0 }

    const imageHeight = img.offsetHeight
    const cardHeight = card.clientHeight
    const originalTop = img.offsetTop

    if (imageHeight <= cardHeight) {
        return { top: 0, bottom: 0 }
    }

    return {
        top: -originalTop,
        bottom: cardHeight - imageHeight - originalTop + 1
    }
}

function startFloating(img) {
    if (!img) return

    const existing = floatingStates.get(img)
    const y = getCurrentY(img)

    if (existing) {
        if (!existing.active) {
            existing.intro = true
            existing.introStartY = existing.y
            existing.introTime = 0
            existing.phase = 0
        }

        existing.active = true
        return
    }

    floatingStates.set(img, {
        y,
        active: true,
        phase: 0,
        intro: true,
        introStartY: y,
        introTime: 0
    })

    if (animationFrame === null) {
        lastFrameTime = null
        animationFrame = requestAnimationFrame(animateFloating)
    }
}

function stopFloating(img) {
    const state = floatingStates.get(img)
    if (state) state.active = false
}

function animateFloating(timestamp) {
    const dt = lastFrameTime === null
        ? 0
        : Math.min(timestamp - lastFrameTime, 50)

    lastFrameTime = timestamp

    for (const [img, state] of floatingStates) {
        if (!img.isConnected) {
            floatingStates.delete(img)
            continue
        }

        const { top, bottom } = getFloatingRange(img)

        if (state.active) {
            const center = (top + bottom) / 2
            const amplitude = (top - bottom) / 2

            const duration = 50000

            if (state.intro) {
                const introDuration = 20000

                state.introTime = Math.min(
                    state.introTime + dt,
                    introDuration
                )

                const t = state.introTime / introDuration

                const eased = Math.pow(
                    (1 - Math.cos(Math.PI * t)) / 2, 0.7
                )

                state.y = state.introStartY
                    + (bottom - state.introStartY) * eased

                if (t >= 1) {
                    state.intro = false
                    state.phase = -Math.PI / 2
                }
            } else {
                state.phase += (Math.PI * 2 / duration) * dt
                state.y = center + amplitude * Math.sin(state.phase)
            }
        } else {
            const factor = 1 - Math.exp(-dt / RESET_SMOOTHNESS)

            state.y += (0 - state.y) * factor

            if (Math.abs(state.y) < 0.1) {
                img.style.transform = ''
                floatingStates.delete(img)
                continue
            }
        }

        img.style.transform = `translateY(${state.y}px)`
    }

    if (floatingStates.size > 0) {
        animationFrame = requestAnimationFrame(animateFloating)
    } else {
        animationFrame = null
        lastFrameTime = null
    }
}

function updateFloating(card) {
    const img = card.querySelector('.trackcover')
    if (!img) return

    const isActive = card.classList.contains('track_active')
    const isHovered = card.matches(':hover')

    if ((isActive && playing.value) || isHovered) {
        startFloating(img)
    } else {
        stopFloating(img)
    }
}

function updateAllFloating() {
    document.querySelectorAll('.trackcard').forEach(updateFloating)
}

watch(
    [currentTrack, playing],
    async () => {
        await nextTick()
        updateAllFloating()
    },
    { flush: 'post' }
)

function updateTime() {
    currentTime.value = audio.value.currentTime
}

function updateDuration() {
    duration.value = audio.value.duration
}

onMounted(() => {

    document.addEventListener('visibilitychange', restoreAudioContext)

    audio.value.addEventListener('ended', autoCoutinue)
    audio.value.addEventListener('timeupdate', updateTime)
    audio.value.addEventListener('loadedmetadata', updateDuration)

    mediaSession()
})

onUnmounted(() => {
    audio.value.removeEventListener('ended', autoCoutinue)
    audio.value.removeEventListener('timeupdate', updateTime)
    audio.value.removeEventListener('loadedmetadata', updateDuration)

    document.removeEventListener('visibilitychange', restoreAudioContext)

    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
    }

    for (const img of floatingStates.keys()) {
        img.style.transform = ''
    }

    floatingStates.clear()
    lastFrameTime = null
})

</script>

<template>
    <section class="music_container">
 
        <div class="block">
            <div class="player">
                <img
                    class="player_icon"
                    src=""
                >

                <img 
                    class="player_icon" 
                    src="/player_icons/last.png"
                    @click="lastTrack"
                >

                <img 
                    class="player_icon"
                    :src="loading
                        ? '/loading_icons/loading.gif'
                        :playing
                            ?'/player_icons/pause.png'
                            :'/player_icons/play.png'"
                    @click="togglePlay"
                >

                <img
                    class="player_icon"
                    src="/player_icons/next.png"
                    @click="nextTrack"
                >

                <img
                    class="player_icon"
                    src="/player_icons/shuffle.png"
                    :class="{ active: shuffle }"
                    @click="toggleShuffle"
                >

            </div>
        </div>

        <div class="block tracks">

            <div 
                class="block trackcard"
                v-for="item in tracks.track"
                :key="item.title"
                @click="playTrack(item)"
                :class="{
                    'track_active': currentTrack?.title === item.title
                }"
                @mouseenter="updateFloating($event.currentTarget)"
                @mouseleave="updateFloating($event.currentTarget)"
            >
                <div
                    class="track_info"
                    :class="{
                        'track_info_active': currentTrack?.title === item.title
                    }"
                >
                    <p>{{ item.title }}</p>
                    <p><span>{{ item.artist }}</span></p>
                </div>
                <img :src="item.cover" class="trackcover">

            </div>

        </div>

        <div class="block progress no_select">

            <p>{{ formatTime(currentTime) }}</p>

            <input
                type="range"
                min="0"
                :max="duration"
                step="0.01"
                :value="currentTime"
                @pointerdown="startSeek"
                @pointermove="moveSeek"
                @pointerup="endSeek"
                @pointercancel="endSeek"
                :style="{
                    '--progress-percent': progressPercent + '%'
                }"
            >
            <p>{{ formatTime(duration) }}</p>
            
        </div>
    </section>
</template>