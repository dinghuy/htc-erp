import { useEffect, useRef, useState } from 'preact/hooks';
import { fetchWithAuth, loadSession } from '../auth';
import { compressImageForUpload } from '../shared/uploads/imageCompression';
import { prepareVideoForUpload, type PreparedVideoUploadMode } from '../shared/uploads/videoUpload';
import { ui } from '../ui/styles';
import { tokens } from '../ui/tokens';
import { ArrowDownIcon, ArrowUpIcon, CropIcon, PlusIcon, StarIcon, TrashIcon } from '../ui/icons';
import { integrateUploadedAsset, integrateUploadedImageAsset } from './assetUploadState';
import { buildImageUploadPreviewQueue, IMAGE_UPLOAD_PREVIEW_FRAME } from './imageUploadBatch';
import { ProductImageCropModal } from './productImageCropModal';
import { createSquareCroppedImage, readFileAsDataUrl } from './productAssetUploadUtils';
import {
  ProductDocumentPreviewCard,
  ProductImagePreviewCard,
  ProductVideoPreviewCard,
  VideoPosterPreview,
  formatAssetSize,
  formatVideoDuration,
  getDocumentBadge,
  resolveAssetUrl,
  type ProductDocumentAsset,
  type ProductImageAsset,
  type ProductVideoAsset,
} from './productAssetUi';
import {
  ensureAssetTitle,
  markPrimaryImage,
  normalizeDocumentAssets,
  normalizeImageAssets,
  normalizePrimaryImageAssets,
  normalizeVideoAssets,
} from './productAssetData';
import { EmptyAssetState } from './productDetailSections';

type UploadFeedback = {
  tone: 'info' | 'success' | 'error';
  message: string;
  stage?: 'reading-metadata' | 'loading-engine' | 'transcoding' | 'uploading' | 'fallback' | 'completed' | 'deleting';
  progress?: number;
};

type PendingImageUploadPreview = {
  key: string;
  name: string;
  url: string;
};

function VideoModeBadge({ video }: { video: ProductVideoAsset }) {
  if (video.uploadMode === 'transcoded') {
    return <span style={ui.badge.success}>Đã chuẩn hoá MP4</span>;
  }
  if (video.uploadMode === 'direct-mp4') {
    return <span style={ui.badge.info}>MP4 giữ nguyên</span>;
  }
  if (video.uploadMode === 'external-url') {
    return <span style={ui.badge.warning}>URL ngoài</span>;
  }
  return null;
}

