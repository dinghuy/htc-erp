import { v4 as uuidv4 } from 'uuid';
import { buildQbuSnapshotState, normalizeProductAssetArray } from './persistence';
import { createProductRepository, type ProductAssetKind } from './repository';

type CreateProductServiceDeps = {
  repository?: ReturnType<typeof createProductRepository>;
  parseJsonObject: <T extends Record<string, any> | null>(raw: unknown, fallback: T) => T;
  stringifyNormalizedJson: (value: unknown) => string;
  getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => Promise<any>;
};

type UpdateProductResult =
  | { notFound: true }
  | { invalidQbuData: true }
  | { row: any };

function getSerializedAssetField(kind: ProductAssetKind) {
  if (kind === 'image') return 'productImages';
  if (kind === 'video') return 'productVideos';
  return 'productDocuments';
}

export function createProductService(deps: CreateProductServiceDeps) {
  const repository = deps.repository ?? createProductRepository();
  const { parseJsonObject, stringifyNormalizedJson, getLatestExchangeRatePayload } = deps;

  return {
    listProducts(category?: unknown) {
      return repository.listProducts(category);
    },

    getProductById(id: string) {
      return repository.findProductById(id);
    },

    async createProduct(input: Record<string, any>) {
      const id = uuidv4();
      await repository.insertProduct({
        id,
        sku: input.sku,
        name: input.name,
        category: input.category,
        unit: input.unit ?? 'Chiếc',
        basePrice: input.basePrice,
        currency: input.currency ?? 'USD',
        specifications: JSON.stringify(input.specifications || {}),
        technicalSpecs: input.technicalSpecs || '',
        media: JSON.stringify(input.media || []),
        productImages: JSON.stringify(normalizeProductAssetArray(input.productImages, 'image')),
        productVideos: JSON.stringify(normalizeProductAssetArray(input.productVideos, 'video')),
        productDocuments: JSON.stringify(normalizeProductAssetArray(input.productDocuments, 'document')),
        qbuData: JSON.stringify(input.qbuData || {}),
        qbuUpdatedAt: input.qbuData ? new Date().toISOString() : null,
        qbuRateSource: null,
        qbuRateDate: null,
        qbuRateValue: null,
        status: input.status ?? 'available',
      });
      return repository.findProductById(id);
    },

    async updateProduct(id: string, input: Record<string, any>): Promise<UpdateProductResult> {
      const currentProduct = await repository.findProductQbuStateById(id);
      if (!currentProduct) return { notFound: true };

      const hasQbuData = Object.prototype.hasOwnProperty.call(input, 'qbuData');
      if (hasQbuData && (input.qbuData === null || typeof input.qbuData !== 'object' || Array.isArray(input.qbuData))) {
        return { invalidQbuData: true };
      }

      const currentQbuData = parseJsonObject(currentProduct?.qbuData, null);
      const nextQbuData = hasQbuData && input.qbuData && typeof input.qbuData === 'object' && !Array.isArray(input.qbuData)
        ? input.qbuData
        : currentQbuData;
      const qbuDataChanged = hasQbuData && stringifyNormalizedJson(nextQbuData) !== stringifyNormalizedJson(currentQbuData);

      let nextQbuDataStr = currentProduct?.qbuData ?? null;
      let nextQbuUpdatedAt = currentProduct?.qbuUpdatedAt ?? null;
      let nextQbuRateSource = currentProduct?.qbuRateSource ?? null;
      let nextQbuRateDate = currentProduct?.qbuRateDate ?? null;
      let nextQbuRateValue = currentProduct?.qbuRateValue ?? null;

      if (qbuDataChanged) {
        const snapshot = await buildQbuSnapshotState(nextQbuData || {}, getLatestExchangeRatePayload);
        nextQbuDataStr = snapshot.qbuDataStr;
        nextQbuUpdatedAt = snapshot.qbuUpdatedAt;
        nextQbuRateSource = snapshot.qbuRateSource;
        nextQbuRateDate = snapshot.qbuRateDate;
        nextQbuRateValue = snapshot.qbuRateValue;
      }

      await repository.updateProductById(id, {
        sku: input.sku,
        name: input.name,
        category: input.category,
        unit: input.unit,
        basePrice: input.basePrice,
        currency: input.currency,
        specifications: JSON.stringify(input.specifications || {}),
        technicalSpecs: input.technicalSpecs,
        media: JSON.stringify(input.media || []),
        productImages: JSON.stringify(normalizeProductAssetArray(input.productImages, 'image')),
        productVideos: JSON.stringify(normalizeProductAssetArray(input.productVideos, 'video')),
        productDocuments: JSON.stringify(normalizeProductAssetArray(input.productDocuments, 'document')),
        qbuData: nextQbuDataStr,
        qbuUpdatedAt: nextQbuUpdatedAt,
        qbuRateSource: nextQbuRateSource,
        qbuRateDate: nextQbuRateDate,
        qbuRateValue: nextQbuRateValue,
        status: input.status,
      });

      return { row: await repository.findProductById(id) };
    },

    async appendUploadedAsset(
      productId: string,
      kind: ProductAssetKind,
      asset: Record<string, unknown>,
      serializeProductRow: (row: any) => any,
      options?: { replaceAssetId?: string },
    ) {
      const row = await repository.findProductById(productId);
      if (!row) return null;

      const serialized = serializeProductRow(row);
      const field = getSerializedAssetField(kind);
      const currentAssets = normalizeProductAssetArray(serialized?.[field], kind);
      const replaceIndex = options?.replaceAssetId
        ? currentAssets.findIndex((entry: any) => entry?.id === options.replaceAssetId)
        : -1;
      const nextAssets = normalizeProductAssetArray(
        replaceIndex >= 0
          ? currentAssets.map((entry: any, index: number) => (index === replaceIndex ? asset : entry))
          : [...currentAssets, asset],
        kind,
      );

      await repository.updateProductAssetsByKind(productId, kind, JSON.stringify(nextAssets));

      return {
        asset,
        replacedAsset: replaceIndex >= 0 ? currentAssets[replaceIndex] : null,
      };
    },

    async removeProductAsset(
      productId: string,
      kind: ProductAssetKind,
      assetId: string,
      serializeProductRow: (row: any) => any,
    ) {
      const row = await repository.findProductById(productId);
      if (!row) return null;

      const serialized = serializeProductRow(row);
      const field = getSerializedAssetField(kind);
      const currentAssets = normalizeProductAssetArray(serialized?.[field], kind);
      const removedAsset = currentAssets.find((entry: any) => entry?.id === assetId);
      const nextAssets = normalizeProductAssetArray(currentAssets.filter((entry: any) => entry?.id !== assetId), kind);

      if (!removedAsset) {
        return { removed: false, nextAssets };
      }

      await repository.updateProductAssetsByKind(productId, kind, JSON.stringify(nextAssets));

      return { removed: true, nextAssets, removedAsset };
    },

    deleteProduct(id: string) {
      return repository.deleteProductById(id);
    },
  };
}
