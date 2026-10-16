<script setup>
import { ref, computed, onDeactivated  } from 'vue'
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

const selectedImage = ref(null)
const imageScale = ref(1)
const imageX = ref(0)
const imageY = ref(0)

const imageRef = ref(null)

function loadPosts(tag) {
    selectedTag.value = tag
    localStorage.setItem('selectedTag', tag)
}

function clampImagePosition(x, y) {
    const img = imageRef.value
    if (!img) return { x, y }

    const viewer = img.parentElement

    const scaledWidth = img.offsetWidth * imageScale.value
    const scaledHeight = img.offsetHeight * imageScale.value

    const maxX = Math.max(
        0,
        (scaledWidth - viewer.clientWidth) / 2
    )

    const maxY = Math.max(
        0,
        (scaledHeight - viewer.clientHeight) / 2
    )

    return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y))
    }
}

function zoomImage(event) {
    const img = imageRef.value
    if (!img) return

    const oldScale = imageScale.value

    const newScale = Math.min(
        5,
        Math.max(1, oldScale * (event.deltaY > 0 ? 0.9 : 1.1))
    )

    if (newScale === oldScale) return

    const rect = img.getBoundingClientRect()

    const mouseX = event.clientX - (rect.left + rect.width / 2)
    const mouseY = event.clientY - (rect.top + rect.height / 2)

    const ratio = newScale / oldScale

    imageX.value -= mouseX * (ratio - 1)
    imageY.value -= mouseY * (ratio - 1)

    imageScale.value = newScale

    if (newScale <= 1) {
        imageX.value = 0
        imageY.value = 0
    } else {
        const position = clampImagePosition(
            imageX.value,
            imageY.value
        )

        imageX.value = position.x
        imageY.value = position.y
    }
}

const isDragging = ref(false)

let dragStartX = 0
let dragStartY = 0
let startImageX = 0
let startImageY = 0

function startDrag(event) {
    if (event.button !== 0 || imageScale.value <= 1) return

    isDragging.value = true

    dragStartX = event.clientX
    dragStartY = event.clientY

    startImageX = imageX.value
    startImageY = imageY.value

    event.currentTarget.setPointerCapture(event.pointerId)
}

function moveDrag(event) {
    if (!isDragging.value) return

    const x = startImageX + event.clientX - dragStartX
    const y = startImageY + event.clientY - dragStartY

    const position = clampImagePosition(x, y)

    imageX.value = position.x
    imageY.value = position.y
}

function stopDrag(event) {
    isDragging.value = false

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
    }
}

function openImage(event) {
    const img = event.target.closest('img')

    if (!img || !event.currentTarget.contains(img)) return

    selectedImage.value = img.src
    imageScale.value = 1
    imageX.value = 0
    imageY.value = 0
}

function closeImage() {
    selectedImage.value = null
    imageScale.value = 1
    imageX.value = 0
    imageY.value = 0
    isDragging.value = false
}

onDeactivated(() => {
    closeImage()
})
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
            <Transition name="tools" mode="out-in">
                <div :key="selectedTag" class="posts_list">

                    <template
                        v-for="(post, index) in filteredPosts"
                        :key="post.title"
                    >
                        <article
                            class="post_article"
                            @click="openPost(post)"
                        >
                            <h1>{{ post.title }}</h1>
                            <p><span>{{ post.date }}</span></p>

                            <div 
                                class="markdown_body" 
                                v-html="post.content"
                                @click="openImage"
                            ></div>
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
            </Transition>
        </div>

        <transition name="image-viewer">
            <div
                v-if="selectedImage"
                class="image_viewer"
                @click.self="closeImage"
                @wheel.prevent="zoomImage"
            >
                <img
                    ref="imageRef"
                    :src="selectedImage"
                    alt="Image preview"
                    draggable="false"

                    @dragstart.prevent
                    @selectstart.prevent

                    @pointerdown="startDrag"
                    @pointermove="moveDrag"
                    @pointerup="stopDrag"
                    @pointercancel="stopDrag"
                    @lostpointercapture="isDragging = false"

                    :class="{ 'is-dragging': isDragging }"
                    :style="{
                        transform: `translate(${imageX}px, ${imageY}px) scale(${imageScale})`
                    }"
                >
            </div>
        </transition>
        
    </section>

</template>