import { Line } from '@ant-design/charts';
import { Spin, Empty, Typography } from 'antd';
import { useMemo } from 'react';

interface TrendChartProps {
  data: { time: string; value: number; category?: string }[];
  loading?: boolean;
  title?: string;
  xField?: string;
  yField?: string;
  seriesField?: string;
  height?: number;
  smooth?: boolean;
  yLabel?: string;
  showAnnotation?: boolean;
}

function TrendChart({
  data,
  loading = false,
  title,
  xField = 'time',
  yField = 'value',
  seriesField,
  height = 300,
  smooth = true,
  yLabel,
}: TrendChartProps) {
  const config = useMemo(() => {
    if (!data || data.length === 0) return null;

    return {
      data,
      xField,
      yField,
      seriesField,
      smooth,
      height,
      animation: { appear: { animation: 'wave-in', duration: 800 } },
      yAxis: yLabel ? { title: { text: yLabel } } : undefined,
      legend: seriesField ? { position: 'top' as const } : false,
      tooltip: { shared: true, showCrosshairs: true },
      point: { size: 3, shape: 'circle' },
      lineStyle: { lineWidth: 2 },
      color: seriesField
        ? undefined
        : ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'],
    };
  }, [data, xField, yField, seriesField, smooth, height, yLabel]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: height / 2 }}>
        <Spin />
      </div>
    );
  }

  if (!config || data.length === 0) {
    return <Empty description="暂无趋势数据" style={{ padding: 40 }} />;
  }

  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <Line {...config} />
    </div>
  );
}

export type { TrendChartProps };
export default TrendChart;