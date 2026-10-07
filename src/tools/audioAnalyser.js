let audioContext = null
let source = null
let analyser = null

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

export function getAudioContext() {
    return audioContext
}

export function getFrequency() {

    if (!analyser) return null

    const data = new Uint8Array(analyser.frequencyBinCount)

    analyser.getByteFrequencyData(data)

    const maxFrequency = 15000
    const binWidth = analyser.context.sampleRate / analyser.fftSize
    const maxBin = Math.floor(maxFrequency / binWidth)

    const result = data.slice(0, maxBin)

    for (let i = 0; i < result.length; i++) {

        const t = i / (data.length - 1)

        const gain = 0.6 + Math.pow(t, 1.5)
        const value = Math.min(255, data[i] * gain)

        result[i] = value
    }

    return result
}