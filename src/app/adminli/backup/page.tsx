'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { PageLoading } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

// ================= 数据模型 =================
interface BackupConfig {
  auto_enabled: boolean;
  schedule_cron: string;
  backup_type: string;
  storage_driver: string | null;
  encrypt: boolean;
  retention_count: number;
  retention_days: number;
}

interface BackupRecord {
  id: string;
  type: string;
  format: string;
  storage_driver: string;
  file_path: string;
  file_size: string | number | null;
  encrypted: boolean;
  status: string;
  note?: string | null;
  created_at: string;
  creator?: { id: string; name: string } | null;
}

interface ConfigForm {
  auto_enabled: boolean;
  schedule_cron: string;
  backup_type: string;
  storage_driver: string;
  encrypt: boolean;
  retention_count: string;
  retention_days: string;
}

// ================= 文案映射 =================
const BACKUP_STATUS_META: Record<string, { tone: Tone; label: string }> = {
  RUNNING: { tone: 'warning', label: '处理中' },
  OK: { tone: 'success', label: '成功' },
  FAILED: { tone: 'danger', label: '失败' },
  DELETED: { tone: 'neutral', label: '已删除' },
};

const BACKUP_TYPE_LABEL: Record<string, string> = {
  MANUAL: '手动',
  AUTO: '自动',
  PRE_RESTORE_SNAPSHOT: '恢复前快照',
};

const BACKUP_FORMAT_LABEL: Record<string, string> = {
  SQL: 'SQL',
  CUSTOM: '自定义',
};

/** BigInt 序列化为字符串的 file_size → 可读大小 */
function formatSize(size?: string | number | null): string {
  if (size == null || size === '') return '-';
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function toForm(c?: BackupConfig | null): ConfigForm {
  return {
    auto_enabled: c?.auto_enabled ?? true,
    schedule_cron: c?.schedule_cron ?? '0 3 * * *',
    backup_type: c?.backup_type ?? 'FULL',
    storage_driver: c?.storage_driver ?? 'local',
    encrypt: c?.encrypt ?? false,
    retention_count: String(c?.retention_count ?? 14),
    retention_days: String(c?.retention_days ?? 30),
  };
}

// ---------- 单条备份记录行（移动优先：换行堆叠） ----------
function BackupRow({ item, onDelete }: { item: BackupRecord; onDelete: (it: BackupRecord) => void }) {
  const typeLabel = BACKUP_TYPE_LABEL[item.type] || item.type;
  const fmtLabel = BACKUP_FORMAT_LABEL[item.format] || item.format;
  const st = BACKUP_STATUS_META[item.status] || { tone: 'default' as Tone, label: item.status };
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="primary">{typeLabel}</Badge>
        <Badge tone="neutral">{fmtLabel}</Badge>
        <Badge tone={st.tone}>{st.label}</Badge>
        {item.encrypted && <Badge tone="warning">加密</Badge>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text" title={item.file_path}>
          {item.file_path}
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {formatSize(item.file_size)} · {item.storage_driver || '-'}
          {item.note ? ` · ${item.note}` : ''} · {formatDateTime(item.created_at)}
          {item.creator?.name ? ` · ${item.creator.name}` : ''}
        </p>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => onDelete(item)}>
          删除
        </Button>
      </div>
    </div>
  );
}

