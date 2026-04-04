export type HomeTemplate = 'executive' | 'executive-lite' | 'operator';
export type HomeSectionKey = 'hero' | 'actions' | 'metrics' | 'highlights';

export function resolveHomeTemplate(personaMode: string): HomeTemplate {
  if (personaMode === 'director' || personaMode === 'admin') return 'executive';
  if (personaMode === 'accounting' || personaMode === 'legal') return 'executive-lite';
  return 'operator';
}

export function buildHomeTemplateViewModel(personaMode: string): {
  template: HomeTemplate;
  sectionOrder: HomeSectionKey[];
} {
  const template = resolveHomeTemplate(personaMode);

  if (template === 'executive' || template === 'executive-lite') {
    return {
      template,
      sectionOrder: ['hero', 'metrics', 'highlights', 'actions'],
    };
  }

  return {
    template,
    sectionOrder: ['hero', 'actions', 'highlights', 'metrics'],
  };
}
