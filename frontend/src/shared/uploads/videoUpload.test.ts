import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ffmpegState = vi.hoisted(() => {
  const listeners = new Map<string, ((payload: any) => void)[]>();

  return {
    ffmpegModuleLoads: 0,
    ffmpegUtilLoads: 0,
    loadCalls: 0,
    writeCalls: [] as Array<{ name: string }>,
    execCalls: [] as Array<string[]>,
    readCalls: [] as string[],
    deleteCalls: [] as string[],
    reset() {
      this.ffmpegModuleLoads = 0;
      this.ffmpegUtilLoads = 0;
      this.loadCalls = 0;
      this.writeCalls = [];
      this.execCalls = [];
      this.readCalls = [];
      this.deleteCalls = [];
      listeners.clear();
    },
    emit(event: string, payload: any) {
      for (const handler of listeners.get(event) || []) {
        handler(payload);
      }
    },
    addListener(event: string, handler: (payload: any) => void) {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
    },
    removeListener(event: string, handler: (payload: any) => void) {
      const bucket = listeners.get(event) || [];
      listeners.set(
        event,
        bucket.filter((entry) => entry !== handler),
      );
    },
  };
});

vi.mock('@ffmpeg/ffmpeg', () => {
  ffmpegState.ffmpegModuleLoads += 1;

  class MockFFmpeg {
    on(event: string, handler: (payload: any) => void) {
      ffmpegState.addListener(event, handler);
    }

    off(event: string, handler: (payload: any) => void) {
      ffmpegState.removeListener(event, handler);
    }

    async load() {
      ffmpegState.loadCalls += 1;
    }

    async writeFile(name: string) {
      ffmpegState.writeCalls.push({ name });
    }

    async exec(args: string[]) {
      ffmpegState.execCalls.push(args);
      ffmpegState.emit('progress', { progress: 0.56 });
      return 0;
    }

    async readFile(name: string) {
      ffmpegState.readCalls.push(name);
      return new Uint8Array([1, 2, 3, 4]);
    }

    async deleteFile(name: string) {
      ffmpegState.deleteCalls.push(name);
    }
  }

  return { FFmpeg: MockFFmpeg };
});

vi.mock('@ffmpeg/util', () => ({
  ...(ffmpegState.ffmpegUtilLoads += 1, {}),
  fetchFile: vi.fn(async () => new Uint8Array([9, 8, 7])),
  toBlobURL: vi.fn(async (url: string) => url),
}));

function installVideoDomMock() {
  const documentMock = {
    createElement(tag: string) {
      if (tag !== 'video') throw new Error(`Unexpected element: ${tag}`);

      let currentSrc = '';
      return {
        preload: '',
        onloadedmetadata: null as null | (() => void),
        onerror: null as null | (() => void),
        duration: 0,
        videoWidth: 0,
        videoHeight: 0,
        set src(value: string) {
          currentSrc = value;
          const metadata = resolveMetadataFromSrc(value);
          if (!metadata) {
            this.onerror?.();
            return;
          }
          this.duration = metadata.durationSeconds;
          this.videoWidth = metadata.width;
          this.videoHeight = metadata.height;
          this.onloadedmetadata?.();
        },
        get src() {
          return currentSrc;
        },
      };
    },
  };

  const createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
  const revokeObjectURL = vi.fn();

  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('URL', {
    createObjectURL,
    revokeObjectURL,
  });
}

function resolveMetadataFromSrc(src: string) {
  if (src.includes('share-ready.mp4')) {
    return { durationSeconds: 42, width: 1280, height: 720 };
  }
  if (src.includes('heavy.mov')) {
    return { durationSeconds: 240, width: 1920, height: 1080 };
  }
  if (src.includes('promo.mov')) {
    return { durationSeconds: 45, width: 3840, height: 2160 };
  }
  if (src.includes('promo.mp4')) {
    return { durationSeconds: 45, width: 1920, height: 1080 };
  }
  return { durationSeconds: 30, width: 1280, height: 720 };
}

async function loadModule() {
  vi.resetModules();
  vi.stubGlobal('__FFMPEG_USE_MOCK_MODULES__', true);
  return import('./videoUpload');
}

describe('prepareVideoForUpload', () => {
  beforeEach(() => {
    ffmpegState.reset();
    installVideoDomMock();
    vi.stubGlobal('__FFMPEG_USE_MOCK_MODULES__', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps a small share-ready MP4 as-is', async () => {
    const { prepareVideoForUpload } = await loadModule();
    const statuses: string[] = [];
    const file = new File([new Uint8Array([1, 2, 3])], 'share-ready.mp4', { type: 'video/mp4' });

    const result = await prepareVideoForUpload(file, {
      onStatusChange: (status) => statuses.push(status.stage),
    });

    expect(result.file).toBe(file);
    expect(result.transcoded).toBe(false);
    expect(result.shareReady).toBe(true);
    expect(result.uploadMode).toBe('direct-mp4');
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(statuses).toEqual(['reading-metadata', 'ready']);
    expect(ffmpegState.ffmpegModuleLoads).toBe(0);
    expect(ffmpegState.ffmpegUtilLoads).toBe(0);
    expect(ffmpegState.loadCalls).toBe(0);
    expect(ffmpegState.execCalls).toEqual([]);
  });

  it('falls back when the browser should not transcode a heavy non-share-ready file', async () => {
    const { prepareVideoForUpload } = await loadModule();
    const statuses: string[] = [];
    const file = new File([new Uint8Array(81 * 1024 * 1024)], 'heavy.mov', { type: 'video/quicktime' });

    const result = await prepareVideoForUpload(file, {
      onStatusChange: (status) => statuses.push(status.stage),
    });

    expect(result.file).toBe(file);
    expect(result.transcoded).toBe(false);
    expect(result.shareReady).toBe(false);
    expect(result.uploadMode).toBe('direct-mp4');
    expect(statuses).toEqual(['reading-metadata', 'fallback']);
    expect(ffmpegState.loadCalls).toBe(0);
    expect(ffmpegState.execCalls).toEqual([]);
  });

  it('transcodes a short non-share-ready clip to MP4 in the browser', async () => {
    const { prepareVideoForUpload } = await loadModule();
    const statuses: string[] = [];
    const file = new File([new Uint8Array(1024)], 'promo.mov', { type: 'video/quicktime' });

    const result = await prepareVideoForUpload(file, {
      onStatusChange: (status) => statuses.push(status.stage),
    });

    expect(result.file).not.toBe(file);
    expect(result.file.name).toBe('promo.mp4');
    expect(result.file.type).toBe('video/mp4');
    expect(result.transcoded).toBe(true);
    expect(result.shareReady).toBe(true);
    expect(result.uploadMode).toBe('transcoded');
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(statuses).toEqual(['reading-metadata', 'loading-engine', 'transcoding', 'ready']);
    expect(ffmpegState.loadCalls).toBe(1);
    expect(ffmpegState.writeCalls).toEqual([{ name: 'input.mov' }]);
    expect(ffmpegState.readCalls).toEqual(['output.mp4']);
    expect(ffmpegState.deleteCalls).toEqual(expect.arrayContaining(['input.mov', 'output.mp4']));
    expect(ffmpegState.execCalls[0]).toEqual(
      expect.arrayContaining([
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        'output.mp4',
      ]),
    );
  });
});
