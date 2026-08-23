'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ProvinceDatum {
  name: string;
  value: number;
}

/** 将省份全称/简称统一为短名，用于与 ECharts 地图要素匹配 */
function normalize(name: string): string {
  return name
    .replace(/特别行政区$/, '')
    .replace(/(维吾尔|壮族|回族)?自治区$/, '')
    .replace(/[省市]$/, '');
}

export function ChinaMap({ data, height = 420 }: { data: ProvinceDatum[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let disposed = false;
    (async () => {
      let geo: any;
      try {
        const res = await fetch('/geo/china.json');
        if (!res.ok) return;
        geo = await res.json();
      } catch {
        return;
      }
      if (disposed || !ref.current) return;

      echarts.registerMap('china', geo);

      const nameIndex = new Map<string, string>();
      (geo.features || []).forEach((f: any) => {
        const n = f.properties?.name;
        if (n) nameIndex.set(normalize(n), n);
      });

      const values = data
        .map((d) => ({ name: nameIndex.get(normalize(d.name)) || d.name, value: d.value }))
        .filter((d) => d.value > 0);

      const chart = echarts.init(ref.current);
      chartRef.current = chart;
      chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => `${p.name}：${p.value ?? 0} 次访问`,
        },
        visualMap: {
          min: 0,
          max: Math.max(1, ...values.map((v) => v.value)),
          left: 12,
          bottom: 12,
          text: ['高', '低'],
          calculable: true,
          inRange: { color: ['#e3f3ee', '#12a780', '#0e7b63'] },
        },
        series: [
          {
            name: '访问分布',
            type: 'map',
            map: 'china',
            roam: true,
            label: { show: false },
            emphasis: { label: { show: true, color: '#0e7b63' }, itemStyle: { areaColor: '#12a780' } },
            itemStyle: { borderColor: '#ffffff', borderWidth: 1, areaColor: '#e5e7eb' },
            data: values,
          },
        ],
      });
    })();

    return () => {
      disposed = true;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <div ref={ref} style={{ width: '100%', height }} />;
}