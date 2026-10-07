let audioContext = null
let analyser = null

// 静默镜像 <audio>：真正出声的永远只有主元素（它从不进 Web Audio 图，切后台由
// 浏览器原生保证继续播）；镜像被接管进图、不连 destination，全程无声，只喂频谱
let mirror = null
let mainAudio = null

// 镜像与主元素位置差超过该秒数就硬回正（对装饰性频谱不可感知）
const DRIFT_LIMIT = 0.25

const TILT_KEY = 'spectrumTilt'
const SIGMA_KEY = 'spectrumSigma'
const SENSITIVITY_KEY = 'spectrumSensitivity'

// 滑块范围：tilt 允许负值（反向 = 低频增益/高频抑制）
const TILT_MIN = -12
const TILT_MAX = 24
const SIGMA_MAX = 10
const SENSITIVITY_MIN = 0.1
const SENSITIVITY_MAX = 3

export const DEFAULT_TILT = 4.0
export const DEFAULT_SIGMA = 1.0
export const DEFAULT_SENSITIVITY = 1.0

// tilt：高低频平衡，dB/倍频程，以 1kHz 为锚点
// （移植自 visualizer_refactored 的 tilt，正值压低频、抬高频）
let tilt = loadSetting(TILT_KEY, DEFAULT_TILT, TILT_MIN, TILT_MAX)

// sigma：对相邻频点做一维高斯卷积的平滑强度，<= 0 时关闭
let sigma = loadSetting(SIGMA_KEY, DEFAULT_SIGMA, 0, SIGMA_MAX)

// 灵敏度：整个频谱的高度倍率，叠加 tilt 之后乘上去
let sensitivity = loadSetting(SENSITIVITY_KEY, DEFAULT_SENSITIVITY, SENSITIVITY_MIN, SENSITIVITY_MAX)

// 每个频点的字节域增益偏移，tilt 变化时重建
let tiltCurve = null

// 归一化高斯核，sigma 变化时重建
let gaussian = buildKernel(sigma)

function loadSetting(key, fallback, min, max) {

    const value = parseFloat(localStorage.getItem(key))

    if (isNaN(value)) return fallback

    return Math.min(max, Math.max(min, value))
}

function saveSetting(key, value) {
    localStorage.setItem(key, String(value))
}

export function getTilt() {
    return tilt
}

export function getSigma() {
    return sigma
}

export function getSensitivity() {
    return sensitivity
}

export function setTilt(value) {

    tilt = Math.min(TILT_MAX, Math.max(TILT_MIN, value))

    tiltCurve = null

    saveSetting(TILT_KEY, tilt)
}

export function setSigma(value) {

    sigma = Math.min(SIGMA_MAX, Math.max(0, value))

    gaussian = buildKernel(sigma)

    saveSetting(SIGMA_KEY, sigma)
}

export function setSensitivity(value) {

    sensitivity = Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, value))

    saveSetting(SENSITIVITY_KEY, sensitivity)
}

// 按当前 sigma 预计算归一化高斯核，radius 取 3 倍 sigma 截断
function buildKernel(sigma) {

    if (sigma <= 0) return null

    const radius = Math.ceil(sigma * 3)
    const kernel = new Float32Array(radius * 2 + 1)

    let sum = 0

    for (let i = 0; i < kernel.length; i++) {

        const x = i - radius

        kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))

        sum += kernel[i]
    }

    for (let i = 0; i < kernel.length; i++) {
        kernel[i] /= sum
    }

    return { kernel, radius }
}

function buildTiltCurve() {

    const binWidth = analyser.context.sampleRate / analyser.fftSize
    const maxFrequency = 12000
    const maxBin = Math.min(
        Math.floor(maxFrequency / binWidth),
        analyser.frequencyBinCount
    )

    // 字节刻度覆盖的 dB 跨度，把 tilt 的 dB 增益换算成 0-255 上的偏移
    const dbSpan = analyser.maxDecibels - analyser.minDecibels

    const curve = new Float32Array(maxBin)

    for (let i = 0; i < maxBin; i++) {

        const frequency = Math.max(i * binWidth, 20)
        const octaves = Math.log2(frequency / 1000)

        curve[i] = tilt * octaves * 255 / dbSpan
    }

    return curve
}

