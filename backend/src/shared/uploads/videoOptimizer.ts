import path from 'path';

export type OptimizedVideoResult = {
  buffer: Buffer;
  extension: string;
  mimeType: string;
  size: number;
  downloadFileName: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
};

function sanitizeBaseName(fileName: string) {
  return (path.parse(fileName).name || 'video')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'video';
}

export async function optimizeUploadedVideo(file: Express.Multer.File): Promise<OptimizedVideoResult> {
  if (!String(file.mimetype || '').startsWith('video/')) {
    throw new Error('Uploaded file is not a video');
  }

  const extension = path.extname(file.originalname || '').toLowerCase() || '.mp4';
  return {
    buffer: file.buffer,
    extension,
    mimeType: file.mimetype || 'video/mp4',
    size: file.size,
    downloadFileName: `${sanitizeBaseName(file.originalname)}${extension}`,
  };
}
