'use client';

import { useEffect, useState } from 'react';
import { CandidateShell } from '@/components/layout/CandidateShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CitySelect } from '@/components/ui/CitySelect';
import { PageLoading } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAuth, type Me } from '@/lib/auth-context';
import { useRoleGuard } from '@/lib/route-guard';

interface ProfileForm {
  name: string;
  avatar: string;
  bio: string;
  title: string;
  city: string;
  skills: string;
}

export default function CandidateProfilePage() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<ProfileForm>({ name: '', avatar: '', bio: '', title: '', city: '', skills: '' });
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Me>('/api/me').then((r) => {
      if (r.ok) {
        setForm({
          name: r.data.name || '',
          avatar: r.data.avatar || '',
          bio: r.data.bio || '',
          title: r.data.title || '',
          city: r.data.city || '',
          skills: (r.data.skills || []).join(', '),
        });
      }
      setLoading(false);
    });
  }, []);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return toast('error', '请输入姓名');
    setSaving(true);
    const res = await api.put('/api/me', {
      name: form.name.trim(),
      avatar: form.avatar.trim() || undefined,
      bio: form.bio || undefined,
      title: form.title || undefined,
      city: form.city || undefined,
      skills: form.skills.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    });
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '保存失败');
    await refresh();
    toast('success', '资料已保存');
  };

  if (guarding) return <PageLoading />;

  return (
    <CandidateShell sub="编辑资料">
      <Card title="基本资料">
        <div className="max-w-2xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="姓名" maxLength={50} value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label="职位头衔" placeholder="如：高级前端工程师" maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CitySelect label="所在城市" value={form.city} onChange={(v) => set('city', v)} />
            <Input label="头像 URL" placeholder="https://…" maxLength={500} value={form.avatar} onChange={(e) => set('avatar', e.target.value)} />
          </div>
          <Input label="技能（逗号分隔）" placeholder="如：React, TypeScript, Node.js" value={form.skills} onChange={(e) => set('skills', e.target.value)} />
          <Textarea label="个人简介" placeholder="介绍你的经历、优势与求职意向…" rows={5} maxLength={2000} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button onClick={submit} loading={saving}>保存</Button>
          </div>
        </div>
      </Card>
    </CandidateShell>
  );
}
