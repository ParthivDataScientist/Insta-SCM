const WIN_STAGE_ALIASES = new Set(['win', 'won', 'confirmed']);
const DROP_STAGE_ALIASES = new Set(['drop', 'dropped', 'lost']);

export const DESIGN_STATUSES = ['In-Process', 'Design Change', 'Drop', 'Win'];
export const PROJECT_STATUS_OPTIONS = ['pending', 'in_progress', 'changes', 'won', 'lost'];
export const PROJECT_PRIORITY_OPTIONS = ['high', 'medium', 'low'];
export const EXECUTION_BOARD_STAGES = [
  'Design/BOM',
  'Procurement',
  'Production',
  'Dispatch',
  'Event Installation',
  'Dismantle',
  'Completed/Closed',
];

const BOARD_STAGE_ALIASES = new Map([
  ['tbc', 'Design/BOM'],
  ['approved', 'Design/BOM'],
  ['design', 'Design/BOM'],
  ['design/bom', 'Design/BOM'],
  ['design/ bom', 'Design/BOM'],
  ['design / bom', 'Design/BOM'],
  ['bom', 'Design/BOM'],
  ['material management', 'Procurement'],
  ['material-management', 'Procurement'],
  ['procurement', 'Procurement'],
  ['procuement (material management)', 'Procurement'],
  ['upcoming prebuild', 'Production'],
  ['current prebuild', 'Production'],
  ['production', 'Production'],
  ['qc ready', 'Production'],
  ['qc', 'Production'],
  ['ready to ship', 'Dispatch'],
  ['shipped', 'Dispatch'],
  ['dispatch', 'Dispatch'],
  ['assembled', 'Event Installation'],
  ['assembeled', 'Event Installation'],
  ['event installation', 'Event Installation'],
  ['dismantle', 'Dismantle'],
  ['dismantling', 'Dismantle'],
  ['return to inventory', 'Completed/Closed'],
  ['inventory', 'Completed/Closed'],
  ['completed/closed', 'Completed/Closed'],
  ['completed', 'Completed/Closed'],
  ['closed', 'Completed/Closed'],
]);

const PRIORITY_META = {
  high: { label: 'High', rank: 0, accentVar: '--priority-high' },
  medium: { label: 'Medium', rank: 1, accentVar: '--priority-medium' },
  low: { label: 'Low', rank: 2, accentVar: '--priority-low' },
};

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
  return project.crm_project_id || `Proj - ${project.id ?? '-'}`;
}

export function formatProjectStatusLabel(status) {
  switch ((status || '').trim().toLowerCase()) {
    case 'in_progress':
    case 'in-progress':
    case 'in progress':
      return 'In Progress';
    case 'changes':
      return 'Changes';
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    case 'pending':
    default:
      return 'Pending';
  }
}

export function normalizeProjectPriority(priority) {
  const value = (priority || '').trim().toLowerCase();
  if (value === 'high' || value === 'urgent' || value === 'critical') return 'high';
  if (value === 'low') return 'low';
  return 'medium';
}

export function formatProjectPriorityLabel(priority) {
  return PRIORITY_META[normalizeProjectPriority(priority)].label;
}

export function getProjectPriorityRank(priority) {
  return PRIORITY_META[normalizeProjectPriority(priority)].rank;
}

export function sortProjectsByPriority(left, right) {
  const rankDiff = getProjectPriorityRank(left?.priority) - getProjectPriorityRank(right?.priority);
  if (rankDiff !== 0) return rankDiff;

  const leftDate = left?.dispatch_date || left?.installation_start_date || left?.event_start_date || left?.updated_at || '';
  const rightDate = right?.dispatch_date || right?.installation_start_date || right?.event_start_date || right?.updated_at || '';
  return String(leftDate).localeCompare(String(rightDate));
}
