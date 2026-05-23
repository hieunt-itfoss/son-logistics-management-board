import type { Role } from '../types';

/**
 * Tab/menu access uses users.role only (ROLE_PERMISSIONS) — custom_perms cannot add tabs.
 * Keys below are boolean overrides within allowed modules (admin configures per NV).
 */
export type PermOverrideKey =
  | 'canSeeAllLo'
  | 'canCreateLo'
  | 'canEdit'
  | 'canEditTienHang'
  | 'canDelete'
  | 'canChotSo'
  | 'canViewLoiNhuan';

export type CustomPermOverrides = Partial<Record<PermOverrideKey, boolean>>;

export interface EffectivePerms {
  role: Role;
  canSeeAllLo: boolean;
  canCreateLo: boolean;
  canEdit: boolean;
  canEditTienHang: boolean;
  canDelete: boolean;
  canChotSo: boolean;
  canViewLoiNhuan: boolean;
}

const ROLE_DEFAULTS: Record<Role, EffectivePerms> = {
  admin: {
    role: 'admin',
    canSeeAllLo: true,
    canCreateLo: true,
    canEdit: true,
    canEditTienHang: true,
    canDelete: true,
    canChotSo: true,
    canViewLoiNhuan: true,
  },
  ketoanTruong: {
    role: 'ketoanTruong',
    canSeeAllLo: true,
    canCreateLo: true,
    canEdit: true,
    canEditTienHang: true,
    canDelete: false,
    canChotSo: true,
    canViewLoiNhuan: true,
  },
  ketoanVien: {
    role: 'ketoanVien',
    canSeeAllLo: true,
    canCreateLo: true,
    canEdit: true,
    canEditTienHang: false,
    canDelete: false,
    canChotSo: false,
    canViewLoiNhuan: false,
  },
  nhanvien: {
    role: 'nhanvien',
    canSeeAllLo: true,
    canCreateLo: true,
    canEdit: true,
    canEditTienHang: false,
    canDelete: false,
    canChotSo: false,
    canViewLoiNhuan: false,
  },
  kho: {
    role: 'kho',
    canSeeAllLo: true,
    canCreateLo: true,
    canEdit: true,
    canEditTienHang: false,
    canDelete: false,
    canChotSo: false,
    canViewLoiNhuan: false,
  },
  laixe: {
    role: 'laixe',
    canSeeAllLo: false,
    canCreateLo: true,
    canEdit: false,
    canEditTienHang: false,
    canDelete: false,
    canChotSo: false,
    canViewLoiNhuan: false,
  },
};

export const PERM_OVERRIDE_LABELS: Record<PermOverrideKey, string> = {
  canSeeAllLo: 'Xem tất cả phiếu',
  canCreateLo: 'Tạo phiếu',
  canEdit: 'Sửa phiếu',
  canEditTienHang: 'Sửa tiền hàng',
  canDelete: 'Xoá phiếu',
  canChotSo: 'Chốt sổ',
  canViewLoiNhuan: 'Xem lợi nhuận',
};

export const OVERRIDABLE_PERM_KEYS: PermOverrideKey[] = [
  'canSeeAllLo',
  'canCreateLo',
  'canEdit',
  'canEditTienHang',
  'canDelete',
  'canChotSo',
  'canViewLoiNhuan',
];

export function parseCustomPerms(raw: string | null | undefined): CustomPermOverrides {
  if (!raw || raw === '{}') return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: CustomPermOverrides = {};
    for (const k of OVERRIDABLE_PERM_KEYS) {
      if (typeof o[k] === 'boolean') out[k] = o[k];
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeCustomPerms(overrides: CustomPermOverrides): string {
  const clean: CustomPermOverrides = {};
  for (const k of OVERRIDABLE_PERM_KEYS) {
    if (typeof overrides[k] === 'boolean') clean[k] = overrides[k];
  }
  return JSON.stringify(clean);
}

export function getEffectivePerms(role: Role, customPermsRaw?: string | null): EffectivePerms {
  const base = { ...ROLE_DEFAULTS[role] };
  const overrides = parseCustomPerms(customPermsRaw);
  for (const k of OVERRIDABLE_PERM_KEYS) {
    if (typeof overrides[k] === 'boolean') {
      base[k] = overrides[k] as boolean;
    }
  }
  return base;
}

export function countCustomOverrides(raw: string | null | undefined): number {
  return Object.keys(parseCustomPerms(raw)).length;
}

/** User overrides take precedence over linked nhan_vien defaults */
export function mergeCustomPermsRaw(userRaw: string | null | undefined, nvRaw: string | null | undefined): string {
  return serializeCustomPerms({
    ...parseCustomPerms(nvRaw),
    ...parseCustomPerms(userRaw),
  });
}
