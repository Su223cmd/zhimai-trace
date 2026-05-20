import { Line } from '@ant-design/charts';
import { Spin, Empty, Typography, Card, Statistic, Row, Col } from 'antd';
import { useMemo } from 'react';

interface ForgettingPoint {
  day: number;
  mastery: number;
}

interface ForgettingCurveProps {
  data: ForgettingPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
  halfLifeDays?: number;
  finalMastery?: number;
}

function ForgettingCurve({
  data,
  loading = false,
  title,
  height = 300,
  halfLifeDays,
  finalMastery,
}: ForgettingCurveProps) {
  const config = useMemo(() => {
    if (!data || data.length === 0) return null;

    const maxMastery = Math.max(...data.map((d) => d.mastery));
    const halfLine = maxMastery * 0.5;

    return {
      data,
      xField: 'day',
      yField: 'mastery',
      height,
      smooth: true,
      animation: { appear: { animation: 'wave-in', duration: 1000 } },
      yAxis: {
        title: { text: '掌握率' },
        label: { formatter: (v: string) => `${(Number(v) * 100).toFixed(0)}%` },
        max: 1,
        min: 0,
      },
      xAxis: {
        title: { text: '天数' },
      },
      tooltip: {
        formatter: (datum: ForgettingPoint) => ({
          name: '掌握率',
          value: `${(datum.mastery * 100).toFixed(1)}%`,
        }),
      },
      lineStyle: { lineWidth: 3, stroke: '#1677ff' },
      point: { size: 4, shape: 'circle' },
      annotations: halfLine
        ? [
            {
              type: 'line' as const,
              yField: halfLine,
              style: { stroke: '#faad14', lineDash: [4, 4], lineWidth: 2 },
              text: {
                content: `半衰期线 (${(halfLine * 100).toFixed(0)}%)`,
                position: 'end' as const,
                autoRotate: false,
                style: { fill: '#faad14' },
              },
            },
          ]
        : [],
    };
  }, [data, height]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: height / 2 }} />;
  }

  if (!config || data.length === 0) {
    return <Empty description="暂无遗忘曲线数据" style={{ padding: 40 }} />;
  }

  return (
    <div>
      {title && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      )}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {halfLifeDays !== undefined && (
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="知识半衰期"
                value={halfLifeDays}
                suffix="天"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        )}
        {finalMastery !== undefined && (
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="最终掌握率"
                value={(finalMastery * 100).toFixed(1)}
                suffix="%"
                valueStyle={{
                  color: finalMastery > 0.5 ? '#52c41a' : '#ff4d4f',
                }}
              />
            </Card>
          </Col>
        )}
      </Row>
      <Line {...config} />
    </div>
  );
}

export type { ForgettingPoint, ForgettingCurveProps };
export default ForgettingCurve;