type CompressionProfile = 'avatar' | 'product-image';

type CompressedImageResult = {
  file: File;
  preservedTransparency: boolean;
  transformed: boolean;
};

const PROFILE_CONFIG: Record<CompressionProfile, { maxDimension: number; quality: number; minBytesToRecompress: number }> = {
  avatar: {
    maxDimension: 1024,
    quality: 0.82,
    minBytesToRecompress: 180 * 1024,
  },
  'product-image': {
    maxDimension: 1600,
    quality: 0.8,
    minBytesToRecompress: 320 * 1024,
  },
};

function renameFileExtension(name: string, nextExtension: string) {
  const normalizedExtension = nextExtension.startsWith('.') ? nextExtension : `.${nextExtension}`;
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return `${name}${normalizedExtension}`;
  return `${name.slice(0, dotIndex)}${normalizedExtension}`;
}

async function loadImageElement(file: File) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Không thể đọc ảnh upload'));
      element.src = imageUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function detectTransparentPixels(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) return true;
  }
  return false;
}

export async function compressImageForUpload(
  file: File,
  profile: CompressionProfile,
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    return { file, preservedTransparency: false, transformed: false };
  }

  const config = PROFILE_CONFIG[profile];
  const image = await loadImageElement(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    return { file, preservedTransparency: false, transformed: false };
  }

  const resizeRatio = Math.min(1, config.maxDimension / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * resizeRatio));
  const targetHeight = Math.max(1, Math.round(sourceHeight * resizeRatio));

  const analysisCanvas = document.createElement('canvas');
  const analysisScale = Math.min(1, 128 / Math.max(sourceWidth, sourceHeight));
  analysisCanvas.width = Math.max(1, Math.round(sourceWidth * analysisScale));
  analysisCanvas.height = Math.max(1, Math.round(sourceHeight * analysisScale));
  const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
  if (!analysisContext) {
    return { file, preservedTransparency: false, transformed: false };
  }

  analysisContext.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const preservedTransparency = file.type === 'image/png' && detectTransparentPixels(analysisContext, analysisCanvas.width, analysisCanvas.height);

  const shouldResize = targetWidth !== sourceWidth || targetHeight !== sourceHeight;
  const shouldRecompress = file.size >= config.minBytesToRecompress;
  const targetMimeType = preservedTransparency ? 'image/png' : 'image/jpeg';

  if (!shouldResize && !shouldRecompress && file.type === targetMimeType) {
    return { file, preservedTransparency, transformed: false };
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) {
    return { file, preservedTransparency, transformed: false };
  }

  outputContext.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputMimeType = preservedTransparency ? 'image/png' : 'image/jpeg';

  const blob = await new Promise<Blob | null>((resolve) => {
    outputCanvas.toBlob(resolve, outputMimeType, preservedTransparency ? undefined : config.quality);
  });

  if (!blob || blob.size <= 0) {
    return { file, preservedTransparency, transformed: false };
  }

  const nextFileName = preservedTransparency
    ? renameFileExtension(file.name, '.png')
    : renameFileExtension(file.name, '.jpg');

  const nextFile = new File([blob], nextFileName, {
    type: blob.type || outputMimeType,
    lastModified: file.lastModified,
  });

  if (nextFile.size >= file.size && !shouldResize && file.type === nextFile.type) {
    return { file, preservedTransparency, transformed: false };
  }

  return { file: nextFile, preservedTransparency, transformed: true };
}
