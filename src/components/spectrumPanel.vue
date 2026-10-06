<script setup>
import { ref, onMounted } from 'vue'
import {
    DEFAULT_TILT,
    DEFAULT_SIGMA,
    getTilt,
    getSigma,
    setTilt,
    setSigma
} from '../tools/audioAnalyser'

const open = ref(false)

const tilt = ref(DEFAULT_TILT)
const sigma = ref(DEFAULT_SIGMA)

onMounted(() => {
    tilt.value = getTilt()
    sigma.value = getSigma()
})

function updateTilt() {
    setTilt(parseFloat(tilt.value))
}

function updateSigma() {
    setSigma(parseFloat(sigma.value))
}

function reset() {
    tilt.value = DEFAULT_TILT
    sigma.value = DEFAULT_SIGMA

    updateTilt()
    updateSigma()
}

</script>

<template>
    <button
        class="spectrum_toggle"
        :class="{ active: open }"
        @click="open = !open"
    >
        EQ
    </button>

    <div
        class="block spectrum_panel no_select"
        v-show="open"
    >

        <p class="spectrum_title">频谱调节</p>

        <div class="spectrum_row">
            <div class="spectrum_label">
                <p>低频抑制 / 高频增益</p>
                <span>{{ tilt.toFixed(1) }} dB/oct</span>
            </div>

            <input
                type="range"
                min="0"
                max="12"
                step="0.1"
                v-model.number="tilt"
                @input="updateTilt"
            >
        </div>

        <div class="spectrum_row">
            <div class="spectrum_label">
                <p>高斯平滑</p>
                <span>σ {{ sigma.toFixed(1) }}</span>
            </div>

            <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                v-model.number="sigma"
                @input="updateSigma"
            >
        </div>

        <button
            class="spectrum_reset"
            @click="reset"
        >
            重置
        </button>

    </div>
</template>
