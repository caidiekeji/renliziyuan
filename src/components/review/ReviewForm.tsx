'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { StarInput } from '@/components/ui/Rating';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

interface ReviewFormProps {
  open: boolean;
  onClose: () => void;
  /** 评价目标：COMPANY 或 CANDIDATE */
  targetType: 'COMPANY' | 'CANDIDATE';
  /** 普通职位：传 conversationId */
  conversationId?: string;
  /** 小时工：传 hourlyApplicationId */
  hourlyApplicationId?: string;
  /** 评价完成后回调 */
  onSubmitted?: () => void;
}

export function ReviewForm({ open, onClose, targetType, conversationId, hourlyApplicationId, onSubmitted }: ReviewFormProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!rating) return toast('error', '请选择评分');
    if (content.trim().length < 5) return toast('error', '评价内容至少5个字');
    setSubmitting(true);
    const res = await api.post('/api/reviews', {
      target_type: targetType,
      scope: hourlyApplicationId ? 'HOURLY' : 'JOB',
      conversation_id: conversationId,
      hourly_application_id: hourlyApplicationId,
      rating,
      content: content.trim(),
    });
    setSubmitting(false);
    if (!res.ok) return toast('error', res.error?.message || '提交失败');
    toast('success', '评价已提交');
    setRating(0);
    setContent('');
    onClose();
    onSubmitted?.();
  };

  return (
    <Modal
      open={open}
      title={`评价${targetType === 'COMPANY' ? '企业' : '求职者'}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>取消</Button>
          <Button onClick={submit} loading={submitting}>提交评价</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">评分</label>
          <StarInput value={rating} onChange={setRating} />
        </div>
        <Textarea
          label="评价内容"
          placeholder="请分享您的真实体验…"
          rows={4}
          maxLength={500}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <p className="text-xs text-text-secondary">评价提交后不可修改，请认真填写。</p>
      </div>
    </Modal>
  );
}