// 两端 clamp 索引，等价于参考实现的 edge 填充，避免最左/最右被拉低
function applyGaussian(data) {

    const { kernel, radius } = gaussian
    const length = data.length
    const result = new Uint8Array(length)

    for (let i = 0; i < length; i++) {

        let sum = 0

        for (let j = -radius; j <= radius; j++) {

            const index = Math.min(length - 1, Math.max(0, i + j))

            sum += data[index] * kernel[j + radius]
        }

        result[i] = sum
    }

    return result
}

export function audioAnalyser(main) {

    if (analyser) {
        return analyser
    }

    mainAudio = main

    audioContext = new AudioContext()

    mirror = new Audio()
    mirror.preload = 'auto'

    const source = audioContext.createMediaElementSource(mirror)

    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.93

    source.connect(analyser)

    // 兜底接一条零增益通道到 destination：保证渲染图一定被拉起、analyser 一定出数据
    const silent = audioContext.createGain()
    silent.gain.value = 0
    analyser.connect(silent)
    silent.connect(audioContext.destination)

    // 本函数只在首次点卡片的用户手势栈里被调，此刻先把镜像指到同一曲目
    mirror.src = main.currentSrc || main.src

    bindMirror(main)
    bindRevival()

    return analyser
}

function bindMirror(main) {

    // 主元素开始出声（含后台自动切歌），镜像同曲同位无声跟进
    main.addEventListener('play', followMain)

    main.addEventListener('pause', () => {
        mirror.pause()
    })

    // 主元素拖/跳进度后立即跟位（暂停中拖动也同步）
    main.addEventListener('seeked', () => {
        if (mirror.readyState >= 1) {
            mirror.currentTime = main.currentTime
        }
    })

    main.addEventListener('ratechange', () => {
        mirror.playbackRate = main.playbackRate
    })

    // 播放中持续对表：镜像掉队（自动播放被拒、加载失败）就拉起来，漂移超限就回正
    main.addEventListener('timeupdate', () => {
        if (main.paused) return

        if (mirror.paused && !mirror.error) {
            if (mirror.readyState >= 1) {
                mirror.currentTime = main.currentTime
            }
            mirror.play().catch(() => {})
            return
        }

        if (Math.abs(mirror.currentTime - main.currentTime) > DRIFT_LIMIT) {
            mirror.currentTime = main.currentTime
        }
    })
}

function followMain() {

    const src = mainAudio.currentSrc || mainAudio.src

    if (!src) return

    if (mirror.src !== src) {
        mirror.src = src
    }

    mirror.playbackRate = mainAudio.playbackRate

    const sync = () => {
        if (Math.abs(mirror.currentTime - mainAudio.currentTime) > 0.05) {
            mirror.currentTime = mainAudio.currentTime
        }
        mirror.play().catch(() => {})
    }

    if (mirror.readyState >= 1) {
        sync()
    } else {
        mirror.addEventListener('loadedmetadata', sync, { once: true })
    }
}

// AudioContext 只影响频谱，不影响出声（出声走主元素原生通道），所以这里不做
// onstatechange 之类的自动续命去对抗系统的后台挂起策略；只在用户手势或回到
// 前台时尝试恢复一次，失败也无害，下次手势再来
function bindRevival() {

    const revive = () => {
        if (audioContext.state !== 'suspended') return
        audioContext.resume().catch(() => {})
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revive()
    })

    document.addEventListener('pointerdown', revive, true)

    mainAudio.addEventListener('play', revive)
}

export function getFrequency() {

    if (!analyser) return null

    const data = new Uint8Array(analyser.frequencyBinCount)

    analyser.getByteFrequencyData(data)

    if (!tiltCurve) {
        tiltCurve = buildTiltCurve()
    }

    const spectrum = data.slice(0, tiltCurve.length)

    // 静音（暂停后的衰减尾音、无声段）直接回零：tilt 是对信号的增益偏置，
    // 不能把静音本身抬成一条静态曲线，否则没播放时画面上也一直挂着频谱
    let silent = true

    for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > 0) {
            silent = false
            break
        }
    }

    if (silent) return spectrum

    for (let i = 0; i < spectrum.length; i++) {

        // Uint8Array 赋值会回绕，必须先钳到 [0,255]；灵敏度是叠加 tilt 后的整体高度倍率
        const value = Math.min(255, Math.max(0, (data[i] + tiltCurve[i]) * sensitivity))

        spectrum[i] = value
    }

    if (gaussian) {
        return applyGaussian(spectrum)
    }

    return spectrum
}
