import { createApp } from 'vue'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import './style.css'

import App from './App.vue'
import Home from './components/home.vue'
import Post from './components/post.vue'
import Player from './components/music.vue'
import Gallery from './components/gallery.vue'
import Profile from './components/profile.vue'

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
                path: 'gallery',
                component: Gallery
            },
            {
                path: 'profile',
                component: Profile
            }
        ]
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

createApp(App).use(router).mount('#app')
