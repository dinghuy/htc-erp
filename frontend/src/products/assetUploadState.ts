type AssetWithId = {
  id?: string;
};

type ImageAsset = AssetWithId & {
  isPrimary?: boolean;
};

function replaceAssetById<T extends AssetWithId>(items: T[], assetId: string | undefined, nextItem: T) {
  if (!assetId) return [...items, nextItem];
  const replaceIndex = items.findIndex((item) => item.id === assetId);
  if (replaceIndex < 0) return [...items, nextItem];
  return items.map((item, index) => (index === replaceIndex ? nextItem : item));
}

function normalizePrimaryImageAssets<T extends ImageAsset>(images: T[]) {
  let primaryAssigned = false;
  const normalized = images.map((image) => {
    const nextIsPrimary = Boolean(image.isPrimary) && !primaryAssigned;
    if (nextIsPrimary) primaryAssigned = true;
    return { ...image, isPrimary: nextIsPrimary };
  });

  if (!normalized.length) return normalized;

  const primaryIndex = normalized.findIndex((image) => image.isPrimary);
  if (primaryIndex > 0) {
    const [primaryImage] = normalized.splice(primaryIndex, 1);
    normalized.unshift(primaryImage);
  }

  return normalized;
}

function markPrimaryImage<T extends ImageAsset>(images: T[], imageId?: string) {
  return normalizePrimaryImageAssets(
    images.map((image, index) => ({
      ...image,
      isPrimary: imageId ? image.id === imageId : index === 0,
    })),
  );
}

export function integrateUploadedImageAsset<T extends ImageAsset>(
  currentItems: T[],
  uploadedItem: T,
  options?: { isPrimary?: boolean; replaceAssetId?: string },
) {
  const imageItems = replaceAssetById(currentItems, options?.replaceAssetId, uploadedItem);
  return options?.isPrimary
    ? markPrimaryImage(imageItems, uploadedItem.id)
    : normalizePrimaryImageAssets(imageItems);
}

export function integrateUploadedAsset<T extends AssetWithId>(
  currentItems: T[],
  uploadedItem: T,
  replaceAssetId?: string,
) {
  return replaceAssetById(currentItems, replaceAssetId, uploadedItem);
}
