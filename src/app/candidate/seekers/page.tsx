'use client';

import { useCallback, useEffect, useState } from 'react';
import { CandidateShell } from '@/components/layout/CandidateShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CitySelect } from '@/components/ui/CitySelect';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { JOB_TYPE_LABEL, EXPERIENCE_LABEL, formatDate } from '@/lib/utils';

interface SeekerPost {
  id: string;
  title: string;
  expected_salary_min?: number | null;
  expected_salary_max?: number | null;
  city?: string | null;
  job_type?: string | null;
  experience?: string | null;
  education?: string | null;
  skills?: string[];
  description?: string | null;
  show_phone: boolean;
  status: string;
  views: number;
  created_at: string;
}

interface PostForm {
  title: string;
  expected_salary_min: string;
  expected_salary_max: string;
  city: string;
  job_type: string;
  experience: string;
  education: string;
  skills: string;
  description: string;
  show_phone: boolean;
}

const emptyForm: PostForm = {
  title: '',
  expected_salary_min: '',
  expected_salary_max: '',
  city: '',
  job_type: '',
  experience: '',
  education: '',
  skills: '',
  description: '',
  show_phone: true,
};

export default function CandidateSeekersPage() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  const { toast } = useToast();
  const [posts, setPosts] = useState<SeekerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SeekerPost | null>(null);
  const [closing, setClosing] = useState<SeekerPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PostForm>(emptyForm);

  const load = useCallback(() => {
    setLoading(true);
    api.get<SeekerPost[]>('/api/seeker-posts/me').then((r) => {
      if (r.ok) setPosts(r.data);
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: SeekerPost) => {
    setEditing(p);
    setForm({
      title: p.title,
      expected_salary_min: p.expected_salary_min != null ? String(p.expected_salary_min) : '',
      expected_salary_max: p.expected_salary_max != null ? String(p.expected_salary_max) : '',
      city: p.city || '',
      job_type: p.job_type || '',
      experience: p.experience || '',
      education: p.education || '',
      skills: (p.skills || []).join(', '),
      description: p.description || '',
      show_phone: p.show_phone,
    });
    setOpen(true);
  };

  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return toast('error', '请输入求职标题');
    if (!form.city) return toast('error', '请选择城市');
    const payload = {
      title: form.title.trim(),
      expected_salary_min: form.expected_salary_min ? Number(form.expected_salary_min) : undefined,
      expected_salary_max: form.expected_salary_max ? Number(form.expected_salary_max) : undefined,
      city: form.city,
      job_type: form.job_type || undefined,
      experience: form.experience || undefined,
      education: form.education || undefined,
      skills: form.skills.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      description: form.description || undefined,
      show_phone: form.show_phone,
    };
    setSaving(true);
    const res = editing
      ? await api.put(`/api/seeker-posts/${editing.id}`, payload)
      : await api.post('/api/seeker-posts', payload);
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    toast('success', editing ? '已更新' : '已发布');
    setOpen(false);
    load();
  };

  const close = async () => {
    if (!closing) return;
    const res = await api.del(`/api/seeker-posts/${closing.id}`);
    if (!res.ok) return toast('error', res.error?.message || '关闭失败');
    toast('success', '已关闭');
    setClosing(null);
    load();
  };

  if (guarding) return <PageLoading />;

  return (
    <CandidateShell sub="我的求职信息">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">我的求职信息（{posts.length}）</h1>
        <Button size="sm" onClick={openCreate}>发布求职信息</Button>
      </div>

      {loading ? (
        <PageLoading />
      ) : posts.length === 0 ? (
        <Empty title="还没有求职信息" description="发布你的求职信息，让企业主动联系你" action={<Button size="sm" onClick={openCreate}>立即发布</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-text">{p.title}</h3>
                    <Badge tone={p.status === 'OPEN' ? 'success' : 'neutral'}>{p.status === 'OPEN' ? '展示中' : '已关闭'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {p.expected_salary_min != null && p.expected_salary_max != null
                      ? `${p.expected_salary_min}-${p.expected_salary_max}K · `
                      : ''}
                    {p.city}
                    {p.job_type ? ` · ${JOB_TYPE_LABEL[p.job_type] || p.job_type}` : ''}
                    {p.experience ? ` · ${EXPERIENCE_LABEL[p.experience] || p.experience}` : ''}
                    {p.education ? ` · ${p.education}` : ''}
                  </p>
                  {p.skills && p.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.skills.map((s) => (
                        <Badge key={s} tone="default">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>编辑</Button>
                  {p.status === 'OPEN' && (
                    <Button variant="ghost" size="sm" onClick={() => setClosing(p)}>关闭</Button>
                  )}
                </div>
              </div>
              {p.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{p.description}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-text-secondary/70">
                <span>{p.show_phone ? '已公开联系方式' : '联系方式保密'}</span>
                <span>{p.views} 浏览 · {formatDate(p.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 发布/编辑弹窗 */}
      <Modal
        open={open}
        title={editing ? '编辑求职信息' : '发布求职信息'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={submit} loading={saving}>{editing ? '保存' : '发布'}</Button>
          </>
        }
        width="max-w-2xl"
      >
        <div className="space-y-4">
          <Input label="标题" placeholder="如：资深前端开发求职" maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="期望月薪下限（K）" type="number" min={0} placeholder="如 15" value={form.expected_salary_min} onChange={(e) => set('expected_salary_min', e.target.value)} />
            <Input label="期望月薪上限（K）" type="number" min={0} placeholder="如 25" value={form.expected_salary_max} onChange={(e) => set('expected_salary_max', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CitySelect label="期望城市" value={form.city} onChange={(v) => set('city', v)} />
            <Select label="工作类型" value={form.job_type} onChange={(e) => set('job_type', e.target.value)}>
              <option value="">不限</option>
              {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Select label="工作经验" value={form.experience} onChange={(e) => set('experience', e.target.value)}>
              <option value="">不限</option>
              {Object.entries(EXPERIENCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="学历" placeholder="如：本科" maxLength={20} value={form.education} onChange={(e) => set('education', e.target.value)} />
            <Input label="技能（逗号分隔）" placeholder="如：React, TypeScript" value={form.skills} onChange={(e) => set('skills', e.target.value)} />
          </div>
          <Textarea label="自我描述" placeholder="介绍一下你的优势、经历…" rows={4} maxLength={5000} value={form.description} onChange={(e) => set('description', e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={form.show_phone} onChange={(e) => set('show_phone', e.target.checked)} className="h-4 w-4 accent-primary" />
            向企业公开我的联系方式
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!closing}
        title="关闭求职信息"
        message={`确定关闭「${closing?.title || ''}」吗？关闭后企业将无法再看到这条信息。`}
        onConfirm={close}
        onCancel={() => setClosing(null)}
        confirmText="关闭"
      />
    </CandidateShell>
  );
}
