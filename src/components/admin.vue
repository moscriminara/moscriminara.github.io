<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { marked } from 'marked'

const bundledPosts = import.meta.glob('/src/posts/**/*.md', {
    query: '?raw',
    import: 'default'
})

const passwordHash = '098459456589301e60f9ecaa1c74d3b5c987f48ba541d889cf83793e910b43e9'
const owner = 'moscriminara'
const repo = 'orimata'
const branch = 'main'

const password = ref('')
const authenticated = ref(localStorage.getItem('orimata_admin_auth') === 'true')
const loginError = ref(false)
const token = ref(localStorage.getItem('orimata_github_token') || '')

watch(token, value => {
  const next = value.trim()
  if (next) localStorage.setItem('orimata_github_token', next)
  else localStorage.removeItem('orimata_github_token')
})
const showConnection = ref(false)
const activeTab = ref('posts')
const busy = ref(false)
const notice = ref('')
const noticeError = ref(false)

const paths = ref({
  posts: 'src/posts',
  music: 'src/data/tracks.json',
  omikuji: 'src/data/omikuji.json'
})

const files = ref([])
const deletedPosts = new Set()
const publishedPosts = new Set()
const currentPath = ref('')
const currentSha = ref(null)
const editorText = ref('')
const savedText = ref('')
const newFilename = ref('')
const search = ref('')
const postTag = ref('logs')
const postTitle = ref('')
const postBody = ref('')
const postDate = ref('')
const isExistingPost = ref(false)
const postPreview = ref(false)
const markdownHtml = computed(() => marked.parse(postBody.value, { breaks: true }))
const musicIndex = ref(0)
const musicTracks = computed(() => Array.isArray(parsedJson.value?.track) ? parsedJson.value.track : [])
const musicKeys = computed(() => [...new Set(musicTracks.value.flatMap(t => Object.keys(t)))])
const musicFields = ['title', 'artist', 'cover', 'src']
const parsedJson = computed(() => {
  try { return JSON.parse(editorText.value) } catch { return null }
})
const isDirty = computed(() => editorText.value !== savedText.value)
const isJson = computed(() => activeTab.value !== 'posts')
const selectedFileName = computed(() => currentPath.value.split('/').pop() || 'Untitled')
const filteredFiles = computed(() => files.value.filter(f => f.name.toLowerCase().includes(search.value.toLowerCase())))