function CompactAssetStrip({
  items,
  kind,
  apiOrigin,
}: {
  items: Array<ProductImageAsset | ProductVideoAsset | ProductDocumentAsset>;
  kind: 'image' | 'video' | 'document';
  apiOrigin: string;
}) {
  const previewItems = kind === 'image' ? normalizePrimaryImageAssets(items as ProductImageAsset[]) : items;
  if (!previewItems.length) return null;

  return (
    <div
      style={{
        display: 'grid',
        gap: '10px',
        padding: '14px',
        borderRadius: '18px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.surface.panelGradient,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
          {kind === 'image' ? 'Preview thư viện ảnh' : kind === 'video' ? 'Preview thư viện video' : 'Preview thư viện tài liệu'}
        </div>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
          {previewItems.length} {kind === 'image' ? 'asset hình ảnh' : kind === 'video' ? 'asset video' : 'asset tài liệu'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        {previewItems.slice(0, kind === 'image' ? 4 : 3).map((item, index) =>
          kind === 'image' ? (
            <ProductImagePreviewCard
              key={item.id || `${item.url}-${index}`}
              asset={item as ProductImageAsset}
              apiOrigin={apiOrigin}
            />
          ) : kind === 'video' ? (
            <ProductVideoPreviewCard
              key={item.id || `${item.url}-${index}`}
              asset={item as ProductVideoAsset}
              apiOrigin={apiOrigin}
            />
          ) : (
            <ProductDocumentPreviewCard
              key={item.id || `${item.url}-${index}`}
              asset={item as ProductDocumentAsset}
            />
          ),
        )}
      </div>
    </div>
  );
}

function AssetLinkComposer({
  label,
  titleValue,
  urlValue,
  descriptionValue,
  onTitleChange,
  onUrlChange,
  onDescriptionChange,
  onAdd,
  showDescription = false,
  urlHint,
  labelStyle,
  inputStyle,
  primaryButtonStyle,
}: any) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '18px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.surface.panelGradient,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showDescription
            ? 'repeat(auto-fit, minmax(220px, 1fr))'
            : 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={labelStyle}>{label}</label>
          <input type="text" style={inputStyle} value={titleValue} onInput={onTitleChange} placeholder="Tiêu đề hiển thị" />
        </div>
        <div>
          <label style={labelStyle}>URL</label>
          <input type="text" style={inputStyle} value={urlValue} onInput={onUrlChange} placeholder="https://..." />
        </div>
        {showDescription ? (
          <div>
            <label style={labelStyle}>Mô tả ngắn</label>
            <input type="text" style={inputStyle} value={descriptionValue} onInput={onDescriptionChange} placeholder="Brochure / Datasheet / HDSD..." />
          </div>
        ) : null}
        <button type="button" onClick={onAdd} style={{ ...primaryButtonStyle, minWidth: '124px', justifyContent: 'center' }}>
          <PlusIcon size={14} /> Thêm link
        </button>
      </div>
      {urlHint ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            border: `1px solid ${tokens.colors.warningBorder}`,
            background: tokens.colors.warningTint,
            fontSize: '11px',
            lineHeight: 1.55,
            color: tokens.colors.warning,
          }}
        >
          {urlHint}
        </div>
      ) : null}
    </div>
  );
}

