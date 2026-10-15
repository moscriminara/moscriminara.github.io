<script setup>
import { ref, computed } from 'vue'
import { getMarkdownFolder } from '../data/md.js'


const posts = getMarkdownFolder('posts')

const selectedTag = ref(
    localStorage.getItem('selectedTag') || 'logs'
)

const filteredPosts = computed(() =>
    posts
        .filter(post => post.tag === selectedTag.value)
        .sort((a, b) =>
            new Date(b.date.replace('|','')) - 
            new Date(a.date.replace('|',''))
        )
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
                    <h2 @click="loadPosts('logs')">logs</h2>
                    <h2 @click="loadPosts('releases')">releases</h2>
                    <h2 @click="loadPosts('feelings')">feelings</h2>
                    <h2 @click="loadPosts('advices')">advices</h2>
                    <h2 @click="loadPosts('cats')">cats</h2>
                </list>
            </div>
        </div>

        <div class="block">

            <template
                v-for="(post, index) in filteredPosts"
                :key="post.title"
            >

                <article
     
                    :class="{ 'post-open': selectedPost === post.title }"
                    @click="openPost(post)"
                >
                    <h1>{{ post.title }}</h1>
                    <p><span>{{ post.date }}</span></p>

                    <div v-html="post.content"></div>
                </article>

                <div
                    v-if="index < filteredPosts.length"
                    class="horizontal_line"
                ></div>

            </template>
            
            <p class="nothing">to be continue...</p>

            <p v-if="filteredPosts.length === 0" class="nothing">
                Nothing yet...
            </p>
        </div>
        
    </section>
</template>