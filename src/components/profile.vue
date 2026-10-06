<script setup>
import platforms from '../data/platforms.json'
</script>

<template>
    <section class="profile_container">

        <div class="block">
            <div class="profile_name">
                <h1>ORIMATA</h1>
                <h2>おりまた</h2>
            </div>
        </div>

        <div class="block">
            <div class="profile_info_container">

                <div class="profile_info_container_1">

                    <div class="block">
                        <p>Born in 20 Sept, 2008</p>
                        <p>Musician</p>
                    </div>

                    <div class="block">
                        <a 
                            v-for="item in platforms.platform"
                            :key="item.platform"
                            class="block platforms"
                            :style="{ backgroundColor: item.bg }"
                            :href="item.page" target="_blank"
                        >
                            <img :src="item.icon" class="platforms_icons">

                        </a>
                    </div>

                </div>

                <div class="profile_info_container_2">

                    <div class="block">
                        <h2>
                            
                        </h2>
                    </div>

                    <div class="block">
                        <h2>
                           
                        </h2>
                    </div>

                </div>

            </div>
        </div>
    </section>
</template>