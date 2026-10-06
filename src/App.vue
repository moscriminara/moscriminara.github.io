<script setup>
import navigation from './components/navigation.vue';
import { ref, provide } from 'vue'

const audio = ref(null)

const playing = ref(false)
const analyser = ref(null)

const spectrumCanvas = ref(null)

provide('audio', audio)

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
</script>

<template>
  <img class="home_img" src="/cherryblossom.png" alt="Cherry blossom">
  <navigation />
  
  <router-view/>

  <audio 
    ref="audio"
    @play="playing = true"
    @pause="playing = false"
    @ended="playing = false"
  ></audio>

  <button class="block theme_button" @click="toggleTheme">
      {{ theme ? "☀": "⏾" }}
  </button>

  <canvas ref="spectrumCanvas" class="spectrum"></canvas>
</template>
