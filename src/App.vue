<script setup>
import navigation from './components/navigation.vue';
import { ref, provide, onMounted } from 'vue'
import { activeAudio, initBackgroundAudio, onAudioEvent } from './tools/backgroundAudio'

const audio = ref(null)
const bgAudio = ref(null)

const playing = ref(false)
const analyser = ref(null)

const spectrumCanvas = ref(null)

provide('audio', activeAudio)

provide('playing', playing)
provide('analyser', analyser)
provide('spectrumCanvas', spectrumCanvas)

const theme = ref(
  localStorage.getItem('theme') === 'dark'
)

document.documentElement.dataset.theme =
  theme.value ? 'dark' : 'light'

function toggleTheme() {
  theme.value = !theme.value

  const currentTheme = theme.value ? 'dark' : 'light'

  document.documentElement.dataset.theme = currentTheme
  localStorage.setItem('theme', currentTheme)
}

onMounted(() => {
  initBackgroundAudio(audio.value, bgAudio.value)

  // 播放状态跟随"当前承担播放"的元素（主/备用都可能），backgroundAudio 里做了事件过滤
  onAudioEvent('play', () => {
    playing.value = true

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing'
    }
  })

  onAudioEvent('pause', () => {
    playing.value = false

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused'
    }
  })

  onAudioEvent('ended', () => {
    playing.value = false
  })
})
</script>

<template>
  <img class="home_img" src="/cherryblossom.png" alt="Cherry blossom">
  <navigation />
  
  <router-view/>

  <audio
    ref="audio"
  ></audio>

  <!-- 备用元素：从不接入 Web Audio，手机切后台时由 backgroundAudio 把播放平移过来走原生通道 -->
  <audio
    ref="bgAudio"
  ></audio>

  <button class="block theme_button" @click="toggleTheme">
      {{ theme ? "☀": "⏾" }}
  </button>

  <canvas ref="spectrumCanvas" class="spectrum"></canvas>
</template>
