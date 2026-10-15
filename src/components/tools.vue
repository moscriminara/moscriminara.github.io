<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
    <section class="tools_container">
        <div class="block">

            <router-view v-slot="{ Component }">
                <transition name="tools" mode="out-in">

                    <div v-if="route.path === '/tools'" class="tools" key="home">

                        <router-link to="/tools/omikuji">
                            <div class="block toolcard">
                                <h2>omikuji</h2>
                                <img src="/tools_img/omikuji.jpeg">
                            </div>
                        </router-link>

                        <router-link to="/tools/weather">
                            <div class="block toolcard">
                                <h2>weather</h2>
                                <img src="/tools_img/weather.webp">
                            </div>
                        </router-link>

                    </div>

                    <KeepAlive v-else>
                        <component :is="Component" :key="route.path"/>
                    </KeepAlive>

                </transition>
            </router-view>

        </div>
    </section>
</template>