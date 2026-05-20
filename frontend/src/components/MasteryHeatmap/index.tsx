import { Heatmap } from '@ant-design/charts';
import { Spin, Empty, Typography } from 'antd';
import { useMemo } from 'react';

interface MasteryCell {
  student: string;
  kp: string;
  mastery: number;
}

interface MasteryHeatmapProps {
  data: MasteryCell[];
  loading?: boolean;
  title?: string;
  height?: number;
}

function MasteryHeatmap({
  data,
  loading = false,
  title,
  height = 400,
}: MasteryHeatmapProps) {
  const config = useMemo(() => {
    if (!data || data.length === 0) return null;

    return {
      data,
      xField: 'kp',
      yField: 'student',
      colorField: 'mastery',
      sizeField: 'mastery',
      height,
      color: ['#ff4d4f', '#faad14', '#ffe58f', '#a0d911', '#52c41a'],
      label: {
        style: {
          fill: '#000',
          fontSize: 11,
          textAlign: 'center',
        },
        formatter: (datum: MasteryCell) => `${(datum.mastery * 100).toFixed(0)}%`,
      },
      legend: {
        title: { text: '掌握率' },
        position: 'top' as const,
      },
      tooltip: {
        formatter: (datum: MasteryCell) => ({
          name: `${datum.student} - ${datum.kp}`,
          value: `${(datum.mastery * 100).toFixed(1)}%`,
        }),
      },
      xAxis: {
        title: { text: '知识点' },
        label: { autoRotate: true, autoHide: false },
      },
      yAxis: { title: { text: '学生' } },
    };
  }, [data, height]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: height / 2 }} />;
  }

  if (!config || data.length === 0) {
    return <Empty description="暂无掌握率数据" style={{ padding: 40 }} />;
  }

  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <Heatmap {...config} />
    </div>
  );
}

export type { MasteryCell, MasteryHeatmapProps };
export default MasteryHeatmap;