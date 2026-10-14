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
                POSTS
            </router-link>

            <router-link class="navigation_content" to="/player">
                PLAYER
            </router-link>

            <router-link class="navigation_content" to="/tools">
                TOOLS
            </router-link>

            <router-link class="navigation_content" to="/gallery">
                GALLERY
            </router-link>

            <router-link class="navigation_content" to="/profile">
                PROFILE
            </router-link>

            <button class="block theme_button" @click="toggleTheme">
                {{ theme ? "☀": "⏾" }}
            </button>
        </nav>
    </section>
</template>