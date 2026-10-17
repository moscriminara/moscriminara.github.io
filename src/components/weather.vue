<script setup>
import { ref, computed, onMounted } from 'vue'

const weather = ref(null)
const search = ref('') 
const city = ref('Sydney')
const error = ref('')
const loading = ref(false)

const selectedMetric = ref('temperature_2m')

const hoveredPoint = ref(null)

const showWeather = computed(() =>
    !!weather.value && !loading.value && !error.value
)

const metrics = {
    temperature_2m: {
        label: 'Temperature',
        unit: '°C'
    },
    relative_humidity_2m: {
        label: 'Humidity',
        unit: '%'
    },
    precipitation: {
        label: 'Rainfall',
        unit: 'mm'
    },
    precipitation_probability: {
        label: 'Rain Probability',
        unit: '%'
    },
    wind_speed_10m: {
        label: 'Wind Speed',
        unit: 'km/h'
    }
}

const currentMetricValue = computed(() => {
    if (!weather.value?.queryTime || !timeline.value.length) {
        return null
    }

    const minutes = weather.value.queryTime.minutes

    const hour = Math.floor(minutes / 60)

    return timeline.value[hour]?.value ?? null
})

const timeline = computed(() => {
    if (!weather.value?.hourly) return []

    const hourly = weather.value.hourly

    return hourly.time.map((time, index) => ({
        time,
        value: hourly[selectedMetric.value][index]
    }))
})

const chartWidth = 960
const chartHeight = 300

const padding = {
    top: 30,
    right: 30,
    bottom: 45,
    left: 60
    }


const chart = computed(() => {
    if (!timeline.value.length) return null

    const values = timeline.value
        .map(item => item.value)
        .filter(value => Number.isFinite(value))

    if (!values.length) return null

    // 计算平均值
    const average = values.reduce((a, b) => a + b, 0)
        / values.length

    // 计算上下偏离平均值的最大距离
    const deviation = Math.max(
        ...values.map(value => Math.abs(value - average)),
        0.1
    ) * 1.1

    const min = average - deviation
    const max = average + deviation

    const width = chartWidth - padding.left - padding.right
    const height = chartHeight - padding.top - padding.bottom

    // 平均值固定在图表垂直中心
    const centerY = padding.top + height / 2

    const getY = value =>
        padding.top + height -
        ((value - min) / (max - min)) * height

    const points = timeline.value.map((item, index) => {
        const x = padding.left + (index / 24) * width

        const y = Number.isFinite(item.value)
        ? getY(item.value)
        : null

        return {
        ...item,
        x,
        y,
        barY: y === null ? null : Math.min(y, centerY),
        barHeight: y === null ? 0 : Math.abs(y - centerY),
        aboveAverage: item.value >= average
        }
    })

    const yTicks = Array.from({ length: 5 }, (_, index) => {
        const value = min + (max - min) * index / 4

        return {
        value,
        y: getY(value)
        }
    })

    const nowX = padding.left +
        (weather.value.queryTime.minutes / 1440) * width

    return {
        points,
        yTicks,
        nowX,
        average,
        centerY
    }
})

function formatDate(date) {
    const [year, month, day] = date.split('-')

    const monthName = new Date(
        2000, Number(month) - 1, 1
    ).toLocaleString('en-GB', { month: 'short' })

    return `${Number(day)} ${monthName}, ${year}`
}

function getLocalTime(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date)

    const part = type =>
        parts.find(item => item.type === type).value

    return {
        date: `${part('year')}-${part('month')}-${part('day')}`,
        time: `${part('hour')}:${part('minute')}`,
        minutes: Number(part('hour')) * 60 + Number(part('minute'))
    }
}

async function getWeather(latitude, longitude) {

    const requestedAt = new Date()

    const url = new URL(
        'https://api.open-meteo.com/v1/forecast'
    )

    url.searchParams.set('latitude', latitude)
    url.searchParams.set('longitude', longitude)
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('forecast_days', '1')

    url.searchParams.set('current', [
        'temperature_2m',
        'relative_humidity_2m',
        'weather_code'
    ].join(','))

    url.searchParams.set('hourly', [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
        'precipitation_probability',
        'wind_speed_10m'
    ].join(','))

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error('Weather request failed')
    }

    const data = await response.json()

    data.queryTime = getLocalTime(
        requestedAt,
        data.timezone
    )

    return data
}

async function searchWeather() {
    if (!search.value.trim() || loading.value) return

    loading.value = true
    error.value = ''

    try {
        const url = new URL(
        'https://geocoding-api.open-meteo.com/v1/search'
        )

        url.searchParams.set('name', search.value.trim())
        url.searchParams.set('count', '1')

        const response = await fetch(url)
        if (!response.ok) throw new Error('Location request failed')

        const data = await response.json()

        if (!data.results?.length) {
        error.value = 'Location not found'
        return
        }

        const location = data.results[0]

        const result = await getWeather(
        location.latitude,
        location.longitude
        )

        weather.value = result
        city.value = location.name

    } catch (err) {
        error.value = 'Failed to fetch weather'
        console.error(err)
    } finally {
        loading.value = false
    }
}

function onPointEnter(event, point) {
    if (event.pointerType === 'mouse') {
        hoveredPoint.value = point
    }
}

function onPointLeave(event) {
    if (event.pointerType === 'mouse') {
        hoveredPoint.value = null
    }
}

