import { marked } from 'marked'

const files = import.meta.glob('../**/*.md', {
    eager: true,
    query: '?raw',
    import: 'default'
})

function parseMarkdown(file) {
    const match = file.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/)

    if (!match) return null

    const [, meta, content] = match

    const data = Object.fromEntries(
        meta.trim().split('\n').map(line => {
            const [key, ...value] = line.split(':')
            return [key.trim(), value.join(':').trim()]
        })
    )

    return {
        ...data,
        content: marked(content)
    }
}

const markdownData = Object.fromEntries(
    Object.entries(files)
        .map(([path, file]) => [path, parseMarkdown(file)])
        .filter(([, data]) => data)
)

export function getMarkdown(path) {
    return markdownData[`../${path}`] ?? null
}

export function getMarkdownFolder(folder) {
    const prefix = `../${folder}/`

    return Object.entries(markdownData)
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, data]) => ({
            path,
            ...data
        }))
}