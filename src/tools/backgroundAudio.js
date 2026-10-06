import { ref } from 'vue'
import { resumeAudioContext } from './audioAnalyser'

// 后台播放方案：主 audio 元素接入 Web Audio（MediaElementAudioSourceNode）后，
// 输出被永久接管，手机浏览器切后台会挂起 AudioContext 导致无声。
// 页面隐藏时把播放平移到从未接入 Web Audio 的备用元素上走原生通道，
// 回到前台再平移回来。桌面浏览器后台不挂起 AudioContext，不启用切换。

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))

// 桌面调试：localStorage 里设 bgAudioDebug=1 可在非移动端强制启用切换
const enabled = MOBILE_UA || localStorage.getItem('bgAudioDebug') === '1'

// 当前承担播放的元素：主元素（可视化图）或备用元素（原生通道）
export const activeAudio = ref(null)

let mainEl = null
let bgEl = null
let mode = 'graph' // graph：Web Audio 路径；native：备用元素原生路径
let unlocked = false

const pending = []
let chain = Promise.resolve()

export function onAudioEvent(type, handler) {

    const wrapped = event => {
        if (event.target === activeAudio.value) handler(event)
    }

    pending.push({ type, wrapped })

    if (mainEl) {
        mainEl.addEventListener(type, wrapped)
        bgEl.addEventListener(type, wrapped)
    }

    return () => {
        const index = pending.findIndex(item => item.wrapped === wrapped)

        if (index !== -1) pending.splice(index, 1)

        if (mainEl) {
            mainEl.removeEventListener(type, wrapped)
            bgEl.removeEventListener(type, wrapped)
        }
    }
}

export function initBackgroundAudio(main, bg) {

    mainEl = main
    bgEl = bg
    activeAudio.value = main

    for (const { type, wrapped } of pending) {
        mainEl.addEventListener(type, wrapped)
        bgEl.addEventListener(type, wrapped)
    }

    if (enabled) {
        document.addEventListener('visibilitychange', onVisibility)

        // 调试钩子：桌面测试或在手机上连远程调试时，直接驱动切换、观察内部状态
        window.__bgAudio = {
            toNative,
            toGraph,
            state: () => ({
                mode,
                active: activeAudio.value === mainEl ? 'main' : 'bg',
                main: { paused: mainEl.paused, t: +mainEl.currentTime.toFixed(2) },
                bg: { paused: bgEl.paused, t: +bgEl.currentTime.toFixed(2) }
            })
        }
    }
}

// iOS 要求每个媒体元素先在用户手势里"解锁"，之后才允许脚本在后台 play()
export function unlockNative(src) {

    if (!enabled || unlocked || !bgEl) return

    unlocked = true

    bgEl.muted = true
    bgEl.src = src

    bgEl.play().then(() => {

        // 期间已切到原生通道的话别打断真实播放
        if (!bgEl.muted) return

        bgEl.pause()
        bgEl.currentTime = 0
        bgEl.muted = false
    }).catch(() => {
        bgEl.muted = false
        unlocked = false
    })
}

function onVisibility() {

    const hidden = document.visibilityState === 'hidden'

    // 串行化，避免快速切走又切回时两次切换交叉执行
    chain = chain.then(() => hidden ? toNative() : toGraph()).catch(() => {})
}

async function toNative() {

    if (mode !== 'graph' || !mainEl || !bgEl || mainEl.paused) return

    try {
        bgEl.muted = false

        if (bgEl.src !== mainEl.src) {
            bgEl.src = mainEl.src
        }

        bgEl.currentTime = mainEl.currentTime

        await bgEl.play()

        activeAudio.value = bgEl
        mode = 'native'

        mainEl.pause()
    } catch {
        // 原生通道没接上，维持原状（后台无声与旧行为一致）
    }
}

async function toGraph() {

    if (mode !== 'native' || !mainEl || !bgEl) return

    const paused = bgEl.paused

    try {
        await resumeAudioContext()

        if (mainEl.src !== bgEl.src) {
            mainEl.src = bgEl.src
        }

        mainEl.currentTime = bgEl.currentTime

        if (paused) {
            // 后台期间已被暂停（如锁屏控制），只把状态挪回主元素，不恢复播放
            activeAudio.value = mainEl
            mode = 'graph'
            return
        }

        await mainEl.play()

        activeAudio.value = mainEl
        mode = 'graph'

        bgEl.pause()
    } catch {
        // 回不来就留在原生通道，至少后台声音不受影响
    }
}
