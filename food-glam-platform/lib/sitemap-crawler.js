/**
 * Sitemap crawler for discovering recipe URLs from sitemap.xml files.
 * Handles sitemap index files (nested sitemaps) and <url> extraction.
 *
 * Usage:
 *   const { crawlSitemap, extractLocs } = require('./sitemap-crawler')
 *
 *   const urls = await crawlSitemap('https://example.com/sitemap.xml')
 *   const filtered = await crawlSitemap('https://example.com/sitemap.xml', {
 *     urlFilter: ['/recipes/', '/food/'],
 *     maxUrls: 500
 *   })
 */

const { fetchUrl } = require('./http-fetcher')

/**
 * Extract <loc> values from XML string (simple regex, no XML parser needed).
 * @param {string} xml - XML content
 * @returns {string[]} Array of URLs found in <loc> tags
 */
function extractLocs(xml) {
  const matches = [...xml.matchAll(/<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)]
  return matches.map((m) => m[1].trim())
}

/**
 * Fetch and parse a sitemap, returning all URLs found.
 * Handles both regular sitemaps and sitemap index files.
 * @param {string} sitemapUrl - URL to sitemap.xml
 * @param {object} [options] - Crawl options
 * @param {string[]} [options.urlFilter] - Only return URLs containing these strings
 * @param {number} [options.maxUrls=1000] - Max URLs to return
 * @param {boolean} [options.recursive=true] - Follow sitemap index references
 * @param {number} [options.maxIndexDepth=3] - Max nested sitemap index levels to follow
 * @returns {Promise<string[]>} Array of discovered URLs
 */
async function crawlSitemap(sitemapUrl, options = {}) {
  const {
    urlFilter = [],
    maxUrls = 1000,
    recursive = true,
    maxIndexDepth = 3,
  } = options

  const visited = new Set()
  const allUrls = []

  async function crawl(url, depth = 0) {
    if (visited.has(url) || allUrls.length >= maxUrls) {
      return
    }
    visited.add(url)

    try {
      const result = await fetchUrl(url, { timeout: 20000 })
      if (result.statusCode !== 200) {
        return
      }

      const locs = extractLocs(result.body)

      // Check if this is a sitemap index (contains .xml URLs)
      const xmlUrls = locs.filter((u) => u.endsWith('.xml'))
      const regularUrls = locs.filter((u) => !u.endsWith('.xml'))

      // If it's a sitemap index and we haven't exceeded depth, recurse
      if (xmlUrls.length > 0 && recursive && depth < maxIndexDepth) {
        // Limit to first 5 nested sitemaps to avoid excessive crawling
        const toProcess = xmlUrls.slice(0, 5)
        for (const nestedUrl of toProcess) {
          if (allUrls.length >= maxUrls) break
          await crawl(nestedUrl, depth + 1)
        }
      } else {
        // Regular sitemap — add URLs
        for (const u of regularUrls) {
          if (allUrls.length >= maxUrls) break

          // Apply filters
          if (urlFilter.length > 0) {
            const matches = urlFilter.some((filter) =>
              u.toLowerCase().includes(filter.toLowerCase())
            )
            if (!matches) continue
          }

          allUrls.push(u)
        }
      }
    } catch (err) {
      // Silently skip failed sitemaps
    }
  }

  await crawl(sitemapUrl)

  // Deduplicate and return
  return [...new Set(allUrls)]
}

module.exports = { crawlSitemap, extractLocs }
