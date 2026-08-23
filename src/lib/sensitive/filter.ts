import { prisma } from '@/lib/db/prisma';

const cache = new Map<string, { list: { word: string; scope: string }[]; at: number }>();
const TTL = 30_000;

async function loadWords(): Promise<{ word: string; scope: string }[]> {
  const hit = cache.get('words');
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  const rows = await prisma.sensitiveWord.findMany({ select: { word: true, scope: true } });
  const list = rows.map((r) => ({ word: r.word, scope: r.scope }));
  cache.set('words', { list, at: Date.now() });
  return list;
}

/** 敏感词过滤：返回命中词或 null */
export async function sensitiveWordFilter(scope: 'ALL' | 'JOB' | 'REVIEW' | 'CHAT', text: string): Promise<string | null> {
  if (!text) return null;
  const words = await loadWords();
  for (const { word, scope: s } of words) {
    if (s !== 'ALL' && s !== scope) continue;
    if (text.includes(word)) return word;
  }
  return null;
}
