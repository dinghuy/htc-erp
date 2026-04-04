import path from 'path';
import { Jimp, JimpMime } from 'jimp';

type ImageOptimizationProfile = 'avatar' | 'product-image';

type OptimizedImageUpload = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  downloadFileName: string;
  size: number;
  preservedTransparency: boolean;
};

const PROFILE_CONFIG: Record<ImageOptimizationProfile, { maxDimension: number; jpegQuality: number }> = {
  avatar: { maxDimension: 1024, jpegQuality: 82 },
  'product-image': { maxDimension: 1600, jpegQuality: 80 },
};

function replaceFileExtension(fileName: string, nextExtension: string) {
  const normalizedExtension = nextExtension.startsWith('.') ? nextExtension : `.${nextExtension}`;
  const parsed = path.parse(fileName || 'image');
  return `${parsed.name || 'image'}${normalizedExtension}`;
}

function hasTransparentPixels(data: Buffer | Uint8Array) {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) return true;
  }
  return false;
}

function buildPassthroughImageUpload(file: Express.Multer.File, extension: string): OptimizedImageUpload {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return {
    buffer: Buffer.from(file.buffer),
    mimeType: String(file.mimetype || '').toLowerCase() || `image/${normalizedExtension.replace('.', '')}`,
    extension: normalizedExtension,
    downloadFileName: replaceFileExtension(file.originalname || 'image', normalizedExtension),
    size: file.buffer.length,
    preservedTransparency: false,
  };
}

export async function optimizeUploadedImage(
  file: Express.Multer.File,
  profile: ImageOptimizationProfile,
): Promise<OptimizedImageUpload> {
  if (!file?.buffer?.length) throw new Error('No image buffer provided');
  if (!String(file.mimetype || '').startsWith('image/')) throw new Error('Uploaded file is not an image');

  let image;
  try {
    image = await Jimp.read(file.buffer);
  } catch {
    const mime = String(file.mimetype || '').toLowerCase();
    const PASSTHROUGH_MIMES: Record<string, string> = {
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/heic': '.heic',
      'image/heif': '.heif',
    };
    if (mime in PASSTHROUGH_MIMES) {
      return buildPassthroughImageUpload(file, PASSTHROUGH_MIMES[mime]);
    }
    throw new Error('Invalid image payload');
  }

  const preservedTransparency =
    String(file.mimetype || '').toLowerCase() === JimpMime.png && hasTransparentPixels(image.bitmap.data);
  const { maxDimension, jpegQuality } = PROFILE_CONFIG[profile];

  if (Math.max(image.bitmap.width, image.bitmap.height) > maxDimension) {
    image.scaleToFit({ w: maxDimension, h: maxDimension });
  }

  const mimeType = preservedTransparency ? JimpMime.png : JimpMime.jpeg;
  const buffer = preservedTransparency
    ? Buffer.from(await image.getBuffer(JimpMime.png))
    : Buffer.from(await image.getBuffer(JimpMime.jpeg, { quality: jpegQuality }));
  const extension = preservedTransparency ? '.png' : '.jpg';

  return {
    buffer,
    mimeType,
    extension,
    downloadFileName: replaceFileExtension(file.originalname || 'image', extension),
    size: buffer.length,
    preservedTransparency,
  };
}
