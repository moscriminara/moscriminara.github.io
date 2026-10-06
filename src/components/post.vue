<script setup>
import { ref, computed } from 'vue'
import { getMarkdownFolder } from '../data/md.js'

const posts = getMarkdownFolder('posts')

const selectedTag = ref(
    localStorage.getItem('selectedTag') || 'logs'
)

const filteredPosts = computed(() =>
    posts.filter(post => post.tag === selectedTag.value)
)

function loadPosts(tag) {
    selectedTag.value = tag
    localStorage.setItem('selectedTag', tag)
}
</script>

<template>
    <section class="post_container">
        <div class="block">
            <div class="block_navi">
                <list>
                    <h2 @click="loadPosts('logs')">Logs</h2>
                    <h2 @click="loadPosts('releases')">Releases</h2>
                    <h2 @click="loadPosts('feelings')">Feelings</h2>
                    <h2 @click="loadPosts('advices')">Advices</h2>
                    <h2 @click="loadPosts('cats')">Cats</h2>
                </list>
            </div>
        </div>

        <div class="block">

            <article
                v-for="post in filteredPosts"
                :key="post.title"
                class="block"
                :class="{ 'post-open': selectedPost === post.title }"
                @click="openPost(post)"
            >
                <h1>{{ post.title }}</h1>
                <p><span>{{ post.date }}</span></p>

                <div v-html="post.content"></div>
            </article>

            <p v-if="filteredPosts.length === 0" class="nothing">
                Nothing yet...
            </p>
        </div>
        
    </section>
</template>