export function selectRepresentativeProject(projects: any[]) {
  const items = Array.isArray(projects) ? projects : [];
  if (!items.length) return null;

  return (
    items.find((project) => String(project?.status || '').toLowerCase() === 'active')
    || items.find((project) => String(project?.status || '').toLowerCase() === 'pending')
    || items.find((project) => String(project?.status || '').toLowerCase() === 'paused')
    || items[0]
  );
}
