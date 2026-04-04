import { tokens } from '../ui/tokens';

export function HomeOperatorView({
  hero,
  actions,
  highlights,
  metrics,
  error,
}: {
  hero: any;
  actions: any;
  highlights: any;
  metrics: any;
  error?: any;
}) {
  return (
    <div style={{ display: 'grid', gap: tokens.spacing.xl, alignItems: 'stretch' }}>
      {hero}
      {actions}
      {highlights}
      {metrics}
      {error}
    </div>
  );
}
