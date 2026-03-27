export type WorkflowOption = {
  value: string;
  label: string;
};

export const TASK_TYPE_OPTIONS: WorkflowOption[] = [
  { value: 'follow_up', label: 'Follow up' },
  { value: 'supplier_quote', label: 'Supplier quote' },
  { value: 'internal_review', label: 'Internal review' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'delivery_handoff', label: 'Delivery handoff' },
  { value: 'warehouse_delivery', label: 'Warehouse delivery' },
  { value: 'service_execution', label: 'Service execution' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'admin', label: 'Admin' },
];

export const DEPARTMENT_OPTIONS = [
  'Sales',
  'Finance',
  'Accounting',
  'Procurement',
  'Operations',
  'Warehouse',
  'Technical',
  'QA',
  'BOD',
  'Admin',
];

export const PROJECT_STAGE_OPTIONS: WorkflowOption[] = [
  { value: 'new', label: 'Mới' },
  { value: 'quoting', label: 'Đang báo giá' },
  { value: 'negotiating', label: 'Đang thương lượng' },
  { value: 'internal-review', label: 'Duyệt nội bộ' },
  { value: 'won', label: 'Thắng' },
  { value: 'lost', label: 'Thua' },
  { value: 'delivery', label: 'Triển khai' },
  { value: 'closed', label: 'Đóng' },
];

const TASK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TASK_TYPE_OPTIONS.map((item) => [item.value, item.label])
);

const DEPARTMENT_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTMENT_OPTIONS.map((item) => [item, item])
);

const PROJECT_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_STAGE_OPTIONS.map((item) => [item.value, item.label])
);

export function normalizeWorkflowKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

export function taskTypeLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = normalizeWorkflowKey(raw);
  return TASK_TYPE_LABELS[normalized] || raw;
}

export function departmentLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  return DEPARTMENT_LABELS[raw] || DEPARTMENT_LABELS[raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function projectStageLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return PROJECT_STAGE_LABELS[raw] || raw;
}

export function taskTypeValueOptions() {
  return TASK_TYPE_OPTIONS;
}

export function departmentValueOptions() {
  return DEPARTMENT_OPTIONS;
}

export function projectStageValueOptions() {
  return PROJECT_STAGE_OPTIONS;
}
