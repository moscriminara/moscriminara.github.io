<script setup>
import { ref } from "vue";
const theme = ref(
  localStorage.getItem('theme') === 'dark'
)

const emit = defineEmits(['close'])

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
    <section>
        <nav class="navigation">
            <router-link 
                class="navigation_content" to="/post"
                @click="emit('close')"
            >
                POSTS
            </router-link>
            <router-link
                class="navigation_content" to="/player"
                @click="emit('close')"
            >
                PLAYER
            </router-link>
            <router-link
                class="navigation_content" to="/gallery"
                @click="emit('close')"
            >
                GALLERY
            </router-link>
            <router-link
                class="navigation_content" 
                to="/profile"
                @click="emit('close')"
            >
                PROFILE
            </router-link>

            <!-- <button class="block theme_button" @click="toggleTheme">
                {{ theme ? "☀": "⏾" }}
            </button> -->
        </nav>
        
    </section>
</template>