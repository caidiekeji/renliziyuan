'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CitySelect } from '@/components/ui/CitySelect';
import { IndustrySelect } from '@/components/ui/IndustrySelect';
import { JobTitleSelect } from '@/components/ui/JobTitleSelect';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { type JobItem, type City } from '@/lib/company';
import { JOB_TYPE_LABEL, EXPERIENCE_LABEL } from '@/lib/utils';

interface FormState {
  title: string;
  description: string;
  salary_min: string;
  salary_max: string;
  salary_unit: string;
  city: string;
  industry_id: string | null;
  job_title_id: string | null;
  job_type: string;
  experience: string;
  education: string;
  tags: string[];
  is_featured: boolean;
  is_hourly: boolean;
  hourly_rate: string;
  work_period: string;
  slots: string;
  lat: string;
  lng: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  salary_min: '',
  salary_max: '',
  salary_unit: 'MONTH_K',
  city: '',
  industry_id: null,
  job_title_id: null,
  job_type: 'FULL_TIME',
  experience: '',
  education: '',
  tags: [],
  is_featured: false,
  is_hourly: false,
  hourly_rate: '',
  work_period: '',
  slots: '',
  lat: '',
  lng: '',
};

const EDUCATION_OPTIONS = ['不限', '大专', '本科', '硕士', '博士'];

function toForm(j: JobItem): FormState {
  return {
    title: j.title || '',
    description: j.description || '',
    salary_min: j.salary_min != null ? String(j.salary_min) : '',
    salary_max: j.salary_max != null ? String(j.salary_max) : '',
    salary_unit: j.salary_unit || 'MONTH_K',
    city: j.city || '',
    industry_id: j.industry_id || null,
    job_title_id: j.job_title_id || null,
    job_type: j.job_type || 'FULL_TIME',
    experience: j.experience || '',
    education: j.education || '',
    tags: j.tags || [],
    is_featured: !!j.is_featured,
    is_hourly: !!j.is_hourly,
    hourly_rate: j.hourly_rate != null ? String(j.hourly_rate) : '',
    work_period: j.work_period || '',
    slots: j.slots != null ? String(j.slots) : '',
    lat: j.lat != null ? String(j.lat) : '',
    lng: j.lng != null ? String(j.lng) : '',
  };
}

