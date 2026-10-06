import { getFrequency } from './audioAnalyser'

let animationFrame = null

export function startSpectrum(canvas) {

    if (!canvas || animationFrame) return

    const ctx = canvas.getContext('2d')

    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    function draw() {

        animationFrame = requestAnimationFrame(draw)

        const data = getFrequency()

        if (!data) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        ctx.beginPath()

        const points = []

        for (let i = 0; i < data.length; i++) {

            const x = i / (data.length - 1) * canvas.width

            const y = canvas.height - (data[i] / 255) * canvas.height

            points.push({ x, y })
        }

        ctx.moveTo(points[0].x, points[0].y)

        for (let i = 1; i < points.length; i++) {

            const previous = points[i - 1]
            const current = points[i]

            const midX = (previous.x + current.x) / 2
            const midY = (previous.y + current.y) / 2

            ctx.quadraticCurveTo(
                previous.x,
                previous.y,
                midX,
                midY
            )
        }

        ctx.lineTo(
            points[points.length - 1].x,
            points[points.length - 1].y
        )
        ctx.lineTo(
            canvas.width,
            canvas.height
        )
        ctx.lineTo(
            0,
            canvas.height
        )
        ctx.closePath()

        const style = getComputedStyle(document.documentElement)

        ctx.strokeStyle = style.getPropertyValue('--spectrum')
        ctx.fillStyle = style.getPropertyValue('--spectrum-fill')

        ctx.fill()
        ctx.stroke()
    }

    draw()
}