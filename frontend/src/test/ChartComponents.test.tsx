import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

vi.mock('@ant-design/charts', () => {
  const MockChart = (_props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'mock-chart' }, 'Chart');
  return { Line: MockChart, Heatmap: MockChart, Column: MockChart };
});

import TrendChart from '../components/TrendChart';
import MasteryHeatmap from '../components/MasteryHeatmap';
import ForgettingCurve from '../components/ForgettingCurve';
import MasteryTrajectory from '../components/MasteryTrajectory';

describe('TrendChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TrendChart
        data={[
          { time: '2024-01', value: 80 },
          { time: '2024-02', value: 85 },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe('MasteryHeatmap', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MasteryHeatmap
        data={[
          { student: 'S1', kp: 'KP1', mastery: 0.8 },
          { student: 'S2', kp: 'KP1', mastery: 0.6 },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe('ForgettingCurve', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ForgettingCurve
        data={[
          { day: 1, mastery: 0.9 },
          { day: 3, mastery: 0.7 },
          { day: 7, mastery: 0.5 },
        ]}
        halfLifeDays={7}
        finalMastery={0.3}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe('MasteryTrajectory', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MasteryTrajectory
        data={[
          { time: '2024-01', mastery: 0.7, kpName: '知识点1' },
          { time: '2024-02', mastery: 0.8, kpName: '知识点1' },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });
});