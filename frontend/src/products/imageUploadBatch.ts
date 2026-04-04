export const IMAGE_UPLOAD_PREVIEW_FRAME = {
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'cover',
  display: 'block',
} as const;

const IMAGE_PREVIEW_VISIBLE_LIMIT = 4;
const IMAGE_FILE_NAME_PATTERN = /\.(png|jpe?g|webp|avif|heic|heif|gif|bmp)$/i;

function isImageFile(file: File) {
  return file.type.startsWith('image/') || IMAGE_FILE_NAME_PATTERN.test(file.name);
}

export function buildImageUploadPreviewQueue(files: ArrayLike<File> | readonly File[] | null | undefined) {
  const normalizedFiles = Array.from(files ?? []).filter(isImageFile);

  return {
    files: normalizedFiles,
    visibleCount: Math.min(normalizedFiles.length, IMAGE_PREVIEW_VISIBLE_LIMIT),
    overflowCount: Math.max(normalizedFiles.length - IMAGE_PREVIEW_VISIBLE_LIMIT, 0),
  };
}
