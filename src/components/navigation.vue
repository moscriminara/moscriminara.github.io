<script setup>
import { ref } from "vue";

const theme = ref(
  localStorage.getItem('theme') === 'dark'
)

const emit = defineEmits(['close'])

function handleNaviClick(event) {
    if (event.target.closest('a.navigation_content')) {
        emit('close')
    }
}

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
    <section class="navi_container">
        <nav class="navigation" @click="handleNaviClick">
            <router-link class="navigation_content" to="/post">
                post
            </router-link>

            <router-link class="navigation_content" to="/player">
                player
            </router-link>

            <router-link class="navigation_content" to="/tools">
                tools
            </router-link>

            <router-link class="navigation_content" to="/gallery">
                gallery
            </router-link>

            <router-link class="navigation_content" to="/profile">
                profile
            </router-link>

            <button class="block theme_button" @click="toggleTheme">
                {{ theme ? "☀": "⏾" }}
            </button>
        </nav>
    </section>
</template>