function onPointClick(point) {
    hoveredPoint.value =
        hoveredPoint.value?.time === point.time
            ? null
            : point
}

onMounted(async () => {
  try {
    weather.value = await getWeather(-33.87, 151.21)
  } catch (err) {
    error.value = 'Failed to fetch weather'
  }
})
</script>

<template>
    <section>

        <div class="weather">

            <div class="weather_search">
    
                <h1>Weather</h1>
                <form class="block" @submit.prevent="searchWeather">
                    <input
                        class="input"
                        v-model="search"
                        placeholder="Enter a place"
                    >
                </form>
                <p class="nothing">Powered by Open Meteo</p>

            </div>

            <div class="horizontal_line"></div>

            <transition name="weather" mode="out-in">
                <div
                    v-if="showWeather"
                    class="weather_result"
                    :key="city"
                >
                    <div v-if="showWeather" class="weather_info">
                        <div class="temp">
                            <h1>{{ weather.current.temperature_2m }}°C</h1>
                            <h2>{{ city }}</h2>
                        </div>
                    </div>

                    <div
                        v-if="showWeather"
                        class="horizontal_line"
                    ></div>

                    <div v-if="showWeather" class="weather_timeline">

                        <div class="timeline_header">

                            <h2>Forecast</h2>
                            <p>{{ formatDate(weather.queryTime.date) }}</p>

                            <select v-model="selectedMetric" class="weather_select">
                                <option
                                    v-for="(metric, key) in metrics"
                                    :key="key"
                                    :value="key"
                                >
                                    {{ metric.label }}
                                </option>
                            </select>
                        </div>

                        <div class="timeline_content" v-if="chart">
                            <svg
                                :viewBox="`0 0 ${chartWidth} ${chartHeight}`"

                                class="weather_chart"
                            >
                                <g v-for="tick in chart.yTicks" :key="tick.value">
                                    <line
                                        :x1="padding.left"
                                        :x2="chartWidth - padding.right"
                                        :y1="tick.y"
                                        :y2="tick.y"
                                        class="chart_grid"
                                    />

                                    <text
                                        :x="padding.left - 12"
                                        :y="tick.y + 4"
                                        text-anchor="end"
                                        class="chart_label"
                                    >
                                        {{ tick.value.toFixed(1) }}
                                    </text>
                                </g>

                                <g
                                    v-for="(point, index) in chart.points"
                                    :key="point.time"
                                >
                                    <text
                                        v-if="index % 3 === 0"
                                        :x="point.x"
                                        :y="chartHeight - 12"
                                        text-anchor="middle"
                                        class="chart_label"
                                    >
                                        {{ point.time.slice(11, 16) }}
                                    </text>
                                </g>

                                <line
                                    :x1="padding.left"
                                    :x2="chartWidth - padding.right"
                                    :y1="chart.centerY"
                                    :y2="chart.centerY"
                                    class="chart_average_line"
                                />

                                <text
                                    :x="padding.left - 12"
                                    :y="chart.centerY + 4"
                                    text-anchor="end"
                                    class="chart_label"
                                >
                                    {{ chart.average.toFixed(1) }}
                                </text>

                                >
                                <rect
                                    v-for="point in chart.points"
                                    :key="point.time"
                                    :x="point.x - 10"
                                    :y="point.barY ?? chart.centerY"
                                    width="20"
                                    :height="point.barHeight"
                                    rx="3"
                                    :class="[
                                        'chart_bar',
                                        point.aboveAverage ? 'above_average' : 'below_average'
                                    ]"
                                    @pointerenter="onPointEnter($event, point)"
                                    @pointerleave="onPointLeave($event)"
                                    @click="onPointClick(point)"
                                />
                                <g v-if="hoveredPoint && hoveredPoint.y !== null"
                                    class="chart_tooltip"
                                    :transform="`translate(${hoveredPoint.x}, ${hoveredPoint.barY - 15})`"
                                >
                                    <rect
                                        x="-35"
                                        y="-32"
                                        width="70"
                                        height="28"
                                        rx="6"
                                        class="tooltip_background"
                                    />

                                    <text
                                        x="0"
                                        y="-14"
                                        text-anchor="middle"
                                        class="tooltip_text"
                                    >
                                        {{ hoveredPoint.value }}{{ metrics[selectedMetric].unit }}
                                    </text>
                                </g>

                                <g v-if="weather.queryTime">

                                    <line
                                        :x1="chart.nowX"
                                        :x2="chart.nowX"
                                        :y1="padding.top"
                                        :y2="chartHeight - padding.bottom"
                                        class="chart_now_line"
                                    />

                                    <text
                                        :x="chart.nowX"
                                        :y="padding.top - 12"
                                        text-anchor="middle"
                                        class="chart_now_label"
                                    >
                                        {{ weather.queryTime.time }} | {{ currentMetricValue ?? '--' }}{{ metrics[selectedMetric].unit }}
                                    </text>

                                </g>

                            </svg>
                        </div>

                    </div>

                    <div
                        v-if="showWeather"
                        class="horizontal_line"
                    ></div>

                    <p class="nothing">Have a nice day~</p>
                </div>
            </transition>

            <transition name="weather_sum" mode="out-in">
                <div
                    v-if="loading || error"
                    :key="loading ? 'loading' : 'error'"
                    class="weather_load"
                >
                    <h2 v-if="loading">Searching...</h2>
                    <h2 v-else>{{ error }}</h2>
                </div>
            </transition>

        </div>

    </section>
</template>