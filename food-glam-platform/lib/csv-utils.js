/**
 * CSV utilities for reading and writing RFC 4180 compliant CSV files.
 * Handles quoted fields, escaped quotes, and custom delimiters.
 *
 * Usage:
 *   const { parseCSV, toCSV, readCSV, writeCSV } = require('./csv-utils')
 *
 *   const { headers, rows } = parseCSV(csvString)
 *   const csv = toCSV(rows, { headers: ['Name', 'Age'] })
 *   writeCSV('output.csv', rows, { headers: ['Name', 'Age'] })
 */

const fs = require('fs')

/**
 * Escape a single CSV field value.
 * Quotes and escapes fields containing delimiter, quotes, or newlines.
 * @param {string} value - Field value
 * @param {string} [delimiter=','] - Field delimiter
 * @returns {string} Escaped field value
 */
function escapeField(value, delimiter = ',') {
  const str = String(value ?? '')

  // Check if field needs quoting
  if (
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    // Escape quotes by doubling them
    return '"' + str.replace(/"/g, '""') + '"'
  }

  return str
}

/**
 * Parse a CSV string into an array of rows (arrays of strings).
 * Handles quoted fields with escaped quotes and multi-line quoted fields.
 * @param {string} content - CSV content
 * @param {object} [options] - Parse options
 * @param {string} [options.delimiter=','] - Field delimiter
 * @param {boolean} [options.hasHeader=true] - First row is header
 * @returns {{ headers: string[] | null, rows: string[][] }}
 */
function parseCSV(content, options = {}) {
  const { delimiter = ',', hasHeader = true } = options

  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim())
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
      }
      // Skip \r\n combination
      if (char === '\r' && nextChar === '\n') {
        i++
      }
    } else {
      currentField += char
    }
  }

  // Add last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow)
    }
  }

  // Extract headers if present
  let headers = null
  let dataRows = rows

  if (hasHeader && rows.length > 0) {
    headers = rows[0]
    dataRows = rows.slice(1)
  }

  return { headers, rows: dataRows }
}

/**
 * Convert rows to CSV string.
 * @param {string[][]} rows - Array of row arrays
 * @param {object} [options] - Write options
 * @param {string[]} [options.headers] - Header row to prepend
 * @param {string} [options.delimiter=','] - Field delimiter
 * @returns {string} CSV content
 */
function toCSV(rows, options = {}) {
  const { headers, delimiter = ',' } = options

  const lines = []

  // Add headers if provided
  if (headers && Array.isArray(headers)) {
    lines.push(headers.map((h) => escapeField(h, delimiter)).join(delimiter))
  }

  // Add data rows
  for (const row of rows) {
    const escapedFields = row.map((field) => escapeField(field, delimiter))
    lines.push(escapedFields.join(delimiter))
  }

  return lines.join('\n')
}

/**
 * Read and parse a CSV file.
 * @param {string} filePath - Path to CSV file
 * @param {object} [options] - Same as parseCSV options
 * @returns {{ headers: string[] | null, rows: string[][] }}
 */
function readCSV(filePath, options = {}) {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parseCSV(content, options)
}

/**
 * Write rows to a CSV file.
 * @param {string} filePath - Path to CSV file
 * @param {string[][]} rows - Array of row arrays
 * @param {object} [options] - Same as toCSV options
 */
function writeCSV(filePath, rows, options = {}) {
  const csv = toCSV(rows, options)
  fs.writeFileSync(filePath, csv, 'utf-8')
}

/**
 * Append rows to an existing CSV file.
 * @param {string} filePath - Path to CSV file
 * @param {string[][]} rows - Array of row arrays to append
 * @param {object} [options] - Write options (delimiter, etc.)
 */
function appendCSV(filePath, rows, options = {}) {
  const { delimiter = ',' } = options

  const lines = rows.map((row) =>
    row.map((field) => escapeField(field, delimiter)).join(delimiter)
  )

  const content = lines.join('\n')
  if (content.length > 0) {
    fs.appendFileSync(filePath, '\n' + content, 'utf-8')
  }
}

module.exports = {
  parseCSV,
  toCSV,
  escapeField,
  readCSV,
  writeCSV,
  appendCSV,
}
