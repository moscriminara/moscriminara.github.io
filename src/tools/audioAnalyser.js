let audioContext = null
let source = null
let analyser = null

const TILT_KEY = 'spectrumTilt'
const SIGMA_KEY = 'spectrumSigma'

// 频谱倾斜上限 dB/倍频程，平滑 sigma 上限
const TILT_MAX = 12
const SIGMA_MAX = 5

export const DEFAULT_TILT = 4.0
export const DEFAULT_SIGMA = 1.0

// tilt：低频抑制 + 高频增益，dB/倍频程，以 1kHz 为锚点
// （移植自 visualizer_refactored 的 tilt，正值压低频、抬高频）
let tilt = loadSetting(TILT_KEY, DEFAULT_TILT, 0, TILT_MAX)

// sigma：对相邻频点做一维高斯卷积的平滑强度，<= 0 时关闭
let sigma = loadSetting(SIGMA_KEY, DEFAULT_SIGMA, 0, SIGMA_MAX)

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

export function setTilt(value) {

    tilt = Math.min(TILT_MAX, Math.max(0, value))

    tiltCurve = null

    saveSetting(TILT_KEY, tilt)
}

export function setSigma(value) {

    sigma = Math.min(SIGMA_MAX, Math.max(0, value))

    gaussian = buildKernel(sigma)

    saveSetting(SIGMA_KEY, sigma)
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

export function audioAnalyser(audio) {

    if (analyser) {
        return analyser
    }

    audioContext = new AudioContext()

    source = audioContext.createMediaElementSource(audio)

    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.93

    source.connect(analyser)
    analyser.connect(audioContext.destination)

    return analyser
}

export function getFrequency() {

    if (!analyser) return null

    const data = new Uint8Array(analyser.frequencyBinCount)

    analyser.getByteFrequencyData(data)

    if (!tiltCurve) {
        tiltCurve = buildTiltCurve()
    }

    const spectrum = data.slice(0, tiltCurve.length)

    for (let i = 0; i < spectrum.length; i++) {

        // Uint8Array 赋值会回绕，负偏移必须先钳到 0
        const value = Math.min(255, Math.max(0, data[i] + tiltCurve[i]))

        spectrum[i] = value
    }

    if (gaussian) {
        return applyGaussian(spectrum)
    }

    return spectrum
}
