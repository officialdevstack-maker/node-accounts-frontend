export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

const SIZE = 256

/** Center-crops the image and exports a 256×256 JPEG. */
export async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    if (side <= 0) throw new Error('That image could not be processed.')

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not process that image.')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, SIZE, SIZE)
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    )

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
        'image/jpeg',
        0.9,
      ),
    )
  } finally {
    bitmap.close()
  }
}
