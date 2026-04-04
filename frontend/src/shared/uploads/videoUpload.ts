export type PreparedVideoUploadMode = 'transcoded' | 'direct-mp4';

export type PreparedVideoUpload = {
  file: File;
  durationSeconds?: number;
  width?: number;
  height?: number;
  transcoded: boolean;
  shareReady: boolean;
  uploadMode: PreparedVideoUploadMode;
};

type VideoPreparationStatus =
  | { stage: 'reading-metadata'; message: string }
  | { stage: 'loading-engine'; message: string }
  | { stage: 'transcoding'; message: string; progress?: number }
  | { stage: 'ready'; message: string; transcoded: boolean }
  | { stage: 'fallback'; message: string };

type PrepareVideoOptions = {
  onStatusChange?: (status: VideoPreparationStatus) => void;
};

const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_BROWSER_TRANSCODE_BYTES = 80 * 1024 * 1024;
const MAX_BROWSER_TRANSCODE_SECONDS = 180;
const SHARE_READY_MAX_EDGE = 1920;
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;
const FFMPEG_CORE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const FFMPEG_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
const FFMPEG_UTIL_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';

type FfmpegInstance = {
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
  load(options: { coreURL: string; wasmURL: string }): Promise<boolean | void>;
  writeFile(name: string, data: Uint8Array): Promise<boolean | void>;
  exec(args: string[], timeoutMs?: number): Promise<number>;
  readFile(name: string): Promise<string | Uint8Array | ArrayBuffer>;
  deleteFile(name: string): Promise<boolean | void>;
};

type FfmpegRuntime = {
  FFmpeg: new () => FfmpegInstance;
  fetchFile: (file?: string | Blob | File) => Promise<Uint8Array>;
  toBlobURL: (url: string, mimeType: string) => Promise<string>;
};

let ffmpegRuntimePromise: Promise<FfmpegRuntime> | null = null;
let ffmpegSingleton: FfmpegInstance | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;

function resolveFfmpegModuleSpecifiers() {
  const testOverride = (globalThis as typeof globalThis & { __FFMPEG_USE_MOCK_MODULES__?: boolean }).__FFMPEG_USE_MOCK_MODULES__;
  if (testOverride) {
    return {
      ffmpeg: '@ffmpeg/ffmpeg',
      util: '@ffmpeg/util',
    };
  }

  return {
    ffmpeg: FFMPEG_MODULE_URL,
    util: FFMPEG_UTIL_URL,
  };
}

async function loadFfmpegRuntime(): Promise<FfmpegRuntime> {
  if (!ffmpegRuntimePromise) {
    const specifiers = resolveFfmpegModuleSpecifiers();
    ffmpegRuntimePromise = Promise.all([
      import(/* @vite-ignore */ specifiers.ffmpeg),
      import(/* @vite-ignore */ specifiers.util),
    ]).then(([ffmpegModule, utilModule]) => ({
      FFmpeg: ffmpegModule.FFmpeg,
      fetchFile: utilModule.fetchFile,
      toBlobURL: utilModule.toBlobURL,
    }));
  }

  return ffmpegRuntimePromise!;
}

function isShareReadyMp4(file: File, metadata: { width?: number; height?: number }) {
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const maxEdge = Math.max(Number(metadata.width || 0), Number(metadata.height || 0));
  const looksLikeMp4 = mime === 'video/mp4' || name.endsWith('.mp4');
  const withinEdge = maxEdge === 0 || maxEdge <= SHARE_READY_MAX_EDGE;
  return looksLikeMp4 && withinEdge;
}

function sanitizeBaseName(fileName: string) {
  return (fileName.replace(/\.[^.]+$/, '') || 'video')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'video';
}

function readVideoMetadata(file: File) {
  return new Promise<{ durationSeconds?: number; width?: number; height?: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
        width: Number.isFinite(video.videoWidth) ? video.videoWidth : undefined,
        height: Number.isFinite(video.videoHeight) ? video.videoHeight : undefined,
      });
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể đọc metadata video.'));
    };
    video.src = objectUrl;
  });
}

async function getFfmpeg(onStatusChange?: (status: VideoPreparationStatus) => void) {
  const runtime = await loadFfmpegRuntime();
  if (!ffmpegSingleton) {
    ffmpegSingleton = new runtime.FFmpeg();
  }
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onStatusChange?.({ stage: 'loading-engine', message: 'Đang tải engine nén video (~31MB) lần đầu...' });
      await ffmpegSingleton!.load({
        coreURL: await runtime.toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await runtime.toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    })().catch((error) => {
      ffmpegLoadPromise = null;
      throw error;
    });
  }
  await ffmpegLoadPromise;
  return ffmpegSingleton;
}

