/**
 * Node.js HTTP server entry point for Railway deployment.
 * TanStack Start builds a Web Fetch handler; this wraps it for Node.js.
 * Also proxies /api/auth/* to portal-server so auth cookies are same-domain.
 */
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORTAL_SERVER = process.env.PORTAL_SERVER_URL || 'https://intuitivestay-production.up.railway.app'

const { default: app } = await import('./dist/server/server.js')

const PORT = process.env.PORT || 3000
const STATIC_DIR = resolve(__dirname, 'dist/client')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
}

const server = http.createServer(async (req, res) => {
  // Proxy /api/auth/* to portal-server so auth cookies are set on this domain
  if (req.url.startsWith('/api/auth/')) {
    const targetUrl = `${PORTAL_SERVER}${req.url}`
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)

    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== 'host') headers[key] = value
    }

    try {
      const proxyRes = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      })

      const resHeaders = {}
      proxyRes.headers.forEach((value, key) => { resHeaders[key] = value })
      res.writeHead(proxyRes.status, resHeaders)
      const resBody = await proxyRes.arrayBuffer()
      res.end(Buffer.from(resBody))
    } catch (err) {
      console.error('Auth proxy error:', err)
      res.writeHead(502)
      res.end('Bad Gateway')
    }
    return
  }

  // Serve static assets directly (hashed filenames in dist/client)
  const urlPath = req.url.split('?')[0]
  const staticFile = join(STATIC_DIR, urlPath)

  try {
    if (existsSync(staticFile) && statSync(staticFile).isFile()) {
      const ext = extname(staticFile).toLowerCase()
      const mime = MIME_TYPES[ext] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' })
      createReadStream(staticFile).pipe(res)
      return
    }
  } catch {}

  // All other requests go to the SSR fetch handler
  const url = `http://${req.headers.host || 'localhost'}${req.url}`

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue
    if (Array.isArray(value)) value.forEach(v => headers.append(key, v))
    else headers.set(key, value)
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  })

  try {
    const response = await app.fetch(request)

    const resHeaders = {}
    response.headers.forEach((value, key) => { resHeaders[key] = value })
    res.writeHead(response.status, resHeaders)

    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    }
    res.end()
  } catch (err) {
    console.error('SSR error:', err)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`portal-web listening on port ${PORT}`)
})
