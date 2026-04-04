import { tokens } from '../ui/tokens';

export function HomeExecutiveView({
  hero,
  metrics,
  highlights,
  actions,
  error,
}: {
  hero: any;
  metrics: any;
  highlights: any;
  actions: any;
  error?: any;
}) {
  return (
    <div style={{ display: 'grid', gap: tokens.spacing.xl, alignItems: 'stretch' }}>
      {hero}
      {metrics}
      {highlights}
      {actions}
      {error}
    </div>
  );
}
