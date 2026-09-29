/**
 * High-performance browser-side image compression and resizing utility.
 * Optimizes image dimensions (max 1568px) and quality (WebP / JPEG @ 0.82)
 * to save 80%+ of context tokens, memory, and API transmission payload.
 */

export interface CompressedImageResult {
  base64: string
  mediaType: string
  dataUrl: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
  savingsRatio: number
}

const MAX_VISION_DIMENSION = 1568 // Anthropic & OpenAI optimal vision threshold

export async function compressImage(
  source: File | Blob | string,
  maxWidth = MAX_VISION_DIMENSION,
  maxHeight = MAX_VISION_DIMENSION,
  quality = 0.82
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      let { width, height } = img

      // Scale down while preserving aspect ratio if exceeding max bounds
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get 2d canvas context for image compression'))
        return
      }

      // Smooth bicubic resampling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // Prefer image/webp if supported, fallback to image/jpeg
      let dataUrl = ''
      let mediaType = 'image/webp'
      try {
        dataUrl = canvas.toDataURL('image/webp', quality)
        if (!dataUrl.startsWith('data:image/webp')) {
          mediaType = 'image/jpeg'
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
      } catch {
        mediaType = 'image/jpeg'
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }

      const base64Data = dataUrl.split(',')[1] || ''
      const approxCompressedBytes = Math.round((base64Data.length * 3) / 4)
      const originalBytes = typeof source === 'string'
        ? Math.round((source.length * 3) / 4)
        : source.size

      const savings = originalBytes > 0
        ? Math.max(0, 1 - approxCompressedBytes / originalBytes)
        : 0

      resolve({
        base64: base64Data,
        mediaType,
        dataUrl,
        width,
        height,
        originalSize: originalBytes,
        compressedSize: approxCompressedBytes,
        savingsRatio: Math.round(savings * 100)
      })
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'))
    }

    if (typeof source === 'string') {
      img.src = source
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file as DataURL'))
      reader.readAsDataURL(source)
    }
  })
}