// ---------- 页面 ----------
function BackupContent() {
  const sp = useSearchParams();
  const { toast } = useToast();
  const guarding = useRoleGuard(['ADMIN'], '/');
  const page = Number(sp.get('page')) || 1;
  const PAGE_SIZE = 10;

  // 备份配置 + 最近备份
  const [form, setForm] = useState<ConfigForm>(toForm(null));
  const [configLoading, setConfigLoading] = useState(true);
  const [configFailed, setConfigFailed] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [recent, setRecent] = useState<BackupRecord[]>([]);

  // 备份记录（分页）
  const [rows, setRows] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsFailed, setRowsFailed] = useState(false);

  // 操作
  const [backingUp, setBackingUp] = useState(false);
  const [deleting, setDeleting] = useState<BackupRecord | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const loadConfig = useCallback(() => {
    setConfigLoading(true);
    api
      .get<{ config: BackupConfig | null; recentBackups: BackupRecord[] }>('/api/admin/backup-config')
      .then((r) => {
        if (r.ok) {
          setConfigFailed(false);
          const cfg = r.data?.config ?? null;
          setForm(toForm(cfg));
          setRecent(r.data?.recentBackups || []);
        } else {
          setConfigFailed(true);
        }
        setConfigLoading(false);
      });
  }, []);

  const loadRows = useCallback(() => {
    setRowsLoading(true);
    api.get<BackupRecord[]>('/api/admin/backups' + qs({ page, pageSize: PAGE_SIZE })).then((r) => {
      if (r.ok) {
        setRowsFailed(false);
        setRows(r.data || []);
        setTotal(Number(r.meta?.total) || 0);
      } else {
        setRowsFailed(true);
      }
      setRowsLoading(false);
    });
  }, [page]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const set = <K extends keyof ConfigForm>(k: K, v: ConfigForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const saveConfig = async () => {
    const body = {
      auto_enabled: form.auto_enabled,
      schedule_cron: form.schedule_cron.trim(),
      backup_type: form.backup_type,
      storage_driver: form.storage_driver.trim() || undefined,
      encrypt: form.encrypt,
      retention_count: Number(form.retention_count) || 1,
      retention_days: Number(form.retention_days) || 1,
    };
    setSavingConfig(true);
    const res = await api.put('/api/admin/backup-config', body);
    setSavingConfig(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', '备份配置已保存');
    loadConfig();
  };

  const backupNow = async () => {
    setBackingUp(true);
    const res = await api.post('/api/admin/backups');
    setBackingUp(false);
    if (!res.ok) return toast('error', res.error?.message || '备份失败');
    toast('success', '已发起备份');
    loadConfig();
    loadRows();
  };

  const removeBackup = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    const res = await api.del(`/api/admin/backups/${deleting.id}`);
    setDeletingLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '删除失败');
    toast('success', '已删除备份记录');
    setDeleting(null);
    loadConfig();
    loadRows();
  };

  if (guarding) return <PageLoading />;

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="数据备份">
      <h1 className="mb-4 text-lg font-bold text-text">数据备份与恢复</h1>

      {/* 备份配置 */}
      <Card
        title="备份配置"
        action={
          <Button size="sm" onClick={backupNow} loading={backingUp}>
            立即备份
          </Button>
        }
      >
        {configLoading ? (
          <PageLoading />
        ) : configFailed ? (
          <Empty
            title="备份配置加载失败"
            description="请检查网络后重试"
            action={
              <Button size="sm" variant="secondary" onClick={loadConfig}>
                重试
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="定时任务 Cron"
                maxLength={50}
                placeholder="如：0 3 * * *（每日 03:00）"
                value={form.schedule_cron}
                onChange={(e) => set('schedule_cron', e.target.value)}
              />
              <Select label="备份类型" value={form.backup_type} onChange={(e) => set('backup_type', e.target.value)}>
                <option value="FULL">全量备份</option>
                <option value="SCHEMA_DATA">结构+数据</option>
              </Select>
              <Input
                label="存储后端"
                maxLength={20}
                placeholder="local / oss / s3"
                value={form.storage_driver}
                onChange={(e) => set('storage_driver', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="保留份数"
                  type="number"
                  min={1}
                  value={form.retention_count}
                  onChange={(e) => set('retention_count', e.target.value)}
                />
                <Input
                  label="保留天数"
                  type="number"
                  min={1}
                  value={form.retention_days}
                  onChange={(e) => set('retention_days', e.target.value)}
                />
              </div>
              <Switch label="自动备份" hint="按上述 Cron 定时自动备份" checked={form.auto_enabled} onChange={(v) => set('auto_enabled', v)} />
              <Switch label="加密存储" hint="备份文件 AES-256 加密" checked={form.encrypt} onChange={(v) => set('encrypt', v)} />
            </div>
            <div className="mt-4 flex justify-end border-t border-border pt-4">
              <Button onClick={saveConfig} loading={savingConfig}>
                保存配置
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* 最近备份 */}
      <div className="mt-4">
        <Card title="最近备份">
          {configLoading ? (
            <PageLoading />
          ) : configFailed ? (
            <Empty title="加载失败" description="请检查网络后重试" />
          ) : recent.length === 0 ? (
            <Empty title="暂无备份记录" description="点击右上角「立即备份」创建第一份备份" />
          ) : (
            <div className="divide-y divide-border">
              {recent.map((it) => (
                <BackupRow key={it.id} item={it} onDelete={setDeleting} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 备份记录（分页） */}
      <div className="mt-4">
        <Card title={`备份记录（共 ${total} 条）`}>
          {rowsLoading ? (
            <PageLoading />
          ) : rowsFailed ? (
            <Empty
              title="备份记录加载失败"
              description="请检查网络后重试"
              action={
                <Button size="sm" variant="secondary" onClick={loadRows}>
                  重试
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <Empty title="暂无备份记录" />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((it) => (
                <BackupRow key={it.id} item={it} onDelete={setDeleting} />
              ))}
            </div>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="删除备份"
        message={`确定删除备份记录「${deleting?.file_path || ''}」吗？此操作不可恢复。`}
        onConfirm={removeBackup}
        onCancel={() => setDeleting(null)}
        confirmText="删除"
        loading={deletingLoading}
      />
    </DashboardShell>
  );
}

export default function AdminBackupPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BackupContent />
    </Suspense>
  );
}
