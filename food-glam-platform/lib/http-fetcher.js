/**
 * HTTP Fetcher with retries, timeouts, and redirect handling.
 * Uses Node.js built-in http/https modules (no external deps).
 *
 * Usage:
 *   const { fetchUrl, fetchJson, delay } = require('./http-fetcher')
 *
 *   const result = await fetchUrl('https://example.com/recipe')
 *   const data = await fetchJson('https://api.example.com/data')
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')

/**
 * Fetch a URL with timeout, redirect following, and retry logic.
 * @param {string} url - URL to fetch
 * @param {object} [options] - Fetch options
 * @param {number} [options.timeout=15000] - Timeout in ms
 * @param {number} [options.maxRedirects=5] - Max redirects to follow
 * @param {number} [options.retries=2] - Number of retries on failure
 * @param {number} [options.retryDelay=2000] - Delay between retries in ms
 * @param {object} [options.headers] - Additional headers
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
function fetchUrl(url, options = {}) {
  const {
    timeout = 15000,
    maxRedirects = 5,
    retries = 2,
    retryDelay = 2000,
    headers = {},
  } = options

  return new Promise((resolve, reject) => {
    const attempt = (attemptNum = 0) => {
      try {
        const parsed = new URL(url)
        const lib = parsed.protocol === 'https:' ? https : http

        const requestHeaders = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
          ...headers,
        }

        const req = lib.get(
          {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: requestHeaders,
            timeout,
          },
          (res) => {
            // Handle redirects
            if (
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location &&
              maxRedirects > 0
            ) {
              const redirectUrl = res.headers.location.startsWith('http')
                ? res.headers.location
                : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`

              return fetchUrl(redirectUrl, {
                ...options,
                maxRedirects: maxRedirects - 1,
              })
                .then(resolve)
                .catch(reject)
            }

            const chunks = []
            res.on('data', (chunk) => chunks.push(chunk))
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf8'),
              })
            })
            res.on('error', reject)
          }
        )

        req.on('error', (err) => {
          if (attemptNum < retries) {
            setTimeout(() => attempt(attemptNum + 1), retryDelay * (attemptNum + 1))
          } else {
            reject(err)
          }
        })

        req.on('timeout', () => {
          req.destroy()
          if (attemptNum < retries) {
            setTimeout(() => attempt(attemptNum + 1), retryDelay * (attemptNum + 1))
          } else {
            reject(new Error('Request timeout'))
          }
        })
      } catch (err) {
        if (attemptNum < retries) {
          setTimeout(() => attempt(attemptNum + 1), retryDelay * (attemptNum + 1))
        } else {
          reject(err)
        }
      }
    }

    attempt()
  })
}

/**
 * Fetch and return parsed JSON.
 * @param {string} url - URL to fetch
 * @param {object} [options] - Same as fetchUrl options
 * @returns {Promise<object>}
 */
async function fetchJson(url, options = {}) {
  const result = await fetchUrl(url, options)
  try {
    return JSON.parse(result.body)
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${url}: ${err.message}`)
  }
}

/**
 * Delay utility.
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = { fetchUrl, fetchJson, delay }
