const WIN_STAGE_ALIASES = new Set(['win', 'won', 'confirmed']);
const DROP_STAGE_ALIASES = new Set(['drop', 'dropped', 'lost']);

export const DESIGN_STATUSES = ['In-Process', 'Design Change', 'Drop', 'Win'];

export function normalizeProjectStage(stage) {
  const value = (stage || 'In-Process').trim();
  const lowerValue = value.toLowerCase();

  if (WIN_STAGE_ALIASES.has(lowerValue)) return 'Win';
  if (DROP_STAGE_ALIASES.has(lowerValue)) return 'Drop';
  if (lowerValue === 'design change' || lowerValue === 'design-change' || lowerValue === 'design_change') {
    return 'Design Change';
  }
  if (
    lowerValue === 'open' ||
    lowerValue === 'in-process' ||
    lowerValue === 'in process' ||
    lowerValue === 'in_progress' ||
    lowerValue === 'in-progress'
  ) {
    return 'In-Process';
  }

  return value || 'In-Process';
}

export function isWonProject(stage) {
  return normalizeProjectStage(stage) === 'Win';
}

export function getProjectCode(project) {
  if (!project) return '-';
  return project.crm_project_id || `PRJ-${String(project.id || 0).padStart(5, '0')}`;
}
