import { getDb } from '../../../sqlite-db';

export type ProductAssetKind = 'image' | 'video' | 'document';

export type ProductPersistenceRecord = {
  id: string;
  sku: unknown;
  name: unknown;
  category: unknown;
  unit: unknown;
  basePrice: unknown;
  currency: unknown;
  specifications: string;
  technicalSpecs: unknown;
  media: string;
  productImages: string;
  productVideos: string;
  productDocuments: string;
  qbuData: string | null;
  qbuUpdatedAt: string | null;
  qbuRateSource: string | null;
  qbuRateDate: string | null;
  qbuRateValue: number | null;
  status: unknown;
};

function getAssetField(kind: ProductAssetKind) {
  if (kind === 'image') return 'productImages';
  if (kind === 'video') return 'productVideos';
  return 'productDocuments';
}

export function createProductRepository() {
  return {
    listProducts(category?: unknown) {
      const db = getDb();
      return category
        ? db.all('SELECT * FROM Product WHERE category = ? ORDER BY name', [category])
        : db.all('SELECT * FROM Product ORDER BY name');
    },

    findProductById(id: string) {
      return getDb().get('SELECT * FROM Product WHERE id = ?', [id]);
    },

    findProductQbuStateById(id: string) {
      return getDb().get(
        'SELECT qbuData, qbuUpdatedAt, qbuRateSource, qbuRateDate, qbuRateValue FROM Product WHERE id = ?',
        [id],
      );
    },

    findPreviewProductBySku(sku: string) {
      return getDb().get(
        'SELECT id, name, category, unit, basePrice, technicalSpecs, status, media, productImages, productVideos, productDocuments, qbuData FROM Product WHERE sku = ?',
        [sku],
      );
    },

    findImportProductBySku(sku: string) {
      return getDb().get(
        'SELECT id, media, productImages, productVideos, productDocuments FROM Product WHERE sku = ?',
        [sku],
      );
    },

    insertProduct(record: ProductPersistenceRecord) {
      return getDb().run(
        `INSERT INTO Product (
          id, sku, name, category, unit, basePrice, currency, specifications, technicalSpecs, media, productImages, productVideos, productDocuments, qbuData, qbuUpdatedAt, qbuRateSource, qbuRateDate, qbuRateValue, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.sku,
          record.name,
          record.category,
          record.unit,
          record.basePrice,
          record.currency,
          record.specifications,
          record.technicalSpecs,
          record.media,
          record.productImages,
          record.productVideos,
          record.productDocuments,
          record.qbuData,
          record.qbuUpdatedAt,
          record.qbuRateSource,
          record.qbuRateDate,
          record.qbuRateValue,
          record.status,
        ],
      );
    },

    updateProductById(id: string, record: Omit<ProductPersistenceRecord, 'id'>) {
      return getDb().run(
        `UPDATE Product
         SET sku=?, name=?, category=?, unit=?, basePrice=?, currency=?, specifications=?, technicalSpecs=?, media=?, productImages=?, productVideos=?, productDocuments=?, qbuData=?, qbuUpdatedAt=?, qbuRateSource=?, qbuRateDate=?, qbuRateValue=?, status=?
         WHERE id=?`,
        [
          record.sku,
          record.name,
          record.category,
          record.unit,
          record.basePrice,
          record.currency,
          record.specifications,
          record.technicalSpecs,
          record.media,
          record.productImages,
          record.productVideos,
          record.productDocuments,
          record.qbuData,
          record.qbuUpdatedAt,
          record.qbuRateSource,
          record.qbuRateDate,
          record.qbuRateValue,
          record.status,
          id,
        ],
      );
    },

    updateProductAssetsByKind(productId: string, kind: ProductAssetKind, assetsJson: string) {
      const field = getAssetField(kind);
      return getDb().run(`UPDATE Product SET ${field} = ? WHERE id = ?`, [assetsJson, productId]);
    },

    deleteProductById(id: string) {
      return getDb().run('DELETE FROM Product WHERE id = ?', [id]);
    },
  };
}

export const productRepository = createProductRepository();
