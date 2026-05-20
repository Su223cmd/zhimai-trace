import { Line } from '@ant-design/charts';
import { Spin, Empty, Typography, Tag, Space } from 'antd';
import { useMemo } from 'react';

interface TrajectoryPoint {
  time: string;
  kpName: string;
  mastery: number;
}

interface MasteryTrajectoryProps {
  data: TrajectoryPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
}

function MasteryTrajectory({
  data,
  loading = false,
  title,
  height = 350,
}: MasteryTrajectoryProps) {
  const uniqueKps = useMemo(
    () => [...new Set(data.map((d) => d.kpName))],
    [data],
  );

  const config = useMemo(() => {
    if (!data || data.length === 0) return null;

    return {
      data,
      xField: 'time',
      yField: 'mastery',
      seriesField: 'kpName',
      height,
      smooth: true,
      animation: { appear: { animation: 'wave-in', duration: 1000 } },
      yAxis: {
        title: { text: '掌握率' },
        max: 1,
        min: 0,
        label: { formatter: (v: string) => `${(Number(v) * 100).toFixed(0)}%` },
      },
      legend: { position: 'bottom' as const },
      tooltip: { shared: true, showCrosshairs: true },
      point: { size: 3, shape: 'circle' },
      lineStyle: { lineWidth: 2 },
      color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'],
    };
  }, [data, height]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: height / 2 }} />;
  }

  if (!config || data.length === 0) {
    return <Empty description="暂无掌握轨迹数据" style={{ padding: 40 }} />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        {title && <Typography.Title level={5} style={{ margin: 0 }}>{title}</Typography.Title>}
        <Space size={4}>
          {uniqueKps.slice(0, 5).map((kp) => (
            <Tag key={kp} color="blue">{kp}</Tag>
          ))}
          {uniqueKps.length > 5 && <Tag>+{uniqueKps.length - 5}</Tag>}
        </Space>
      </Space>
      <Line {...config} />
    </div>
  );
}

export type { TrajectoryPoint, MasteryTrajectoryProps };
export default MasteryTrajectory;