async function transcodeToMp4(
  file: File,
  onStatusChange?: (status: VideoPreparationStatus) => void,
) {
  const ffmpeg = await getFfmpeg(onStatusChange);
  const { fetchFile } = await loadFfmpegRuntime();
  const inputExt = (file.name.split('.').pop() || 'input').toLowerCase();
  const inputName = `input.${inputExt}`;
  const outputName = 'output.mp4';
  const progressHandler = ({ progress }: { progress: number }) => {
    onStatusChange?.({
      stage: 'transcoding',
      message: `Đang chuẩn hoá video ${(progress * 100).toFixed(0)}%...`,
      progress,
    });
  };

  ffmpeg.on('progress', progressHandler);
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const scaleFilter = 'scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2';
    const exitCode = await ffmpeg.exec([
      '-i',
      inputName,
      '-vf',
      scaleFilter,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '30',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-ar',
      '48000',
      outputName,
    ], FFMPEG_TIMEOUT_MS);

    if (exitCode !== 0) {
      throw new Error('ffmpeg.wasm không thể chuyển đổi video này.');
    }

    const output = await ffmpeg.readFile(outputName);
    const outputBuffer =
      typeof output === 'string'
        ? (new TextEncoder().encode(output).buffer.slice(0) as ArrayBuffer)
        : output instanceof Uint8Array
        ? (output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer)
        : output;
    const blob = new Blob([outputBuffer], { type: 'video/mp4' });
    return new File([blob], `${sanitizeBaseName(file.name)}.mp4`, { type: 'video/mp4', lastModified: Date.now() });
  } finally {
    ffmpeg.off('progress', progressHandler);
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ]);
  }
}

export async function prepareVideoForUpload(file: File, options: PrepareVideoOptions = {}): Promise<PreparedVideoUpload> {
  const { onStatusChange } = options;

  if (!String(file.type || '').startsWith('video/')) {
    throw new Error('File đã chọn không phải video hợp lệ.');
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    throw new Error('Video vượt quá 200MB. Vui lòng giảm dung lượng trước khi tải lên.');
  }

  onStatusChange?.({ stage: 'reading-metadata', message: 'Đang đọc thông tin video...' });
  const metadata = await readVideoMetadata(file).catch((): { durationSeconds?: number; width?: number; height?: number } => ({}));
  const shareReady = isShareReadyMp4(file, metadata);

  if (shareReady && file.size <= 12 * 1024 * 1024) {
    onStatusChange?.({ stage: 'ready', message: 'Video đã đủ nhẹ và đúng định dạng để upload trực tiếp.', transcoded: false });
    return {
      file,
      durationSeconds: metadata.durationSeconds,
      width: metadata.width,
      height: metadata.height,
      transcoded: false,
      shareReady: true,
      uploadMode: 'direct-mp4',
    };
  }

  const canTranscodeInBrowser = file.size <= MAX_BROWSER_TRANSCODE_BYTES && (metadata.durationSeconds || 0) <= MAX_BROWSER_TRANSCODE_SECONDS;
  if (!canTranscodeInBrowser) {
    onStatusChange?.({
      stage: 'fallback',
      message: 'Video quá nặng cho trình duyệt xử lý tự động. Hãy ưu tiên MP4 sẵn hoặc cắt ngắn clip trước khi upload.',
    });
    return {
      file,
      durationSeconds: metadata.durationSeconds,
      width: metadata.width,
      height: metadata.height,
      transcoded: false,
      shareReady,
      uploadMode: 'direct-mp4',
    };
  }

  const transcodedFile = await transcodeToMp4(file, onStatusChange);
  const transcodedMetadata = await readVideoMetadata(transcodedFile).catch(() => metadata);
  onStatusChange?.({ stage: 'ready', message: 'Video đã được chuẩn hoá về MP4 để upload.', transcoded: true });

  return {
    file: transcodedFile,
    durationSeconds: transcodedMetadata.durationSeconds,
    width: transcodedMetadata.width,
    height: transcodedMetadata.height,
    transcoded: true,
    shareReady: true,
    uploadMode: 'transcoded',
  };
}
