import { createApp } from 'vue'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import './style.css'

import App from './App.vue'
import Home from './components/home.vue'
import Post from './components/post.vue'
import Player from './components/music.vue'
import Tools from './components/tools.vue'
import Gallery from './components/gallery.vue'
import Profile from './components/profile.vue'

import Admin from './components/admin.vue'

import Omikuji from './components/omikuji.vue'
import Weather from './components/weather.vue'

const routes = [
    { 
        path:'/', 
        component: Home,
        children: [
            {
                path: 'post',
                component: Post
            },
            {
                path: 'player',
                component: Player
            },
            {
                path: 'tools',
                component: Tools,
                children: [
                    {
                        path: 'omikuji',
                        component: Omikuji
                    },
                    {
                        path: 'weather',
                        component: Weather
                    }
                ]
            },
            {
                path: 'gallery',
                component: Gallery
            },
            {
                path: 'profile',
                component: Profile
            }
        ]
    },
    {
        path: '/admin',
        name: 'admin',
        component: Admin
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

createApp(App).use(router).mount('#app')
