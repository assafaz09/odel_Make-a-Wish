export const MAX_DRAWING_BYTES = 4 * 1024 * 1024

export const DRAWING_REJECTED = 'אפשר לצרף תמונת JPG, PNG או WebP עד 4MB.'

export type DrawingMime = 'image/jpeg' | 'image/png' | 'image/webp'

export type DrawingFile = {
  name: string
  mime: DrawingMime
  data: string
}

export function drawingSrc(file: DrawingFile): string {
  return `data:${file.mime};base64,${file.data}`
}

export function sniffDrawingMime(bytes: Uint8Array): DrawingMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x2000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export async function readDrawingFile(file: File): Promise<DrawingFile | null> {
  if (file.size <= 0 || file.size > MAX_DRAWING_BYTES) {
    return null
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = sniffDrawingMime(bytes)
  if (!mime) {
    return null
  }

  return {
    name: file.name.replace(/[^\w.\- ()\u0590-\u05FF]/g, '').slice(0, 120) || 'drawing',
    mime,
    data: bytesToBase64(bytes),
  }
}
