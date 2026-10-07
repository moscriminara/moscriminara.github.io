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

                    <div class="block profile_info">

                        <p>
                            Currently making music for individuals, game soundtracks 
                            and collaborative albums/EPs. Genres includes 
                            <u>Contemporary Classical</u>, 
                            <u>Ambient</u>, 
                            <u>Trance</u>,
                            <u>Drum & Bass</u>,
                            <u>Math Rock</u>,
                            <u>Synth Pop</u> 
                            and ect.
                        </p>

                        <div>
                            <img src="/profile_icons/birthday.png" class="profile_icons">
                            <p>20 Sept, 2008</p>
                        </div>

                        <div>
                            <img src="/profile_icons/mail.png" class="profile_icons">
                            <a href="mailto:kanozkuyo@gmail.com">
                                <p>kanozkuyo@gmail.com</p>
                            </a>
                        </div>

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

                    <div class="block profile_img_block">
                        <img src="/profileimg1.jpg" class="profile_img">
                    </div>

                    <div class="block profile_img_block">
                        <img src="/profileimg2.jpg" class="profile_img">
                    </div>

                </div>

            </div>
        </div>
    </section>
</template>