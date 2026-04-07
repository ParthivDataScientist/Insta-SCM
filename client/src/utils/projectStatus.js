const WIN_STAGE_ALIASES = new Set(['win', 'won', 'confirmed']);
const DROP_STAGE_ALIASES = new Set(['drop', 'dropped', 'lost']);

export const DESIGN_STATUSES = ['In-Process', 'Design Change', 'Drop', 'Win'];
export const EXECUTION_BOARD_STAGES = [
  'Design/ BOM',
  'Procuement (Material management)',
  'Production',
  'QC',
  'Dispatch',
  'Event Installation',
  'Dismantle',
  'Inventory',
];

const BOARD_STAGE_ALIASES = new Map([
  ['tbc', 'Design/ BOM'],
  ['approved', 'Design/ BOM'],
  ['design', 'Design/ BOM'],
  ['design/ bom', 'Design/ BOM'],
  ['design / bom', 'Design/ BOM'],
  ['bom', 'Design/ BOM'],
  ['material management', 'Procuement (Material management)'],
  ['material-management', 'Procuement (Material management)'],
  ['procurement', 'Procuement (Material management)'],
  ['procuement (material management)', 'Procuement (Material management)'],
  ['upcoming prebuild', 'Production'],
  ['current prebuild', 'Production'],
  ['production', 'Production'],
  ['qc ready', 'QC'],
  ['qc', 'QC'],
  ['ready to ship', 'Dispatch'],
  ['shipped', 'Dispatch'],
  ['dispatch', 'Dispatch'],
  ['assembled', 'Event Installation'],
  ['assembeled', 'Event Installation'],
  ['event installation', 'Event Installation'],
  ['dismantle', 'Dismantle'],
  ['dismantling', 'Dismantle'],
  ['return to inventory', 'Inventory'],
  ['inventory', 'Inventory'],
]);

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

export function normalizeBoardStage(stage) {
  const value = (stage || '').trim();
  if (!value) return EXECUTION_BOARD_STAGES[0];

  return BOARD_STAGE_ALIASES.get(value.toLowerCase()) || value;
}

export function getInitialBoardStage() {
  return EXECUTION_BOARD_STAGES[0];
}

export function getProjectCode(project) {
  if (!project) return '-';
  return project.crm_project_id || `PRJ-${String(project.id || 0).padStart(5, '0')}`;
}
