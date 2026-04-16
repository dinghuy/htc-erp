import { useEffect, useRef, useState } from 'preact/hooks';
import { OverlayModal } from '../ui/OverlayModal';
import { tokens } from '../ui/tokens';
import { clamp, loadImageElement } from './productAssetUploadUtils';

export function ProductImageCropModal({
  sourceUrl,
  title,
  onClose,
  onConfirm,
  outlineButtonStyle,
  primaryButtonStyle,
  labelStyle,
}: {
  sourceUrl: string;
  title: string;
  onClose: () => void;
  onConfirm: (crop: { zoom: number; offsetX: number; offsetY: number }) => Promise<void> | void;
  outlineButtonStyle: any;
  primaryButtonStyle: any;
  labelStyle: any;
}) {
  const cropSize = 320;
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    let active = true;
    loadImageElement(sourceUrl)
      .then((image) => {
        if (!active) return;
        setImageMeta({ width: image.naturalWidth, height: image.naturalHeight });
      })
      .catch(() => {
        if (!active) return;
        setImageMeta({ width: cropSize, height: cropSize });
      });
    return () => {
      active = false;
    };
  }, [sourceUrl]);

  const baseScale = imageMeta ? Math.max(cropSize / imageMeta.width, cropSize / imageMeta.height) : 1;
  const displayWidth = imageMeta ? imageMeta.width * baseScale * zoom : cropSize;
  const displayHeight = imageMeta ? imageMeta.height * baseScale * zoom : cropSize;
  const maxOffsetX = Math.max(0, (displayWidth - cropSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - cropSize) / 2);
  const safeOffsetX = clamp(offsetX, -maxOffsetX, maxOffsetX);
  const safeOffsetY = clamp(offsetY, -maxOffsetY, maxOffsetY);
  const left = (cropSize - displayWidth) / 2 + safeOffsetX;
  const top = (cropSize - displayHeight) / 2 + safeOffsetY;

  useEffect(() => {
    setOffsetX((current) => clamp(current, -maxOffsetX, maxOffsetX));
    setOffsetY((current) => clamp(current, -maxOffsetY, maxOffsetY));
  }, [maxOffsetX, maxOffsetY]);

  const startDrag = (event: any) => {
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: safeOffsetX,
      offsetY: safeOffsetY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onDrag = (event: any) => {
    if (!dragState.current) return;
    const nextX = dragState.current.offsetX + (event.clientX - dragState.current.startX);
    const nextY = dragState.current.offsetY + (event.clientY - dragState.current.startY);
    setOffsetX(clamp(nextX, -maxOffsetX, maxOffsetX));
    setOffsetY(clamp(nextY, -maxOffsetY, maxOffsetY));
  };

  const stopDrag = (event: any) => {
    dragState.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <OverlayModal title="Cắt ảnh đại diện" subtitle="Kéo ảnh và zoom để chốt khung vuông hiển thị như avatar sản phẩm." onClose={onClose} maxWidth="760px">
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: '20px', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: '12px', justifyItems: 'center' }}>
            <div
              onPointerDown={startDrag}
              onPointerMove={onDrag}
              onPointerUp={stopDrag}
              onPointerLeave={stopDrag}
              style={{
                width: `${cropSize}px`,
                height: `${cropSize}px`,
                borderRadius: '28px',
                overflow: 'hidden',
                border: `1px solid ${tokens.colors.border}`,
                // Keep a dark stage here for crop legibility over arbitrary source images.
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.94) 0%, rgba(2, 6, 23, 0.94) 100%)',
                position: 'relative',
                cursor: 'grab',
                touchAction: 'none',
                boxShadow: '0 18px 40px rgba(2, 6, 23, 0.28)',
              }}
            >
              <img
                src={sourceUrl}
                alt={title}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  objectFit: 'cover',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  // Keep the scrim literal: this is a media overlay, not an app theme surface.
                  boxShadow: 'inset 0 0 0 999px rgba(2, 6, 23, 0.18)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '28px',
                  pointerEvents: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Ảnh đại diện sẽ hiển thị dạng hình vuông ở hero preview và thumbnail chính.</div>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>Ảnh nguồn</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.55 }}>{title}</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={labelStyle}>Zoom khung crop</label>
              <input type="range" min="1" max="3" step="0.05" value={zoom} onInput={(e: any) => setZoom(Number(e.currentTarget.value))} />
              <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>Kéo trực tiếp trong khung vuông để chỉnh vị trí hiển thị.</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffsetX(0);
                  setOffsetY(0);
                }}
                style={{ ...outlineButtonStyle, justifyContent: 'center' }}
              >
                Đặt lại khung crop
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={outlineButtonStyle} disabled={saving}>Hủy</button>
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm({ zoom, offsetX: safeOffsetX, offsetY: safeOffsetY });
              } finally {
                setSaving(false);
              }
            }}
            style={primaryButtonStyle}
            disabled={saving}
          >
            {saving ? 'Đang lưu...' : 'Dùng làm ảnh đại diện'}
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}