// Keep the existing frontmatter structure and any additional metadata intact.
function splitPost(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/)
  const frontmatter = match ? match[1] : ''
  const body = match ? text.slice(match[0].length) : text
  const read = key => {
    const found = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
    const raw = found?.[1]?.trim() || ''
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try { return JSON.parse(raw) } catch { return raw.slice(1, -1) }
    }
    return raw.replace(/^'|'$/g, '')
  }
  return { frontmatter, title: read('title'), tag: read('tag') || 'logs', date: read('date'), body }
}
function quoteYaml(value) {
  const text = String(value ?? '')
  // Keep normal title, tag and date values unquoted for the existing md.js parser.
  // Only quote YAML values that cannot safely be expressed as plain scalars.
  if (!text || /^[-?:,\[\]{}#&*!|>'"%@`]/.test(text) || /:\s|\s#|[\r\n]|\s$|^\s/.test(text) || /^(true|false|null|~|yes|no)$/i.test(text)) {
    return JSON.stringify(text)
  }
  return text
}
function updatePostSource() {
  const previous = splitPost(editorText.value)
  const meta = previous.frontmatter ? previous.frontmatter.split(/\r?\n/) : []
  const values = { title: postTitle.value, tag: postTag.value, date: postDate.value }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}: ${quoteYaml(value)}`
    const index = meta.findIndex(x => new RegExp(`^${key}:\\s*`).test(x))
    if (index >= 0) meta[index] = line
    else meta.push(line)
  }
  editorText.value = `---\n${meta.join('\n')}\n---\n\n${postBody.value}`
}
function readPostFields(text) {
  const post = splitPost(text)
  postTitle.value = post.title
  postTag.value = post.tag
  postDate.value = post.date
  postBody.value = post.body.replace(/^\r?\n/, '')
}
function currentPostDate() {
  const now = new Date()
  const day = now.getDate()
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]
  const year = now.getFullYear()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return `${day} ${month}, ${year} | ${time}`
}
async function hashPassword(value) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('')
}
async function login() {
  loginError.value = (await hashPassword(password.value)) !== passwordHash
  if (!loginError.value) {
    authenticated.value = true
    localStorage.setItem('orimata_admin_auth', 'true')
    password.value = ''
    await openTab('posts', true)
  }
}
function logout() {
  if (!allowLeave()) return
  authenticated.value = false
  localStorage.removeItem('orimata_admin_auth')
  // Keep the stored GitHub token so next login does not require entering it again.
  clearEditor()
}
function alertMessage(message, error = false) {
  notice.value = message
  noticeError.value = error
}
function allowLeave() {
  return !isDirty.value || window.confirm('You have unsaved changes. Discard them?')
}
function clearEditor() {
  currentPath.value = ''
  currentSha.value = null
  editorText.value = ''
  savedText.value = ''
  postTitle.value = ''
  postBody.value = ''
  postDate.value = ''
  isExistingPost.value = false
}
function urlFor(path, refQuery = false) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encoded}${refQuery ? `?ref=${encodeURIComponent(branch)}` : ''}`
}
function requestHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token.value ? { Authorization: `Bearer ${token.value.trim()}` } : {})
  }
}
async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...requestHeaders(), ...options.headers } })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).message || '' } catch { /* no body */ }
    throw new Error(`${res.status}${detail ? ` — ${detail}` : ''}`)
  }
  if (res.status === 204) return null
  return res.json()
}
// Public reads never require a personal access token.
// jsDelivr's public package index lists files without consuming GitHub API quota.
async function readPublicText(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encoded}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} — Cannot read public file: ${path}`)
  return await res.text()
}
async function readPublicPostList(dir) {
  const normalized = dir.replace(/^\/+|\/+$/g, '')
  return Object.keys(bundledPosts)
    .map(path => path.replace(/^\//, ''))
    .filter(path => path.startsWith(normalized + '/') &&
      path.slice(normalized.length + 1).indexOf('/') < 0 &&
      path.toLowerCase().endsWith('.md'))
    .map(path => ({ path, name: path.split('/').pop(), type: 'file' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
// Only writing/deleting needs Contents API. Get the latest SHA with the token
// before committing, so it works even when the file was read from raw GitHub.
async function getWriteSha(path) {
  try {
    const file = await api(urlFor(path, true))
    if (file.type !== 'file') throw new Error('Target is not a file')
    return file.sha
  } catch (err) {
    if (/^404(?:\D|$)/.test(err.message)) return null // New file
    throw err
  }
}
function decodeBase64(base64) {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
function encodeBase64(content) {
  const bytes = new TextEncoder().encode(content)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
async function loadFile(path) {
  if (!allowLeave()) return
  busy.value = true
  alertMessage('')
  try {
    const content = await readPublicText(path)
    currentPath.value = path
    currentSha.value = null // SHA is resolved with auth when publishing/deleting
    editorText.value = content
    savedText.value = content
    if (activeTab.value === 'music') musicIndex.value = 0
    if (activeTab.value === 'omikuji') fortuneIndex.value = 0
    if (activeTab.value === 'posts') {
      readPostFields(content)
      isExistingPost.value = true
    }
  } catch (err) { alertMessage(`Could not open file: ${err.message}`, true) }
  finally { busy.value = false }
}
async function loadPostList() {
  busy.value = true
  alertMessage('')
  try {
    const bundled = await readPublicPostList(paths.value.posts)
    files.value = [...new Set([...bundled.map(f => f.path), ...publishedPosts])]
      .filter(path => !deletedPosts.has(path))
      .map(path => ({ path, name: path.split('/').pop(), type: 'file' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) { files.value = []; alertMessage(`Could not load posts: ${err.message}`, true) }
  finally { busy.value = false }
}
async function openTab(tab, force = false) {
  if (!force && tab === activeTab.value) return
  if (!force && !allowLeave()) return
  activeTab.value = tab
  clearEditor()
  alertMessage('')
  if (tab === 'posts') await loadPostList()
  else await loadFile(paths.value[tab])
}
function newPost() {
  if (!allowLeave()) return
  const filename = (newFilename.value || 'new-post').trim().replace(/\.md$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-')
  if (!filename) return
  currentPath.value = `${paths.value.posts.replace(/\/$/, '')}/${filename}.md`
  currentSha.value = null
  postTitle.value = 'New Post'
  postBody.value = ''
  postDate.value = ''
  isExistingPost.value = false
  editorText.value = ''
  updatePostSource()
  savedText.value = ''
  newFilename.value = ''
  alertMessage('Draft created. Publish to save it to GitHub.')
}
async function importLocalFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !allowLeave()) return
  const ext = activeTab.value === 'posts' ? '.md' : '.json'
  if (!file.name.toLowerCase().endsWith(ext)) return alertMessage(`Please choose a ${ext} file.`, true)
  const importedPreviousPath = currentPath.value
  const importedPreviousSha = currentSha.value
  try {
    const text = await file.text()
    if (activeTab.value !== 'posts') JSON.parse(text)
    if (activeTab.value === 'posts') {
      currentPath.value = `${paths.value.posts.replace(/\/$/, '')}/${file.name}`
      currentSha.value = null
    } else {
      currentPath.value = paths.value[activeTab.value]
      // A known SHA is retained only when importing over the same loaded path.
      currentSha.value = currentPath.value === importedPreviousPath ? importedPreviousSha : null
    }
    editorText.value = text
    if (activeTab.value === 'posts') {
      readPostFields(text)
      isExistingPost.value = false // The server checks if the path already exists on Publish.
    }
    savedText.value = ''
    alertMessage('Local file imported as a draft. Review it, then publish.')
  } catch (err) { alertMessage(`Import failed: ${err.message}`, true) }
}
async function save() {
  if (!currentPath.value) return alertMessage('Open or create a file first.', true)
  if (!token.value.trim()) return alertMessage('Enter a GitHub token to publish.', true)
  if (isJson.value && !parsedJson.value) return alertMessage('Invalid JSON. Please fix it before publishing.', true)
  if (activeTab.value === 'posts' && !postTitle.value.trim()) {
    return alertMessage('Please enter a title.', true)
  }
  busy.value = true
  try {
    const writeSha = await getWriteSha(currentPath.value)
    if (activeTab.value === 'posts') {
      // Only a genuinely new GitHub file gets a fresh publication timestamp.
      // Existing files use the editable DATE field, unchanged by default.
      if (!writeSha) postDate.value = currentPostDate()
      if (!postDate.value.trim()) throw new Error('Please enter a date.')
      updatePostSource()
    }
    const result = await api(urlFor(currentPath.value), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Admin: update ${currentPath.value}`,
        content: encodeBase64(editorText.value),
        branch,
        ...(writeSha ? { sha: writeSha } : {})
      })
    })
    currentSha.value = result.content.sha
    savedText.value = editorText.value
    alertMessage('Published to GitHub. Your Pages deployment may take a moment.')
    if (activeTab.value === 'posts') {
      isExistingPost.value = true
      const path = currentPath.value
      deletedPosts.delete(path)
      publishedPosts.add(path)
      if (!files.value.some(f => f.path === path)) {
        files.value = [...files.value, { path, name: path.split('/').pop(), type: 'file' }]
          .sort((a, b) => a.name.localeCompare(b.name))
      }
    }
  } catch (err) { alertMessage(`Publish failed: ${err.message}`, true) }
  finally { busy.value = false }
}
async function deletePost() {
  if (!currentPath.value || activeTab.value !== 'posts') return
  if (!token.value.trim()) return alertMessage('Enter a GitHub token to delete.', true)
  if (!window.confirm(`Delete ${selectedFileName.value} from GitHub?`)) return
  busy.value = true
  try {
    const writeSha = await getWriteSha(currentPath.value)
    if (!writeSha) throw new Error('File no longer exists on GitHub')
    await api(urlFor(currentPath.value), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Admin: delete ${currentPath.value}`, sha: writeSha, branch })
    })
    deletedPosts.add(currentPath.value)
    publishedPosts.delete(currentPath.value)
    clearEditor()
    alertMessage('Post deleted.')
    await loadPostList()
  } catch (err) { alertMessage(`Delete failed: ${err.message}`, true) }
  finally { busy.value = false }
}
function formatJson() {
  if (parsedJson.value === null) return alertMessage('JSON syntax is invalid.', true)
  editorText.value = JSON.stringify(parsedJson.value, null, 4) + '\n'
  alertMessage('JSON formatted.')
}
function updateJsonField(index, field, value) {
  const data = parsedJson.value
  if (!Array.isArray(data) || !data[index]) return
  if (field.startsWith('oracle.')) data[index].oracle[field.slice(7)] = value
  else if (field.startsWith('guidance.')) data[index].guidance[field.slice(9)] = value
  else data[index][field] = field === 'id' ? Number(value) : value
  editorText.value = JSON.stringify(data, null, 4) + '\n'
}
function updateTrackField(index, key, value) {
  const data = parsedJson.value
  if (!Array.isArray(data?.track) || !data.track[index]) return
  const previous = data.track[index][key]
  if (previous !== null && typeof previous === 'object') {
    try { data.track[index][key] = JSON.parse(value) } catch { return alertMessage('Invalid nested JSON value.', true) }
  } else if (typeof previous === 'number') {
    data.track[index][key] = Number(value)
  } else if (typeof previous === 'boolean') {
    data.track[index][key] = value === 'true'
  } else data.track[index][key] = value
  editorText.value = JSON.stringify(data, null, 4) + '\n'
}
function addTrack() {
  const data = parsedJson.value
  if (!Array.isArray(data?.track)) return
  const prototype = data.track[0] || {}
  const entry = Object.fromEntries(Object.keys(prototype).map(key => [key, '']))
  for (const key of musicFields) if (!(key in entry)) entry[key] = ''
  data.track.push(entry)
  editorText.value = JSON.stringify(data, null, 4) + '\n'
  musicIndex.value = data.track.length - 1
}
function removeTrack(index) {
  if (!window.confirm('Remove this track from the draft?')) return
  const data = parsedJson.value
  data.track.splice(index, 1)
  editorText.value = JSON.stringify(data, null, 4) + '\n'
  musicIndex.value = Math.max(0, Math.min(index, data.track.length - 1))
}
function addFortune() {
  if (!Array.isArray(parsedJson.value)) return
  const data = parsedJson.value
  data.push({ id: Math.max(0, ...data.map(x => Number(x.id) || 0)) + 1, fortune: 'New Fortune', japanese: '', oracle: { content: '', explain: '' }, guidance: { wish: '', love: '', awaited_person: '', studies: '', business: '', travel: '' } })
  editorText.value = JSON.stringify(data, null, 4) + '\n'
}
function removeFortune(index) {
  if (!window.confirm('Remove this fortune from the draft?')) return
  const data = parsedJson.value
  data.splice(index, 1)
  editorText.value = JSON.stringify(data, null, 4) + '\n'
}
const fortuneIndex = ref(0)
onMounted(() => { if (authenticated.value) openTab('posts', true) })
watch(editorText, () => {
  if (musicIndex.value >= musicTracks.value.length) musicIndex.value = Math.max(0, musicTracks.value.length - 1)
  if (!Array.isArray(parsedJson.value)) fortuneIndex.value = 0
  else if (fortuneIndex.value >= parsedJson.value.length) fortuneIndex.value = Math.max(0, parsedJson.value.length - 1)
})
</script>

<template>
  <section class="admin_container">
    <Transition name="tools" mode="out-in">
      <div v-if="!authenticated" key="login" class="admin_login block">
        <p class="admin_eyebrow">ORIMATA / PRIVATE SPACE</p>
        <h1>Admin.</h1>
        <p class="admin_muted">Somewhere behind the ordinary pages.</p>
        <form class="admin_login_form" @submit.prevent="login">
          <input v-model="password" type="password" placeholder="Password" autocomplete="current-password" required>
          <button type="submit">Enter →</button>
        </form>
        <p v-if="loginError" class="admin_error">Incorrect password.</p>
      </div>

      <div v-else key="panel" class="admin_workspace">
        <aside class="admin_sidebar block">
          <div class="admin_brand">
            <p class="admin_eyebrow">PRIVATE / CONTROL</p>
            <h2>ORIMATA</h2>
            <span>admin console</span>
          </div>
          <nav class="admin_nav" aria-label="Admin sections">
            <button v-for="tab in ['posts', 'music', 'omikuji']" :key="tab" type="button"
              :class="{ selected: activeTab === tab }" @click="openTab(tab)">
              {{ tab }} <span>↗</span>
            </button>
          </nav>
          <button class="admin_logout" type="button" @click="logout">← Logout</button>
        </aside>

        <main class="admin_main block">
          <div class="admin_topbar">
            <div>
              <p class="admin_eyebrow">EDITOR / {{ activeTab.toUpperCase() }}</p>
              <h1>{{ activeTab.charAt(0).toUpperCase() + activeTab.slice(1) }}.</h1>
            </div>
            <button class="admin_primary" type="button" :disabled="busy || !currentPath || !isDirty" @click="save">
              {{ busy ? 'Working...' : 'Publish ↗' }}
            </button>
          </div>

          <button class="admin_settings_toggle" type="button" @click="showConnection = !showConnection">
            {{ showConnection ? 'Hide connection settings −' : 'Connection settings +'}}
          </button>
          <div class="admin_connection" :class="{ admin_connection_open: showConnection }">
            <label>GITHUB TOKEN <input v-model="token" type="password" autocomplete="off" placeholder="Publish / delete only"></label>
            <label>FILE {{ activeTab === 'posts' ? 'DIRECTORY' : 'PATH' }}
              <input v-model="paths[activeTab]" type="text" spellcheck="false">
            </label>
            <button type="button" @click="activeTab === 'posts' ? loadPostList() : loadFile(paths[activeTab])" :disabled="busy">Load</button>
          </div>

          <Transition name="tools" mode="out-in">
            <div :key="activeTab" class="admin_content">
              <div v-if="activeTab === 'posts'" class="admin_posts_layout">
                <div class="admin_filelist">
                  <div class="admin_list_header"><strong>Articles</strong><span>{{ files.length }}</span></div>
                  <input v-model="search" placeholder="Search articles..." aria-label="Search articles">
                  <div class="admin_fileitems">
                    <button v-for="file in filteredFiles" :key="file.path" type="button"
                      :class="{ selected: currentPath === file.path }" @click="loadFile(file.path)">
                      {{ file.name }}
                    </button>
                    <p v-if="!filteredFiles.length" class="admin_hint">No posts found.</p>
                  </div>
                  <div class="admin_newpost">
                    <input v-model="newFilename" placeholder="new-post-name" @keyup.enter="newPost">
                    <button type="button" @click="newPost">+ New post</button>
                    <label class="admin_import">Import .md<input type="file" accept=".md,text/markdown" @change="importLocalFile"></label>
                  </div>
                </div>
                <div class="admin_editorpane">
                  <template v-if="currentPath">
                    <div class="admin_editorhead">
                      <div><strong>{{ selectedFileName }}</strong><span>{{ currentPath }}</span></div>
                      <button v-if="currentPath && savedText" class="admin_danger" type="button" @click="deletePost">Delete</button>
                    </div>
                    <div class="admin_post_fields">
                      <label>TITLE
                        <input v-model="postTitle" placeholder="Article title" @input="updatePostSource">
                      </label>
                      <label>TAG
                        <select v-model="postTag" @change="updatePostSource">
                          <option v-for="tag in ['logs','releases','feelings','advices','cats']" :key="tag" :value="tag">{{ tag }}</option>
                        </select>
                      </label>
                      <label>{{ isExistingPost ? 'DATE (EDITABLE)' : 'DATE (AUTOMATIC FOR NEW POSTS)' }}
                        <input
                          v-model="postDate"
                          :readonly="!isExistingPost"
                          :placeholder="isExistingPost ? 'e.g. 4 Oct, 2026 | 10:09' : 'Set automatically on Publish'"
                          @input="updatePostSource"
                        >
                      </label>
                    </div>
                    <div class="admin_editor_modes">
                      <span class="admin_fieldlabel">CONTENT / MARKDOWN</span>
                      <div class="admin_head_actions">
                        <button type="button" :class="{ selected: !postPreview }" @click="postPreview = false">Editor</button>
                        <button type="button" :class="{ selected: postPreview }" @click="postPreview = true">Preview</button>
                      </div>
                    </div>
                    <textarea v-if="!postPreview" id="post-editor" v-model="postBody" @input="updatePostSource" spellcheck="false" class="admin_code" placeholder="Write something..."></textarea>
                    <div v-else class="admin_markdown_preview" v-html="markdownHtml"></div>
                  </template>
                  <div v-else class="admin_empty">Select an article or create a new one.</div>
                </div>
              </div>

              <div v-else-if="activeTab === 'music'" class="admin_posts_layout">
                <div class="admin_filelist">
                  <div class="admin_list_header"><strong>Tracks</strong><span>{{ musicTracks.length }}</span></div>
                  <div class="admin_fileitems">
                    <button v-for="(track, index) in musicTracks" :key="index" type="button"
                      :class="{ selected: musicIndex === index }" @click="musicIndex = index">
                      {{ track.title || `Track ${index + 1}` }}
                    </button>
                    <p v-if="!musicTracks.length" class="admin_hint">No tracks found.</p>
                  </div>
                  <div class="admin_newpost">
                    <button type="button" :disabled="!Array.isArray(parsedJson?.track)" @click="addTrack">+ New track</button>
                    <label class="admin_import">Import .json<input type="file" accept=".json,application/json" @change="importLocalFile"></label>
                  </div>
                </div>
                <div class="admin_editorpane">
                  <template v-if="musicTracks[musicIndex]">
                    <div class="admin_editorhead">
                      <div><strong>{{ musicTracks[musicIndex].title || 'New Track' }}</strong><span>{{ paths.music }}</span></div>
                      <button class="admin_danger" type="button" @click="removeTrack(musicIndex)">Remove</button>
                    </div>
                    <div class="admin_track_form">
                      <label v-for="key in Object.keys(musicTracks[musicIndex])" :key="key">
                        {{ key.replaceAll('_', ' ').toUpperCase() }}
                        <textarea v-if="typeof musicTracks[musicIndex][key] === 'string' && musicTracks[musicIndex][key].length > 160" rows="4"
                          :value="musicTracks[musicIndex][key]" @input="updateTrackField(musicIndex, key, $event.target.value)"></textarea>
                        <input v-else :value="typeof musicTracks[musicIndex][key] === 'object' ? JSON.stringify(musicTracks[musicIndex][key]) : musicTracks[musicIndex][key]"
                          @change="updateTrackField(musicIndex, key, $event.target.value)">
                      </label>
                    </div>
                    <img v-if="musicTracks[musicIndex].cover" :src="musicTracks[musicIndex].cover" class="admin_cover" alt="Track cover" @error="$event.target.style.display='none'">
                  </template>
                  <div v-else class="admin_empty">Load tracks.json or select a track.</div>
                  <details class="admin_rawjson"><summary>Raw JSON editor (advanced fields)</summary>
                    <textarea v-model="editorText" class="admin_code admin_json" spellcheck="false"></textarea>
                    <button type="button" @click="formatJson">Format JSON</button>
                  </details>
                </div>
              </div>

              <div v-else class="admin_posts_layout">
                <div class="admin_filelist">
                  <div class="admin_list_header"><strong>Fortunes</strong><span>{{ Array.isArray(parsedJson) ? parsedJson.length : 0 }}</span></div>
                  <div class="admin_fileitems">
                    <button v-for="(fortune, index) in (Array.isArray(parsedJson) ? parsedJson : [])" :key="fortune.id ?? index" type="button"
                      :class="{ selected: fortuneIndex === index }" @click="fortuneIndex = index">
                      {{ String(fortune.id ?? index + 1).padStart(3, '0') }} / {{ fortune.japanese || fortune.fortune }}
                    </button>
                    <p v-if="!Array.isArray(parsedJson) || !parsedJson.length" class="admin_hint">No fortunes found.</p>
                  </div>
                  <div class="admin_newpost">
                    <button type="button" :disabled="!Array.isArray(parsedJson)" @click="addFortune(); fortuneIndex = parsedJson.length - 1">+ New fortune</button>
                    <label class="admin_import">Import .json<input type="file" accept=".json,application/json" @change="importLocalFile"></label>
                  </div>
                </div>
                <div class="admin_editorpane">
                  <template v-if="Array.isArray(parsedJson) && parsedJson[fortuneIndex]">
                    <div class="admin_editorhead">
                      <div><strong>{{ parsedJson[fortuneIndex].japanese || 'New Fortune' }}</strong><span>NO. {{ String(parsedJson[fortuneIndex].id).padStart(3, '0') }}</span></div>
                      <button type="button" class="admin_danger" @click="removeFortune(fortuneIndex)">Remove</button>
                    </div>
                    <div class="admin_fortune_form">
                      <div class="admin_formrow">
                        <label>ID<input type="number" :value="parsedJson[fortuneIndex].id" @change="updateJsonField(fortuneIndex, 'id', $event.target.value)"></label>
                        <label>FORTUNE<input :value="parsedJson[fortuneIndex].fortune" @input="updateJsonField(fortuneIndex, 'fortune', $event.target.value)"></label>
                      </div>
                      <label>JAPANESE<input :value="parsedJson[fortuneIndex].japanese" @input="updateJsonField(fortuneIndex, 'japanese', $event.target.value)"></label>
                      <label>ORACLE<input :value="parsedJson[fortuneIndex].oracle?.content" @input="updateJsonField(fortuneIndex, 'oracle.content', $event.target.value)"></label>
                      <label>EXPLANATION<textarea rows="4" :value="parsedJson[fortuneIndex].oracle?.explain" @input="updateJsonField(fortuneIndex, 'oracle.explain', $event.target.value)"></textarea></label>
                      <p class="admin_eyebrow">GUIDANCE</p>
                      <label v-for="field in ['wish','love','awaited_person','studies','business','travel']" :key="field">
                        {{ field.replaceAll('_', ' ').toUpperCase() }}
                        <textarea rows="2" :value="parsedJson[fortuneIndex].guidance?.[field]" @input="updateJsonField(fortuneIndex, `guidance.${field}`, $event.target.value)"></textarea>
                      </label>
                    </div>
                  </template>
                  <div v-else class="admin_empty">Load omikuji.json or select a fortune.</div>
                  <details class="admin_rawjson"><summary>Raw JSON editor</summary>
                    <textarea v-model="editorText" class="admin_code admin_json" spellcheck="false"></textarea>
                    <button type="button" @click="formatJson">Format JSON</button>
                  </details>
                </div>
              </div>
            </div>
          </Transition>

          <div class="admin_status">
            <span :class="{ admin_error: noticeError }">{{ notice || (isDirty ? '● Unsaved changes' : (currentPath ? 'All changes saved locally.' : 'Ready.')) }}</span>
            <span v-if="currentPath">{{ isDirty ? 'DRAFT' : 'SYNCED' }}</span>
          </div>
        </main>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.admin_container { width: 100%; height: 100%; min-height: 0; font-family: var(--heading); overflow: hidden; }
/* If the parent has no definite height, anchor the workspace to its viewport window. */
.admin_workspace { height: 100%; }
/* The full Admin workspace is anchored within the viewport, with a 40px bottom inset. */
.admin_container * { box-sizing: border-box; }
.admin_login { width: min(470px, calc(100% - 24px)); padding: 48px 40px; margin: max(12vh, 45px) auto; text-align: center; }
.admin_login h1 { margin: 12px 0 20px; font-size: clamp(38px, 6vw, 56px); font-weight: 400; }
.admin_eyebrow { font-family: var(--mono); font-size: 10px !important; letter-spacing: 2px; color: var(--text); opacity: .65; margin: 0; }
.admin_muted, .admin_hint { font-size: 13px; opacity: .7; line-height: 1.7; }
.admin_login_form { display: flex; gap: 8px; margin-top: 32px; }
.admin_container input, .admin_container textarea, .admin_container select { min-width: 0; width: 100%; color: var(--text-h); background: var(--glass); border: 1px solid var(--glass-border); border-radius: 9px; outline: none; font: 13px/1.6 var(--sans); padding: 11px 13px; transition: border-color .2s; }
.admin_container input:focus, .admin_container textarea:focus, .admin_container select:focus { border-color: var(--accent-border); }
.admin_container button { cursor: pointer; background: transparent; color: var(--text-h); border: 1px solid var(--glass-border); border-radius: 9px; padding: 10px 15px; font: 13px var(--heading); transition: background .2s, transform .2s, border-color .2s; }
.admin_container button:hover { background: var(--accent-bg); border-color: var(--accent-border); }
.admin_container button:active { transform: scale(.98); }
.admin_container button:disabled { opacity: .4; pointer-events: none; }
.admin_error { color: #db6576 !important; }
.admin_workspace { position: fixed; top: 50px; bottom: 50px; left: 50px; right: 50px; display: grid; grid-template-columns: 200px minmax(0, 1fr); height: auto; min-height: 0; overflow: hidden; }
.admin_sidebar { display: flex; flex-direction: column; padding: 22px 14px; min-height: 0; }
.admin_brand { padding: 20px 10px 32px; }
.admin_brand h2 { margin: 15px 0 2px; font-size: 23px; letter-spacing: 4px; }
.admin_brand span { font-size: 11px; opacity: .6; }
.admin_nav { display: flex; flex-direction: column; gap: 6px; }
.admin_nav button { text-align: left; display: flex; justify-content: space-between; text-transform: lowercase; letter-spacing: 1px; border: 1px solid transparent; }
.admin_nav button.selected, .admin_fileitems button.selected, .admin_fortune_tabs button.selected { background: var(--accent-bg); border-color: var(--accent-border); }
.admin_nav button span { opacity: .4; }
.admin_logout { margin-top: auto; text-align: left; border: 0 !important; opacity: .7; }
.admin_main { display: flex; flex-direction: column; height: auto; min-height: 0; min-width: 0; overflow: hidden; }
.admin_topbar { display: flex; justify-content: space-between; align-items: center; padding: 22px 26px; gap: 12px; border-bottom: 1px solid var(--glass-border); }
.admin_topbar h1 { font-size: clamp(28px, 4vw, 38px); margin: 10px 0 0; }
.admin_container button.admin_primary { background: var(--accent-bg); border-color: var(--accent-border); white-space: nowrap; }
.admin_connection { display: grid; grid-template-columns: minmax(130px, .7fr) minmax(160px, 1.3fr) auto; gap: 12px; padding: 16px 26px; border-bottom: 1px solid var(--glass-border); align-items: end; }
.admin_connection label, .admin_fortune_form label { display: flex; flex-direction: column; gap: 6px; min-width: 0; font: 10px var(--mono); letter-spacing: 1px; color: var(--text); }
.admin_connection input { font-family: var(--mono); font-size: 11px; }
.admin_content { flex: 1 1 0; min-height: 0; overflow: hidden; }
.admin_posts_layout { display: grid; grid-template-columns: 230px minmax(0,1fr); height: 100%; min-height: 0; overflow: hidden; }
.admin_filelist { border-right: 1px solid var(--glass-border); padding: 20px 14px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; gap: 12px; }
.admin_list_header, .admin_editorhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.admin_list_header strong, .admin_editorhead strong { font-size: 15px; font-weight: 500; color: var(--text-h); }
.admin_list_header span, .admin_editorhead span { font: 10px var(--mono); opacity: .6; overflow-wrap: anywhere; }
.admin_fileitems { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; min-height: 0; flex: 1; }
.admin_fileitems button { text-align: left; overflow-wrap: anywhere; padding: 10px; font-size: 12px; }
.admin_filelist .admin_hint { margin: 10px; }
.admin_import { display: inline-flex; justify-content: center; align-items: center; text-align: center; border: 1px solid var(--glass-border); border-radius: 9px; cursor: pointer; padding: 10px 15px; font-size: 12px; }
.admin_import:hover { background: var(--accent-bg); border-color: var(--accent-border); }
.admin_import input { display: none; }
.admin_head_actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.admin_newpost { margin-top: auto; display: grid; gap: 8px; }
.admin_editorpane, .admin_single_editor { padding: 22px 24px; min-width: 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
.admin_editorhead div { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.admin_fieldlabel { font: 10px var(--mono); letter-spacing: 2px; opacity: .7; }
.admin_container textarea.admin_code { font: 12px/1.8 var(--mono); resize: vertical; min-height: 300px; flex: 1; white-space: pre; tab-size: 4; }
.admin_container textarea.admin_json { min-height: 260px; }
.admin_editor_modes { display:flex; justify-content:space-between; align-items:center; }
.admin_editor_modes button.selected { background:var(--accent-bg); border-color:var(--accent-border); }
.admin_markdown_preview { flex:1; min-height:300px; padding:20px; overflow:auto; border:1px solid var(--glass-border); border-radius:10px; color:var(--post-text); font-family:var(--heading); overflow-wrap:anywhere; }
.admin_markdown_preview :deep(img) { max-width:100%; height:auto; }
.admin_markdown_preview :deep(pre) { overflow:auto; }
.admin_post_fields { display: grid; grid-template-columns: minmax(0, 1fr) 145px; gap: 14px; flex-shrink: 0; }
.admin_post_fields label { display: flex; flex-direction: column; gap: 6px; min-width: 0; font: 10px var(--mono); letter-spacing: 1px; color: var(--text); }
.admin_post_fields label:last-child { grid-column: 1 / -1; }
.admin_post_fields input[readonly] { opacity: .65; }
.admin_track_form { display:flex; flex-direction:column; gap:14px; }
.admin_track_form label { display:flex; flex-direction:column; gap:6px; font:10px var(--mono); letter-spacing:1px; color:var(--text); }
.admin_cover { width:160px; max-width:100%; border-radius:9px; object-fit:cover; }
.admin_newpost { flex-shrink:0; }
.admin_empty { display: grid; place-items: center; color: var(--text); opacity: .6; min-height: 360px; font-size: 13px; text-align: center; }
.admin_danger { color: #d46b79 !important; }
.admin_fortune_tabs { display: flex; gap: 7px; overflow-x: auto; padding: 3px 0 10px; }
.admin_fortune_tabs button { white-space: nowrap; }
.admin_fortune_tabs .admin_add { margin-left: auto; }
.admin_fortune_form { display: flex; flex-direction: column; gap: 14px; padding-bottom: 20px; }
.admin_formrow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.admin_fortune_form textarea { resize: vertical; }
.admin_fortune_form .admin_eyebrow { margin-top: 12px; }
.admin_fortune_form > .admin_danger { align-self: flex-start; }
.admin_rawjson { border-top: 1px solid var(--glass-border); padding-top: 14px; }
.admin_rawjson summary { cursor: pointer; font-size: 12px; margin-bottom: 12px; }
.admin_status { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--glass-border); padding: 12px 26px; font: 11px var(--mono); opacity: .8; }
@media (max-width: 1024px) {
  .admin_workspace { top: 10px; bottom: 40px; left: 10px; right: 10px; }
  .admin_post_fields { grid-template-columns: minmax(0,1fr); }
  .admin_post_fields label:last-child { grid-column: auto; }
  .admin_workspace { grid-template-columns: 1fr; grid-template-rows: auto minmax(0,1fr); }
  .admin_sidebar { margin-bottom: 0; padding: 12px; }
  .admin_brand { padding: 3px 8px 8px; }
  .admin_brand h2 { margin: 7px 0 0; font-size: 18px; }
  .admin_nav { flex-direction: row; }
  .admin_nav button { flex: 1; padding: 10px; }
  .admin_logout { position: absolute; top: 15px; right: 20px; font-size: 11px !important; }
  .admin_main { margin-top: 5px; }
  .admin_connection { grid-template-columns: 1fr; padding: 13px; }
  .admin_topbar { padding: 18px 14px; }
  .admin_posts_layout { grid-template-columns: 1fr; grid-template-rows: minmax(145px, 30%) minmax(0, 1fr); }

  .admin_filelist { min-height: 0; border-right: 0; border-bottom: 1px solid var(--glass-border); }
  .admin_fileitems { max-height:none; }
  .admin_editorpane, .admin_single_editor { padding: 16px 14px; }
  .admin_status { padding: 10px 14px; }
  .admin_login { padding: 32px 20px; }
}

/* More robust fixed-window sizing: block borders/margins cannot expand the viewport. */
.admin_workspace > .block { margin: 0; min-width: 0; min-height: 0; }
.admin_workspace { gap: 10px; }
.admin_settings_toggle { display: none; }
.admin_content, .admin_posts_layout, .admin_editorpane, .admin_filelist { min-width: 0; }
.admin_editorpane, .admin_fileitems { overscroll-behavior: contain; }
@media (max-width: 1024px) {
  .admin_workspace { gap: 8px; grid-template-rows: auto minmax(0, 1fr); }
  .admin_sidebar { min-height: 0; padding: 8px 10px; overflow: visible; }
  .admin_brand { padding: 1px 6px 4px; }
  .admin_brand .admin_eyebrow, .admin_brand span { display: none; }
  .admin_brand h2 { font-size: 15px; margin: 0; }
  .admin_nav { gap: 3px; }
  .admin_nav button { justify-content: center; text-align: center; padding: 7px 5px; font-size: 12px; }
  .admin_nav button span { display: none; }
  .admin_logout { right: 12px; top: 8px; padding: 4px 8px !important; }
  .admin_main { min-height: 0; margin: 0; }
  .admin_topbar { padding: 11px 12px; flex-shrink: 0; }
  .admin_topbar h1 { font-size: 25px; margin: 4px 0 0; }
  .admin_topbar .admin_eyebrow { font-size: 9px !important; }
  .admin_primary { padding: 9px 11px !important; }
  .admin_settings_toggle { display: block; flex-shrink: 0; padding: 8px 12px !important; border: 0 !important; border-bottom: 1px solid var(--glass-border) !important; border-radius: 0 !important; text-align: left; font-size: 11px !important; }
  .admin_connection { display: none; grid-template-columns: minmax(0, 1fr); padding: 10px 12px; gap: 8px; flex-shrink: 0; }
  .admin_connection.admin_connection_open { display: grid; }
  .admin_connection input { padding: 7px 9px; }
  .admin_posts_layout { grid-template-rows: minmax(105px, 24%) minmax(0, 1fr); }
  .admin_filelist { padding: 9px 11px; gap: 6px; }
  .admin_fileitems { display: flex; flex-direction: row; align-items: flex-start; flex-wrap: nowrap; min-height: 32px; overflow-x: auto; overflow-y: auto; }
  .admin_fileitems button { flex: 0 0 auto; max-width: 180px; padding: 7px 9px; font-size: 11px; }
  .admin_newpost { display: flex; flex-wrap: wrap; gap: 5px; margin: 0; }
  .admin_newpost input { flex: 1 1 115px; padding: 7px 9px; }
  .admin_newpost button, .admin_import { padding: 7px 9px !important; font-size: 11px; }
  .admin_editorpane, .admin_single_editor { padding: 12px; gap: 10px; }
  .admin_formrow { grid-template-columns: minmax(0, 1fr); }
  .admin_editorhead { flex-wrap: wrap; }
  .admin_editorhead span { display: block; }
  .admin_container textarea.admin_code { min-height: 180px; }
  .admin_markdown_preview { min-height: 180px; }
  .admin_status { padding: 8px 12px; font-size: 10px; flex-shrink: 0; }
}
@media (max-width: 600px) {
  .admin_workspace { top: 20px; bottom: max(50px, env(safe-area-inset-bottom)); left: 20px; right: 20px; }
  .admin_filelist { gap: 5px; }
  .admin_posts_layout { grid-template-rows: minmax(96px, 25%) minmax(0,1fr); }
  .admin_container input, .admin_container textarea, .admin_container select { font-size: 16px; }
  .admin_login_form { flex-direction: column; }
  .admin_login { max-height: calc(100dvh - 80px); overflow-y: auto; }
}

/* Mobile: roomier file strip and aligned create/import controls. */
@media (max-width: 1024px) {
  .admin_posts_layout {
    grid-template-rows: clamp(205px, 34dvh, 300px) minmax(0, 1fr);
    min-height: 0;
  }
  .admin_filelist {
    min-height: 0;
    padding: 12px;
    gap: 10px;
    overflow: hidden;
  }
  .admin_fileitems {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 8px;
    overflow-x: auto;
    overflow-y: auto;
    padding: 2px 0 7px;
  }
  .admin_fileitems button {
    flex: 0 0 150px;
    min-height: 48px;
    max-width: 185px;
    height: fit-content;
    padding: 11px;
    white-space: normal;
    text-align: left;
  }
  .admin_newpost {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    flex: 0 0 auto;
    align-items: stretch;
  }
  .admin_newpost > input {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
    margin: 0;
  }
  .admin_newpost > button,
  .admin_newpost > .admin_import {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    min-height: 38px;
    margin: 0 !important;
    padding: 9px 7px !important;
    line-height: 1.3;
    text-align: center;
  }
}
@media (max-width: 600px) {
  .admin_posts_layout {
    grid-template-rows: clamp(205px, 35dvh, 275px) minmax(0, 1fr);
  }
  .admin_fileitems button {
    flex-basis: 135px;
  }
}
</style>
