import { LoaderIcon } from './icons';
import { tokens } from './tokens';
import { ui } from './styles';

export function PageLoader({ message = 'Đang tải module...' }: { message?: string }) {
  return (
    <div
      style={{
        ...ui.card.base,
        minHeight: '180px',
        display: 'grid',
        placeItems: 'center',
        padding: tokens.spacing.xl,
        background: tokens.surface.panelGradient,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          color: tokens.colors.textSecondary,
          fontSize: tokens.fontSize.sm,
          fontWeight: 700,
        }}
      >
        <LoaderIcon size={16} />
        {message}
      </div>
    </div>
  );
}
