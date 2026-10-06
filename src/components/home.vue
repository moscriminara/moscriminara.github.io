<script setup>
import { ref, onMounted, nextTick } from 'vue'

const show = ref(false)

onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      show.value = true
    })
  })
})
</script>

<template>

  <div class="display_window">

      <router-view v-slot="{ Component }">
        <transition name="window" mode="out-in">
          <KeepAlive>
            <component :is="Component" />
          </KeepAlive>
        </transition>
      </router-view>

  </div>

  <section class="logo">
    <router-link to="/">
      <div class="logo_elements">
        <h3 :class="{show}">ORIMATA</h3>
        <div class="vertical_line" :class="{show}"></div>
        <h2 :class="{show}">おりまた</h2>
      </div>
    </router-link>
  </section>

</template>