/** 发布/编辑职位表单（复用） */
export function JobForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: JobItem | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => (initial ? toForm(initial) : EMPTY_FORM));
  const [cities, setCities] = useState<City[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<City[]>('/api/cities').then((r) => r.ok && setCities(r.data));
    api.get<{ id: string; name: string }[]>('/api/job-tags').then((r) => r.ok && setAvailableTags(r.data));
  }, []);

  useEffect(() => {
    if (initial) setForm(toForm(initial));
  }, [initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onCityChange = (name: string) => {
    const c = cities.find((x) => x.name === name);
    setForm((f) => ({
      ...f,
      city: name,
      lat: c ? String(c.lat) : f.lat,
      lng: c ? String(c.lng) : f.lng,
    }));
  };

  const submit = async () => {
    if (!form.title.trim()) return toast('error', '请填写职位名称');
    if (form.description.trim().length < 10) return toast('error', '职位描述至少 10 个字');
    if (!form.city) return toast('error', '请选择工作城市');
    if (form.salary_min && form.salary_max && Number(form.salary_max) < Number(form.salary_min)) {
      return toast('error', '最高薪资不能低于最低薪资');
    }
    if (form.is_hourly) {
      if (!form.hourly_rate || Number(form.hourly_rate) <= 0) return toast('error', '小时工需填写时薪（元/小时）');
      const wp = form.work_period.trim();
      if (!wp || !/^(?=.*[一-龥\d:\-—~至])/.test(wp)) return toast('error', '工作时段须含中文或时间格式（如"每天 9:00-18:00"）');
      if (!form.slots || Number(form.slots) < 1) return toast('error', '小时工需填写招聘人数');
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      salary_min: form.is_hourly ? undefined : form.salary_min ? Number(form.salary_min) : undefined,
      salary_max: form.is_hourly ? undefined : form.salary_max ? Number(form.salary_max) : undefined,
      salary_unit: form.salary_unit,
      city: form.city,
      industry_id: form.industry_id || undefined,
      job_title_id: form.job_title_id || undefined,
      job_type: form.job_type,
      experience: form.experience || undefined,
      education: form.education || undefined,
      tags: form.tags,
      is_featured: form.is_featured,
      is_hourly: form.is_hourly,
      hourly_rate: form.is_hourly ? Number(form.hourly_rate) : undefined,
      work_period: form.is_hourly ? form.work_period.trim() : undefined,
      slots: form.is_hourly ? Number(form.slots) : undefined,
      lat: form.lat ? Number(form.lat) : undefined,
      lng: form.lng ? Number(form.lng) : undefined,
    };

    setSaving(true);
    const res =
      mode === 'create' ? await api.post('/api/jobs', payload) : await api.put(`/api/jobs/${initial?.id}`, payload);
    setSaving(false);

    if (!res.ok) {
      if (res.error?.error === 'JOB_LIMIT_EXCEEDED') {
        toast('error', `${res.error.message}，可在「会员与账单」升级套餐`);
      } else if (res.error?.error === 'FEATURE_NOT_ALLOWED') {
        toast('error', '当前套餐不支持置顶，可在「会员与账单」升级套餐');
      } else {
        toast('error', res.error?.message || (mode === 'create' ? '发布失败' : '保存失败'));
      }
      return;
    }
    toast('success', mode === 'create' ? '职位已发布' : '职位已保存');
    router.push('/company/jobs');
  };

  return (
    <div className="card p-5">
      <div className="space-y-4">
        <Input label="职位名称" placeholder="如：资深前端工程师" maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">职位名称（分类）</label>
          <JobTitleSelect value={form.job_title_id} onChange={(v) => set('job_title_id', v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="薪资下限" type="number" min={0} placeholder="如 10" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} />
          <Input label="薪资上限" type="number" min={0} placeholder="如 20" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="薪资单位" value={form.salary_unit} onChange={(e) => set('salary_unit', e.target.value)}>
            <option value="MONTH_K">月薪（K）</option>
            <option value="DAY_YUAN">日薪（元/天）</option>
            <option value="HOUR_YUAN">时薪（元/小时）</option>
          </Select>
          <div>
            <CitySelect label="工作城市" value={form.city} onChange={onCityChange} />
          </div>
          <Select label="工作类型" value={form.job_type} onChange={(e) => set('job_type', e.target.value)}>
            {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">所属行业</label>
            <IndustrySelect value={form.industry_id} onChange={(v) => set('industry_id', v)} />
          </div>
          <Select label="经验要求" value={form.experience} onChange={(e) => set('experience', e.target.value)}>
            <option value="">不限</option>
            {Object.entries(EXPERIENCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select label="学历要求" value={form.education} onChange={(e) => set('education', e.target.value)}>
            <option value="">不限</option>
            {EDUCATION_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">职位标签</label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const selected = form.tags.includes(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    set('tags', selected ? form.tags.filter((t) => t !== tag.name) : [...form.tags, tag.name])
                  }
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    selected
                      ? 'border-primary bg-primary-soft text-primary font-medium'
                      : 'border-border text-text-secondary hover:border-primary/40'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
            {availableTags.length === 0 && <span className="text-sm text-text-secondary">加载中…</span>}
          </div>
        </div>
        <Textarea
          label="职位描述"
          placeholder="详细介绍岗位职责、任职要求、福利待遇…"
          rows={6}
          maxLength={20000}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} className="h-4 w-4 accent-primary" />
          置顶推荐（需套餐支持）
        </label>
        {/* 移动端 sticky 提交栏（底部 Tab 之上），桌面回到正常流 */}
        <div className="sticky bottom-24 z-10 border-t border-border bg-white pt-3 lg:static lg:border-0 lg:pt-0">
          <div className="flex gap-2">
            <Button onClick={submit} loading={saving}>
              {mode === 'create' ? '发布职位' : '保存修改'}
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              取消
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
