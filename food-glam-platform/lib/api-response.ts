import { NextResponse } from 'next/server'

/** Return a JSON success response */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/** Return a JSON error response */
export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

/** Return a 404 Not Found response */
export function apiNotFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

/** Return a 401 Unauthorized response */
export function apiUnauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 })
}

/** Return a 429 Too Many Requests response */
export function apiRateLimited(message = 'Too many requests. Please try again later.') {
  return NextResponse.json({ error: message }, { status: 429 })
}

/** Return a 400 Bad Request response */
export function apiBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}
