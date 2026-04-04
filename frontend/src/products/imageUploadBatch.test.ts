import { describe, expect, it } from 'vitest';
import {
  buildImageUploadPreviewQueue,
  IMAGE_UPLOAD_PREVIEW_FRAME,
} from './imageUploadBatch';

describe('image upload batch helpers', () => {
  it('keeps every selected image in upload order and caps the visible preview strip', () => {
    const queue = buildImageUploadPreviewQueue([
      new File(['a'], 'front.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'side.png', { type: 'image/png' }),
      new File(['c'], 'detail.webp', { type: 'image/webp' }),
      new File(['d'], 'hero.jpg', { type: 'image/jpeg' }),
      new File(['e'], 'ignore.pdf', { type: 'application/pdf' }),
    ]);

    expect(queue.files.map((file) => file.name)).toEqual([
      'front.jpg',
      'side.png',
      'detail.webp',
      'hero.jpg',
    ]);
    expect(queue.visibleCount).toBe(4);
    expect(queue.overflowCount).toBe(0);
  });

  it('locks preview thumbnails to a square cover frame instead of natural image size', () => {
    expect(IMAGE_UPLOAD_PREVIEW_FRAME).toEqual({
      width: '100%',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      display: 'block',
    });
  });
});
