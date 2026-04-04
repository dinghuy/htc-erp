import { describe, expect, it } from 'vitest';
import {
  getDocumentAssetMetaLabel,
  getImageAssetMetaLabel,
  getProductMediaCollections,
  getVideoAssetMetaLabel,
} from './productMedia';

describe('getProductMediaCollections', () => {
  it('parses direct stringified collections returned by the API', () => {
    const product = {
      productImages: JSON.stringify([
        { id: 'img-1', title: 'Hero image', url: '/uploads/products/demo/images/hero.webp' },
      ]),
      productVideos: '[]',
      productDocuments: '',
    };

    const collections = getProductMediaCollections(product);

    expect(collections.images).toEqual([
      { id: 'img-1', title: 'Hero image', url: '/uploads/products/demo/images/hero.webp' },
    ]);
    expect(collections.videos).toEqual([]);
    expect(collections.documents).toEqual([]);
  });

  it('falls back to legacy media buckets when direct product collections are absent', () => {
    const product = {
      media: {
        images: [{ id: 'img-legacy', title: 'Legacy image', url: '/legacy/image.webp' }],
        videos: JSON.stringify([{ id: 'video-legacy', title: 'Legacy video', url: '/legacy/video.mp4' }]),
        documents: [{ id: 'doc-legacy', title: 'Legacy document', url: '/legacy/doc.pdf' }],
      },
    };

    const collections = getProductMediaCollections(product);

    expect(collections.images).toEqual([{ id: 'img-legacy', title: 'Legacy image', url: '/legacy/image.webp' }]);
    expect(collections.videos).toEqual([{ id: 'video-legacy', title: 'Legacy video', url: '/legacy/video.mp4' }]);
    expect(collections.documents).toEqual([{ id: 'doc-legacy', title: 'Legacy document', url: '/legacy/doc.pdf' }]);
  });

  it('formats a readable label for URL-based image assets', () => {
    expect(
      getImageAssetMetaLabel({
        sourceType: 'url',
        url: 'https://picsum.photos/seed/qa-flow/800/800',
      }),
    ).toBe('Liên kết picsum.photos');
  });

  it('formats readable labels for URL-based video and document assets', () => {
    expect(
      getVideoAssetMetaLabel({
        sourceType: 'url',
        url: 'https://cdn.example.com/demo/product-video.mp4',
      }),
    ).toBe('Liên kết cdn.example.com');

    expect(
      getDocumentAssetMetaLabel({
        sourceType: 'url',
        url: 'https://files.example.com/specs/datasheet.pdf',
      }),
    ).toBe('Liên kết files.example.com');
  });
});
