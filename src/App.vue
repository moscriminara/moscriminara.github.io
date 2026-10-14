<script setup>
import navigation from './components/navigation.vue';
import { ref, provide } from 'vue'

const showNavi = ref(false)
const loading = ref(false)
const audio = ref(null)
const playing = ref(false)
const analyser = ref(null)
const spectrumCanvas = ref(null)

provide('loading', loading)
provide('audio', audio)
provide('playing', playing)
provide('analyser', analyser)
provide('spectrumCanvas', spectrumCanvas)

function toggleNavi() {
  showNavi.value = !showNavi.value
}
</script>

<template>
  <img class="home_img" src="/cherryblossom.png" alt="Cherry blossom">

  <transition name="navi">
    <div
      v-if="showNavi"
      class="navi_backdrop"
      @click="showNavi = false"
    />
  </transition>
  
  <transition name="navi">
    <navigation 
      v-if="showNavi" 
      @close="showNavi = false"
    />
  </transition>
  
  <router-view/>

  <audio 
    ref="audio"
    crossorigin="anonymous"
    @waiting="loading = true"
    @playing="loading = false; playing = true"
    @pause="loading = false; playing = false"
    @ended="loading = false; playing = false"
    @error="loading = false"
  ></audio>

  <button class="block navi_button" @click="toggleNavi">
    MENU
  </button>

  <div class="spectrum_container">
    <canvas ref="spectrumCanvas" class="spectrum"></canvas>
  </div>
</template>
