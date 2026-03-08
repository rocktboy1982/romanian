/**
 * File-based progress tracker for resumable batch operations.
 * Saves/loads progress from a JSON file in the scripts directory.
 *
 * Usage:
 *   const { createProgressTracker } = require('./progress-tracker')
 *
 *   const tracker = createProgressTracker('.my-progress.json')
 *   tracker.load()
 *   if (!tracker.isProcessed(id)) {
 *     // process item
 *     tracker.markProcessed(id)
 *     tracker.incrementStat('processed')
 *     tracker.save()
 *   }
 */

const fs = require('fs')
const path = require('path')

/**
 * Create a progress tracker instance.
 * @param {string} filename - Progress file name (e.g., '.my-progress.json')
 * @param {string} [dir] - Directory for the file (defaults to scripts/)
 * @returns {object} Progress tracker with load, save, isProcessed, markProcessed, etc.
 */
function createProgressTracker(filename, dir) {
  const filePath = path.join(
    dir || path.join(__dirname, '..', 'scripts'),
    filename
  )

  let state = {
    processedIds: [],
    skippedIds: [],
    stats: {},
    lastOffset: 0,
    startedAt: null,
    updatedAt: null,
  }

  return {
    /**
     * Load progress from file.
     * @returns {object} The loaded state
     */
    load() {
      try {
        if (fs.existsSync(filePath)) {
          state = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          // Convert processedIds to Set for faster lookups if needed
          if (Array.isArray(state.processedIds)) {
            state._processedSet = new Set(state.processedIds)
          }
          if (Array.isArray(state.skippedIds)) {
            state._skippedSet = new Set(state.skippedIds)
          }
        }
      } catch (err) {
        console.error(`Failed to load progress from ${filePath}:`, err.message)
      }
      return state
    },

    /**
     * Save progress to file.
     */
    save() {
      try {
        // Convert Sets back to arrays for JSON serialization
        const toSave = {
          ...state,
          processedIds: state._processedSet
            ? Array.from(state._processedSet)
            : state.processedIds,
          skippedIds: state._skippedSet
            ? Array.from(state._skippedSet)
            : state.skippedIds,
          updatedAt: new Date().toISOString(),
        }
        // Remove internal Set references
        delete toSave._processedSet
        delete toSave._skippedSet

        fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf-8')
      } catch (err) {
        console.error(`Failed to save progress to ${filePath}:`, err.message)
      }
    },

    /**
     * Check if an ID has been processed.
     * @param {string|number} id - The ID to check
     * @returns {boolean}
     */
    isProcessed(id) {
      const idStr = String(id)
      if (state._processedSet) {
        return state._processedSet.has(idStr)
      }
      return state.processedIds.includes(idStr)
    },

    /**
     * Check if an ID has been skipped.
     * @param {string|number} id - The ID to check
     * @returns {boolean}
     */
    isSkipped(id) {
      const idStr = String(id)
      if (state._skippedSet) {
        return state._skippedSet.has(idStr)
      }
      return state.skippedIds.includes(idStr)
    },

    /**
     * Mark an ID as processed.
     * @param {string|number} id - The ID to mark
     */
    markProcessed(id) {
      const idStr = String(id)
      if (!state._processedSet) {
        state._processedSet = new Set(state.processedIds)
      }
      state._processedSet.add(idStr)
      // Also update the array for compatibility
      if (!state.processedIds.includes(idStr)) {
        state.processedIds.push(idStr)
      }
    },

    /**
     * Mark an ID as skipped.
     * @param {string|number} id - The ID to mark
     */
    markSkipped(id) {
      const idStr = String(id)
      if (!state._skippedSet) {
        state._skippedSet = new Set(state.skippedIds)
      }
      state._skippedSet.add(idStr)
      // Also update the array for compatibility
      if (!state.skippedIds.includes(idStr)) {
        state.skippedIds.push(idStr)
      }
    },

    /**
     * Get current stats.
     * @returns {object}
     */
    getStats() {
      return { ...state.stats }
    },

    /**
     * Update a stat value.
     * @param {string} key - Stat key
     * @param {any} value - Stat value
     */
    updateStat(key, value) {
      state.stats[key] = value
    },

    /**
     * Increment a counter stat.
     * @param {string} key - Stat key
     * @param {number} [amount=1] - Amount to increment
     */
    incrementStat(key, amount = 1) {
      state.stats[key] = (state.stats[key] || 0) + amount
    },

    /**
     * Set the last offset (for pagination).
     * @param {number} offset - The offset value
     */
    setLastOffset(offset) {
      state.lastOffset = offset
    },

    /**
     * Get the last offset.
     * @returns {number}
     */
    getLastOffset() {
      return state.lastOffset
    },

    /**
     * Mark the start time.
     */
    markStart() {
      state.startedAt = new Date().toISOString()
    },

    /**
     * Get the start time.
     * @returns {string|null}
     */
    getStartTime() {
      return state.startedAt
    },

    /**
     * Reset all progress.
     */
    reset() {
      state = {
        processedIds: [],
        skippedIds: [],
        stats: {},
        lastOffset: 0,
        startedAt: null,
        updatedAt: null,
      }
      delete state._processedSet
      delete state._skippedSet
    },

    /**
     * Get the full state (for debugging).
     * @returns {object}
     */
    getState() {
      return {
        ...state,
        processedIds: state._processedSet
          ? Array.from(state._processedSet)
          : state.processedIds,
        skippedIds: state._skippedSet
          ? Array.from(state._skippedSet)
          : state.skippedIds,
      }
    },
  }
}

module.exports = { createProgressTracker }
