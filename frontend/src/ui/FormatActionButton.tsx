import { useEffect, useRef, useState } from 'preact/hooks';
import { ui } from './styles';
import { tokens } from './tokens';

type TabularFormat = 'csv' | 'xlsx';

type FormatActionButtonProps = {
  label: string;
  icon?: any;
  buttonStyle: any;
  menuAlign?: 'left' | 'right';
  onSelect: (format: TabularFormat) => void;
};

export function FormatActionButton({
  label,
  icon: Icon,
  buttonStyle,
  menuAlign = 'left',
  onSelect,
}: FormatActionButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {Icon ? <Icon size={14} /> : null}
        {label}
        <span aria-hidden="true" style={{ fontSize: '11px', opacity: 0.72 }}>v</span>
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [menuAlign]: 0,
            minWidth: '140px',
            padding: '6px',
            borderRadius: tokens.radius.lg,
            ...ui.overlay.menu,
            zIndex: tokens.zIndex.dropdown,
            display: 'grid',
            gap: '4px',
          }}
        >
          {(['csv', 'xlsx'] as TabularFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(format);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                border: 'none',
                background: 'transparent',
                color: tokens.colors.textPrimary,
                padding: '9px 12px',
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              <span>{format}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
