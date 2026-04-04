import { describe, expect, it } from 'vitest';
import {
  integrateUploadedAsset,
  integrateUploadedImageAsset,
} from './assetUploadState';

type TestImageAsset = {
  id: string;
  title: string;
  isPrimary?: boolean;
};

describe('asset upload state integration', () => {
  it('accumulates sequentially uploaded images instead of replacing the previous result', () => {
    const firstImage = integrateUploadedImageAsset<TestImageAsset>([], {
      id: 'img-1',
      title: 'Front',
      isPrimary: true,
    });
    const nextImages = integrateUploadedImageAsset<TestImageAsset>(firstImage, {
      id: 'img-2',
      title: 'Back',
    });

    expect(nextImages).toEqual([
      { id: 'img-1', title: 'Front', isPrimary: true },
      { id: 'img-2', title: 'Back', isPrimary: false },
    ]);
  });

  it('promotes a replacement upload to primary when requested', () => {
    const nextImages = integrateUploadedImageAsset<TestImageAsset>(
      [
        { id: 'img-1', title: 'Front', isPrimary: true },
        { id: 'img-2', title: 'Back', isPrimary: false },
      ],
      { id: 'img-3', title: 'Hero replacement' },
      { replaceAssetId: 'img-2', isPrimary: true },
    );

    expect(nextImages).toEqual([
      { id: 'img-3', title: 'Hero replacement', isPrimary: true },
      { id: 'img-1', title: 'Front', isPrimary: false },
    ]);
  });

  it('replaces non-image assets by id without dropping unrelated items', () => {
    const nextAssets = integrateUploadedAsset(
      [
        { id: 'doc-1', title: 'Guide', url: '/guide.pdf' },
        { id: 'doc-2', title: 'Spec', url: '/spec.pdf' },
      ],
      { id: 'doc-3', title: 'Updated spec', url: '/spec-v2.pdf' },
      'doc-2',
    );

    expect(nextAssets).toEqual([
      { id: 'doc-1', title: 'Guide', url: '/guide.pdf' },
      { id: 'doc-3', title: 'Updated spec', url: '/spec-v2.pdf' },
    ]);
  });
});