export function AssetListEditor({
  title,
  subtitle,
  items,
  kind,
  onItemsChange,
  productId,
  token,
  showNotify,
  apiBase,
  apiOrigin,
  outlineButtonStyle,
  primaryButtonStyle,
  inputStyle,
  labelStyle,
}: {
  title: string;
  subtitle: string;
  items: any[];
  kind: 'image' | 'video' | 'document';
  onItemsChange: (items: any[]) => void;
  productId?: string;
  token: string;
  showNotify: (message: string, tone?: any) => void;
  apiBase: string;
  apiOrigin: string;
  outlineButtonStyle: any;
  primaryButtonStyle: any;
  inputStyle: any;
  labelStyle: any;
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [activeFileName, setActiveFileName] = useState('');
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [pendingImagePreviews, setPendingImagePreviews] = useState<PendingImageUploadPreview[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePreviewsRef = useRef<PendingImageUploadPreview[]>([]);
  const latestNormalizedItemsRef = useRef<any[]>([]);
  const resolvedToken = token || loadSession()?.token || '';
  const [cropSource, setCropSource] = useState<{
    sourceUrl: string;
    fileName: string;
    title: string;
    replaceAssetId?: string;
  } | null>(null);
  const normalizedItems = kind === 'image'
    ? normalizeImageAssets(items)
    : kind === 'video'
      ? normalizeVideoAssets(items)
      : normalizeDocumentAssets(items);

  const API = apiBase;
  const API_ORIGIN = apiOrigin;
  const S = {
    btnPrimary: primaryButtonStyle,
    btnOutline: outlineButtonStyle,
    input: inputStyle,
    label: labelStyle,
  };

  useEffect(() => {
    latestNormalizedItemsRef.current = normalizedItems;
  }, [normalizedItems]);

  const clearPendingImagePreviews = () => {
    pendingImagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    pendingImagePreviewsRef.current = [];
    setPendingImagePreviews([]);
  };

  const publishPendingImagePreviews = (previews: PendingImageUploadPreview[]) => {
    clearPendingImagePreviews();
    pendingImagePreviewsRef.current = previews;
    setPendingImagePreviews(previews);
  };

  useEffect(() => () => {
    pendingImagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    pendingImagePreviewsRef.current = [];
  }, []);

  const addUrlAsset = () => {
    if (!draftUrl.trim()) {
      showNotify('Thiếu URL asset', 'error');
      return;
    }

    const base = {
      id: `${kind}-${Date.now()}`,
      title: ensureAssetTitle(draftTitle, draftUrl, kind === 'image' ? 'Image asset' : kind === 'video' ? 'Video asset' : 'Document asset'),
      url: draftUrl.trim(),
      sourceType: 'url' as const,
    };

    const nextAsset = kind === 'image'
      ? { ...base, alt: ensureAssetTitle(draftTitle, draftUrl, 'Image asset'), isPrimary: false }
      : kind === 'video'
        ? { ...base, description: draftDescription.trim() || undefined, uploadMode: 'external-url' as const }
        : { ...base, description: draftDescription.trim() || undefined };

    if (kind === 'image') {
      onItemsChange(normalizePrimaryImageAssets([...(normalizedItems as ProductImageAsset[]), nextAsset]));
    } else {
      onItemsChange([...items, nextAsset]);
    }
    setDraftTitle('');
    setDraftUrl('');
    setDraftDescription('');
  };

  const updateItem = (index: number, patch: Record<string, any>) => {
    onItemsChange(normalizedItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeItem = async (index: number) => {
    const targetItem = normalizedItems[index];
    if (!targetItem) return;

    if (productId && resolvedToken && targetItem.id && targetItem.sourceType === 'upload') {
      setBusyAssetId(String(targetItem.id));
      setUploadFeedback({ tone: 'info', stage: 'deleting', message: `Đang gỡ ${targetItem.title || 'asset'} khỏi sản phẩm...` });
      try {
        const res = await fetchWithAuth(resolvedToken, `${API}/products/${productId}/assets/${kind}/${targetItem.id}`, {
          method: 'DELETE',
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Không thể xóa asset');
      } catch (error: any) {
        const message = error?.message || 'Không thể xóa asset';
        setUploadFeedback({ tone: 'error', message, stage: 'deleting' });
        showNotify(message, 'error');
        setBusyAssetId(null);
        return;
      }
    }

    onItemsChange(normalizedItems.filter((_, itemIndex) => itemIndex !== index));
    setBusyAssetId(null);
    setUploadFeedback({
      tone: 'success',
      message: targetItem.sourceType === 'upload'
        ? `${kind === 'image' ? 'Hình ảnh' : kind === 'video' ? 'Video' : 'Tài liệu'} đã được gỡ khỏi sản phẩm và dọn file lưu trữ.`
        : `${kind === 'image' ? 'Hình ảnh' : kind === 'video' ? 'Video' : 'Tài liệu'} đã được bỏ khỏi biểu mẫu. Nhấn lưu để ghi nhận thay đổi.`,
    });
  };

  const setPrimaryImageLocally = (imageId?: string) => {
    if (kind !== 'image') return;
    onItemsChange(markPrimaryImage(normalizedItems as ProductImageAsset[], imageId));
  };

  const moveImageItem = (index: number, direction: -1 | 1) => {
    if (kind !== 'image') return;
    const imageItems = normalizePrimaryImageAssets(normalizedItems as ProductImageAsset[]);
    const targetIndex = index + direction;
    const firstGalleryIndex = imageItems[0]?.isPrimary ? 1 : 0;
    if (index < 0 || targetIndex < firstGalleryIndex || targetIndex >= imageItems.length) return;
    const nextItems = [...imageItems];
    const [movedItem] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, movedItem);
    onItemsChange(normalizePrimaryImageAssets(nextItems));
  };

  const uploadFile = async (file: File, options?: { isPrimary?: boolean; replaceAssetId?: string }) => {
    if (!productId) {
      setUploadFeedback({ tone: 'error', message: 'Tạo sản phẩm trước để dùng upload trực tiếp.' });
      showNotify('Lưu sản phẩm trước rồi mới upload file trực tiếp.', 'error');
      return;
    }
    if (!resolvedToken) {
      setUploadFeedback({ tone: 'error', message: 'Phiên đăng nhập đã hết. Vui lòng tải lại trang rồi thử lại.' });
      showNotify('Phiên đăng nhập đã hết. Vui lòng tải lại trang rồi thử lại.', 'error');
      return;
    }
    setActiveFileName(file.name);
    setUploading(true);
    setUploadFeedback({ tone: 'info', stage: 'uploading', message: `Đang chuẩn bị ${file.name}...` });
    try {
      let preparedFile = file;
      let videoMetadata: { durationSeconds?: number; width?: number; height?: number } | null = null;
      let videoUploadMode: PreparedVideoUploadMode | null = null;
      if (kind === 'image') {
        try {
          const result = await compressImageForUpload(file, 'product-image');
          preparedFile = result.file;
        } catch {
          preparedFile = file;
        }
      } else if (kind === 'video') {
        const result = await prepareVideoForUpload(file, {
          onStatusChange: (status) => {
            const message = status.message || 'Đang chuẩn bị video...';
            setUploadFeedback({
              tone: status.stage === 'fallback' ? 'error' : 'info',
              stage: status.stage === 'ready' ? 'completed' : status.stage,
              message,
              progress: 'progress' in status ? (status as any).progress : undefined,
            });
          },
        });
        preparedFile = result.file;
        videoMetadata = {
          durationSeconds: result.durationSeconds,
          width: result.width,
          height: result.height,
        };
        videoUploadMode = result.uploadMode;
        if (!result.shareReady) {
          throw new Error('Video chưa ở trạng thái share-ready. Hãy đổi sang MP4 nhẹ hơn hoặc cắt ngắn clip rồi thử lại.');
        }
      }
      setUploadFeedback({
        tone: 'info',
        stage: 'uploading',
        message: `Đang gửi ${preparedFile.name} lên máy chủ...`,
      });
      const formData = new FormData();
      formData.append('file', preparedFile);
      if (draftTitle.trim()) formData.append('title', draftTitle.trim());
      if (kind === 'image' && options?.isPrimary) formData.append('isPrimary', 'true');
      if (options?.replaceAssetId) formData.append('replaceAssetId', options.replaceAssetId);
      if (kind !== 'image' && draftDescription.trim()) formData.append('description', draftDescription.trim());
      if (kind === 'video' && videoMetadata) {
        if (videoMetadata.durationSeconds) formData.append('durationSeconds', String(videoMetadata.durationSeconds));
        if (videoMetadata.width) formData.append('width', String(videoMetadata.width));
        if (videoMetadata.height) formData.append('height', String(videoMetadata.height));
      }

      const res = await fetchWithAuth(resolvedToken, `${API}/products/${productId}/${kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'documents'}`, {
        method: 'POST',
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Upload thất bại');

      if (kind === 'image') {
        const nextImages = integrateUploadedImageAsset(
          latestNormalizedItemsRef.current as ProductImageAsset[],
          payload as ProductImageAsset,
          options,
        );
        onItemsChange(nextImages);
      } else {
        const nextVideoPayload = kind === 'video'
          ? { ...payload, uploadMode: videoUploadMode || 'direct-mp4' }
          : payload;
        onItemsChange(
          integrateUploadedAsset(
            latestNormalizedItemsRef.current as typeof nextVideoPayload[],
            nextVideoPayload,
            options?.replaceAssetId,
          ),
        );
      }
      setDraftTitle('');
      setDraftDescription('');
      if (inputRef.current) inputRef.current.value = '';
      if (primaryInputRef.current) primaryInputRef.current.value = '';
      setUploadFeedback({
        tone: 'success',
        stage: 'completed',
        message: `${kind === 'image' ? 'Hình ảnh' : kind === 'video' ? 'Video' : 'Tài liệu'} ${payload?.title || file.name} đã được tải lên và gắn vào sản phẩm.`,
      });
      showNotify(kind === 'image' ? 'Đã upload hình ảnh' : kind === 'video' ? 'Đã upload video' : 'Đã upload tài liệu', 'success');
    } catch (error: any) {
      const message = error?.message || 'Không thể upload asset. Vui lòng thử lại.';
      setUploadFeedback({ tone: 'error', message, progress: undefined });
      showNotify(message, 'error');
    } finally {
      setUploading(false);
      setActiveFileName('');
    }
  };

  const uploadImageBatch = async (selectedFiles: ArrayLike<File> | readonly File[] | null | undefined) => {
    const queue = buildImageUploadPreviewQueue(selectedFiles);
    if (!queue.files.length) {
      if (inputRef.current) inputRef.current.value = '';
      showNotify('Chỉ hỗ trợ upload các file hình ảnh hợp lệ cho gallery.', 'error');
      return;
    }

    const previews = queue.files.map((file, index) => ({
      key: `${file.name}-${file.size}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    publishPendingImagePreviews(previews);
    try {
      for (const file of queue.files) {
        // Preserve the selection order so the preview strip matches the upload order.
        await uploadFile(file);
      }
    } finally {
      clearPendingImagePreviews();
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const beginPrimaryImageCrop = async (file: File) => {
    try {
      const sourceUrl = await readFileAsDataUrl(file);
      setCropSource({
        sourceUrl,
        fileName: file.name,
        title: draftTitle.trim() || file.name,
      });
    } catch (error: any) {
      showNotify(error?.message || 'Không thể mở ảnh để crop.', 'error');
    }
  };

  const beginExistingImageCrop = (item: ProductImageAsset) => {
    if (!productId) {
      showNotify('Tạo sản phẩm trước để crop ảnh đại diện.', 'error');
      return;
    }
    if (item.sourceType !== 'upload') {
      showNotify('Crop lại trực tiếp hiện hỗ trợ cho ảnh đã upload vào hệ thống.', 'error');
      return;
    }
    setCropSource({
      sourceUrl: resolveAssetUrl(API_ORIGIN, item.url),
      fileName: item.fileName || `${item.title || 'product-image'}.jpg`,
      title: item.title || 'Ảnh đại diện',
      replaceAssetId: item.id,
    });
  };

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
        <div style={{ fontSize: '12px', lineHeight: 1.55, color: tokens.colors.textSecondary }}>{subtitle}</div>
      </div>

      <CompactAssetStrip items={normalizedItems as Array<ProductImageAsset | ProductVideoAsset | ProductDocumentAsset>} kind={kind} apiOrigin={apiOrigin} />

      <AssetLinkComposer
        label={kind === 'image' ? 'Tên ảnh' : kind === 'video' ? 'Tên video' : 'Tên tài liệu'}
        titleValue={draftTitle}
        urlValue={draftUrl}
        descriptionValue={draftDescription}
        onTitleChange={(e: any) => setDraftTitle(e.target.value)}
        onUrlChange={(e: any) => setDraftUrl(e.target.value)}
        onDescriptionChange={(e: any) => setDraftDescription(e.target.value)}
        onAdd={addUrlAsset}
        showDescription={kind !== 'image'}
        urlHint={kind === 'video' ? 'Video gắn bằng URL ngoài sẽ không được hệ thống chuẩn hoá, nén hay sinh metadata share-ready. Ưu tiên upload file trực tiếp nếu cần clip ổn định để gửi đối tác.' : undefined}
        labelStyle={labelStyle}
        inputStyle={inputStyle}
        primaryButtonStyle={primaryButtonStyle}
      />

      <div
        style={{
          display: 'grid',
          gap: '10px',
          padding: '16px',
          borderRadius: '18px',
          border: `1px solid ${tokens.colors.border}`,
          background: tokens.colors.surfaceSubtle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
              {kind === 'image' ? 'Upload ảnh từ máy' : kind === 'video' ? 'Upload video từ máy' : 'Upload tài liệu từ máy'}
            </div>
            <div style={{ fontSize: '11px', lineHeight: 1.55, color: tokens.colors.textMuted }}>
              {kind === 'image'
                ? 'Dùng cho ảnh thực tế, brochure visual hoặc asset render. Tối đa 20MB mỗi file.'
                : kind === 'video'
                  ? 'Trình duyệt sẽ ưu tiên chuẩn hoá video về MP4 H.264/AAC trước khi gửi lên để clip nhẹ và dễ share. Tối đa 200MB mỗi file.'
                  : 'Dùng cho brochure, datasheet, catalogue hoặc hướng dẫn sử dụng. Tối đa 20MB mỗi file.'}
            </div>
          </div>
          {kind === 'image' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={!productId || uploading}
                style={{ ...S.btnOutline, minWidth: '148px', justifyContent: 'center', opacity: !productId || uploading ? 0.6 : 1 }}
              >
                {uploading ? 'Đang upload...' : 'Tải ảnh gallery'}
              </button>
              <button
                type="button"
                onClick={() => primaryInputRef.current?.click()}
                disabled={!productId || uploading}
                style={{ ...S.btnPrimary, minWidth: '172px', justifyContent: 'center', opacity: !productId || uploading ? 0.6 : 1 }}
              >
                Tải ảnh đại diện
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!productId || uploading}
              style={{ ...S.btnOutline, minWidth: '148px', justifyContent: 'center', opacity: !productId || uploading ? 0.6 : 1 }}
            >
              {uploading ? 'Đang upload...' : kind === 'video' ? 'Chọn video tải lên' : 'Chọn file tải lên'}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={kind === 'image' ? 'image/png,image/jpeg,image/jpg,image/webp' : kind === 'video' ? 'video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi,.mkv' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'}
          multiple={kind === 'image'}
          style={{ display: 'none' }}
          onChange={(e: any) => {
            if (kind === 'image') {
              void uploadImageBatch(e.target.files);
              return;
            }
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
          disabled={!productId || uploading}
        />
        {kind === 'image' ? (
          <input
            ref={primaryInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={(e: any) => {
              const file = e.target.files?.[0];
              if (file) beginPrimaryImageCrop(file);
            }}
            disabled={!productId || uploading}
          />
        ) : null}
        {!productId ? (
          <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
            Tạo sản phẩm trước để dùng upload trực tiếp.
          </span>
        ) : null}
        {kind === 'image' && pendingImagePreviews.length ? (
          <div
            style={{
              display: 'grid',
              gap: '8px',
              padding: '12px',
              borderRadius: '14px',
              border: `1px solid ${tokens.colors.border}`,
              background: tokens.surface.panelGradient,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preview ảnh chờ upload
              </span>
              <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                {pendingImagePreviews.length} file
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: '8px' }}>
              {pendingImagePreviews.slice(0, 4).map((preview) => (
                <div
                  key={preview.key}
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.surfaceSubtle,
                    display: 'grid',
                  }}
                >
                  <img src={preview.url} alt={preview.name} style={IMAGE_UPLOAD_PREVIEW_FRAME} />
                </div>
              ))}
              {pendingImagePreviews.length > 4 ? (
                <div
                  style={{
                    borderRadius: '12px',
                    border: `1px dashed ${tokens.colors.border}`,
                    background: tokens.colors.surfaceSubtle,
                    color: tokens.colors.textSecondary,
                    display: 'grid',
                    placeItems: 'center',
                    minHeight: '88px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  +{pendingImagePreviews.length - 4}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {uploadFeedback ? (
          <div
            style={{
              display: 'grid',
              gap: '4px',
              padding: '12px 14px',
              borderRadius: '14px',
              border: `1px solid ${
                uploadFeedback.tone === 'error'
                  ? tokens.colors.error
                  : uploadFeedback.tone === 'success'
                    ? tokens.colors.success
                    : tokens.colors.primary
              }33`,
              background:
                uploadFeedback.tone === 'error'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : uploadFeedback.tone === 'success'
                    ? tokens.colors.successTint
                    : 'rgba(59, 130, 246, 0.08)',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color:
                  uploadFeedback.tone === 'error'
                    ? tokens.colors.error
                    : uploadFeedback.tone === 'success'
                      ? tokens.colors.success
                      : tokens.colors.primary,
              }}
            >
              {uploadFeedback.tone === 'error' ? 'Upload lỗi' : uploadFeedback.tone === 'success' ? 'Upload thành công' : 'Đang xử lý'}
            </span>
            <span style={{ fontSize: '12px', lineHeight: 1.5, color: tokens.colors.textSecondary }}>
              {uploadFeedback.message}
            </span>
            {typeof uploadFeedback.progress === 'number' ? (
              <div style={{ display: 'grid', gap: '6px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    background: 'rgba(148, 163, 184, 0.18)',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(6, Math.min(uploadFeedback.progress * 100, 100))}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background: tokens.colors.primary,
                      transition: 'width 180ms ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                  Tiến độ xử lý: {(uploadFeedback.progress * 100).toFixed(0)}%
                </span>
              </div>
            ) : null}
            {uploading && activeFileName ? (
              <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                File hiện tại: {activeFileName}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {normalizedItems.map((item, index) => (
            (() => {
              const isBusy = busyAssetId === item.id;
              const isPrimaryImage = kind === 'image' && (item as ProductImageAsset).isPrimary;
              const firstGalleryIndex = kind === 'image' && (normalizedItems[0] as ProductImageAsset | undefined)?.isPrimary ? 1 : 0;
              const canMoveUp = kind === 'image' && !isPrimaryImage && index > firstGalleryIndex;
              const canMoveDown = kind === 'image' && !isPrimaryImage && index < normalizedItems.length - 1;
              return (
            <div
              key={item.id || `${item.url}-${index}`}
              style={{
                borderRadius: '14px',
                border: `1px solid ${(item as ProductImageAsset).isPrimary ? tokens.colors.badgeBgSuccess : tokens.colors.border}`,
                background: 'rgba(15, 23, 42, 0.55)',
                padding: '10px 12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: '56px', minWidth: '56px', height: '56px',
                  borderRadius: '10px', overflow: 'hidden',
                  border: `1px solid ${tokens.colors.border}`,
                  background: kind === 'image' ? 'rgba(2,6,23,0.4)' : kind === 'video' ? 'rgba(59,130,246,0.14)' : tokens.colors.successTint,
                  display: 'grid', placeItems: 'center',
                  color: tokens.colors.primary, fontSize: '11px', fontWeight: 900,
                }}
              >
                {kind === 'image' ? (
                  <img src={resolveAssetUrl(API_ORIGIN, item.url)} alt={(item as ProductImageAsset).alt || item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : kind === 'video' ? (
                  <VideoPosterPreview src={resolveAssetUrl(API_ORIGIN, item.url)} title={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'rgba(2,6,23,0.92)' }} />
                ) : (
                  getDocumentBadge(item)
                )}
              </div>

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  style={{ ...S.input, padding: '5px 10px', fontSize: '12px' }}
                  value={item.title || ''}
                  onInput={(e: any) => updateItem(index, { title: e.target.value })}
                  placeholder="Tiêu đề"
                />
                {kind !== 'image' ? (
                  <input
                    type="text"
                    style={{ ...S.input, padding: '5px 10px', fontSize: '12px' }}
                    value={((item as ProductVideoAsset).description || (item as ProductDocumentAsset).description || '')}
                    onInput={(e: any) => updateItem(index, { description: e.target.value })}
                    placeholder={kind === 'video' ? 'Mô tả ngắn / use case' : 'Mô tả ngắn'}
                  />
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {kind === 'image' && (item as ProductImageAsset).isPrimary && (
                    <span style={{ ...ui.badge.success, background: tokens.colors.successTint, fontSize: '10px', padding: '2px 7px' }}>Đại diện</span>
                  )}
                  {item.size ? <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{formatAssetSize(item.size)}</span> : null}
                  {kind === 'video' ? <VideoModeBadge video={item as ProductVideoAsset} /> : null}
                  {kind === 'video' && (item as ProductVideoAsset).durationSeconds ? <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{formatVideoDuration((item as ProductVideoAsset).durationSeconds)}</span> : null}
                  {kind === 'video' && (item as ProductVideoAsset).width && (item as ProductVideoAsset).height ? <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{(item as ProductVideoAsset).width}×{(item as ProductVideoAsset).height}</span> : null}
                  <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{item.sourceType === 'upload' ? 'Upload' : 'URL'}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                {kind === 'image' ? (
                  <>
                    <button
                      type="button"
                      title={(item as ProductImageAsset).isPrimary ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
                      onClick={() => setPrimaryImageLocally(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: (item as ProductImageAsset).isPrimary ? '#f59e0b' : tokens.colors.textMuted, display: 'flex' }}
                    >
                      <StarIcon size={14} fill={(item as ProductImageAsset).isPrimary ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      title="Crop ảnh đại diện"
                      onClick={() => beginExistingImageCrop(item as ProductImageAsset)}
                      disabled={!productId || uploading || isBusy || (item as ProductImageAsset).sourceType !== 'upload'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.textMuted, display: 'flex', opacity: !productId || uploading || isBusy || (item as ProductImageAsset).sourceType !== 'upload' ? 0.4 : 1 }}
                    >
                      <CropIcon size={14} />
                    </button>
                    <button
                      type="button"
                      title="Đưa lên"
                      onClick={() => moveImageItem(index, -1)}
                      disabled={!canMoveUp || uploading || Boolean(isBusy)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.textMuted, display: 'flex', opacity: !canMoveUp || uploading || Boolean(isBusy) ? 0.4 : 1 }}
                    >
                      <ArrowUpIcon size={14} />
                    </button>
                    <button
                      type="button"
                      title="Đưa xuống"
                      onClick={() => moveImageItem(index, 1)}
                      disabled={!canMoveDown || uploading || Boolean(isBusy)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.textMuted, display: 'flex', opacity: !canMoveDown || uploading || Boolean(isBusy) ? 0.4 : 1 }}
                    >
                      <ArrowDownIcon size={14} />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  title={isBusy ? 'Đang xóa...' : 'Xóa'}
                  onClick={() => removeItem(index)}
                  disabled={uploading || Boolean(isBusy)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.error, display: 'flex', opacity: uploading || Boolean(isBusy) ? 0.5 : 1 }}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
              );
            })()
          ))}
        </div>
      ) : (
        <EmptyAssetState
          title={`Chưa có ${kind === 'image' ? 'hình ảnh' : kind === 'video' ? 'video' : 'tài liệu'}`}
          description={kind === 'image'
            ? 'Thêm link ảnh hoặc upload ảnh thật từ máy để build gallery.'
            : kind === 'video'
              ? 'Thêm clip demo để trình duyệt chuẩn hoá MP4 trước khi upload và hiển thị poster thumbnail ngay trong giao diện.'
              : 'Thêm brochure, catalogue hoặc hướng dẫn sử dụng để hiện trong hồ sơ sản phẩm.'}
        />
      )}
      {kind === 'image' && cropSource ? (
        <ProductImageCropModal
          sourceUrl={cropSource.sourceUrl}
          title={cropSource.title}
          onClose={() => {
            setCropSource(null);
            if (primaryInputRef.current) primaryInputRef.current.value = '';
          }}
          outlineButtonStyle={S.btnOutline}
          primaryButtonStyle={S.btnPrimary}
          labelStyle={S.label}
          onConfirm={async (crop) => {
            try {
              const blob = await createSquareCroppedImage(cropSource.sourceUrl, crop);
              const extension = cropSource.fileName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
              const file = new File([blob], `primary-${Date.now()}.${extension}`, { type: blob.type || 'image/jpeg' });
              await uploadFile(file, { isPrimary: true, replaceAssetId: cropSource.replaceAssetId });
              setCropSource(null);
            } catch (error: any) {
              showNotify(error?.message || 'Không thể crop ảnh.', 'error');
            }
          }}
        />
      ) : null}
    </div>
  );
}

