export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

export function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể mở ảnh để crop.'));
    image.src = src;
  });
}

export async function createSquareCroppedImage(
  sourceUrl: string,
  crop: { zoom: number; offsetX: number; offsetY: number },
  outputType = 'image/jpeg',
  outputSize = 1200,
) {
  const image = await loadImageElement(sourceUrl);
  const cropSize = 320;
  const baseScale = Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight);
  const displayScale = baseScale * crop.zoom;
  const displayWidth = image.naturalWidth * displayScale;
  const displayHeight = image.naturalHeight * displayScale;
  const maxOffsetX = Math.max(0, (displayWidth - cropSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - cropSize) / 2);
  const offsetX = clamp(crop.offsetX, -maxOffsetX, maxOffsetX);
  const offsetY = clamp(crop.offsetY, -maxOffsetY, maxOffsetY);
  const left = (cropSize - displayWidth) / 2 + offsetX;
  const top = (cropSize - displayHeight) / 2 + offsetY;
  const sourceX = Math.max(0, -left / displayScale);
  const sourceY = Math.max(0, -top / displayScale);
  const sourceSize = cropSize / displayScale;

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không thể khởi tạo canvas crop.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Không thể tạo ảnh crop.'));
        return;
      }
      resolve(blob);
    }, outputType, outputType === 'image/jpeg' ? 0.92 : undefined);
  });
}
