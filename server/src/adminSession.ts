import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'

const COOKIE_NAME = 'admin_session'
const MAX_AGE_SECONDS = 60 * 60 * 12

export function passwordsMatch(input: string, expected: string): boolean {
  const actual = createHash('sha256').update(input).digest()
  const stored = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actual, stored)
}

function sign(expiry: number, password: string): string {
  const payload = String(expiry)
  const signature = createHmac('sha256', password).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }

  return undefined
}

export function isAdminRequest(req: Request, password: string): boolean {
  const token = readCookie(req.header('cookie'), COOKIE_NAME)
  if (!token) {
    return false
  }

  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return false
  }

  const expiry = Number(payload)
  if (!Number.isFinite(expiry) || expiry < Date.now()) {
    return false
  }

  const expected = createHmac('sha256', password).update(payload).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function setAdminCookie(res: Response, password: string, secure: boolean): void {
  const token = sign(Date.now() + MAX_AGE_SECONDS * 1000, password)
  const secureFlag = secure ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}${secureFlag}`,
  )
}

export function clearAdminCookie(res: Response, secure: boolean): void {
  const secureFlag = secure ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`)
}
