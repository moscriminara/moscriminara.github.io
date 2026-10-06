<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import tracks from '../data/tracks.json'
import { audioAnalyser } from '../tools/audioAnalyser'
import { startSpectrum } from '../tools/spectrum'

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

    await audio.value.play()
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

function seek() {
  audio.value.currentTime = Number(currentTime.value)
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'

    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    return `${minutes}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
    audio.value.addEventListener('ended', autoCoutinue)
    mediaSession()

    audio.value.addEventListener('timeupdate', () => {
        currentTime.value = audio.value.currentTime
    })

    audio.value.addEventListener('loadedmetadata', () => {
        duration.value = audio.value.duration
    })
})
onUnmounted(() => {
    audio.value.removeEventListener('ended', autoCoutinue)
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
                    :src="playing
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
            >

                <img :src="item.cover" class="trackcover">
                <p>{{ item.title }}</p>
                <p><span>{{ item.artist }}</span></p>

            </div>

        </div>

        <div class="block progress">

                <p>{{ formatTime(currentTime) }}</p>

                <input
                    type="range"
                    min="0"
                    :max="duration"
                    step="0.01"
                    v-model="currentTime"
                    @input="seek"
                    :style="{
                        '--progress-percent': progressPercent + '%'
                    }"
                >
                <p>{{ formatTime(duration) }}</p>
                
            </div>
    </section>
</template>