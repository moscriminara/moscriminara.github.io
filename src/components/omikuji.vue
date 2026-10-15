<script setup>
import { ref } from 'vue'
import omikuji from '../data/omikuji.json'

const result = ref(null)
const today = ref(getToday())

function getToday() {
    const date = new Date()

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

const saved = JSON.parse(localStorage.getItem('omikuji_daily') || 'null')

if (saved && saved.date === getToday()) {
    result.value = omikuji.find(item => item.id === saved.id) || null
}

function drawOmikuji() {
    if (localStorage.getItem('omikuji_daily')) {
        const record = JSON.parse(localStorage.getItem('omikuji_daily'))

        if (record.date === getToday()) return
    }

    const index = Math.floor(Math.random() * omikuji.length)
    result.value = omikuji[index]

    localStorage.setItem('omikuji_daily', JSON.stringify({
        date: getToday(),
        id: result.value.id
    }))
}
</script>

<template>
    <section>

        <transition name="omikuji" mode="out-in">

            <div v-if="!result" class="omikuji_container" key="draw">
                <img
                    src="/tools_img/omikuji.png"
                    class="omikuji_img"
                    @click="drawOmikuji"
                >
            </div>

            <div v-else :key="result.id" class="omikuji_result">

                <div>
                    <p>
                        <span>
                            OMIKUJI - NO.{{ String(result.id).padStart(3, '0') }}
                        </span>
                    </p>
                    <h1>{{ result.fortune }}</h1>
                    <p>{{ result.japanese }}</p>
                </div>

                <div class="horizontal_line"></div>

                <div>
                    <p><span>ORACLE</span></p>
                    <h2 class="oracle">"{{ result.oracle.content }}"</h2>
                    <p>{{ result.oracle.explain }}</p>
                </div>

                <div class="horizontal_line"></div>

                <div>

                    <div class="guidance">
                        <h2>WISH</h2>
                        <p>{{ result.guidance.wish }}</p>
                    </div>

                    <div class="horizontal_line sub"></div>

                    <div class="guidance">
                        <h2>LOVE</h2>
                        <p>{{ result.guidance.love }}</p>
                    </div>

                    <div class="horizontal_line sub"></div>

                    <div class="guidance">
                        <h2>AWAITED PERSON</h2>
                        <p>{{ result.guidance.awaited_person }}</p>
                    </div>

                    <div class="horizontal_line sub"></div>

                    <div class="guidance">
                        <h2>STUDIES</h2>
                        <p>{{ result.guidance.studies }}</p>
                    </div>

                    <div class="horizontal_line sub"></div>

                    <div class="guidance">
                        <h2>TRAVEL</h2>
                        <p>{{ result.guidance.travel }}</p>
                    </div>

                    <div class="horizontal_line sub"></div>

                    <div class="guidance">
                        <h2>BUSINESS</h2>
                        <p>{{ result.guidance.business }}</p>
                    </div>

                </div>

                <div class="horizontal_line"></div>

                <p class="nothing">another fortune awaits tomorrow | {{ today }}</p>

            </div>
        </transition>

    </section>
</template>