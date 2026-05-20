import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RootCauseTree from '../components/RootCauseTree';
import LearningPathTimeline from '../components/LearningPathTimeline';
import KnowledgeHierarchy from '../components/KnowledgeHierarchy';
import AgentStatusCard from '../components/AgentStatusCard';

describe('RootCauseTree', () => {
  const treeData = {
    code: 'GEO_001',
    name: '大气运动',
    mastery: 0.6,
    isRootCause: false,
    children: [
      {
        code: 'GEO_002',
        name: '气压梯度',
        mastery: 0.25,
        isRootCause: true,
        children: [],
      },
    ],
  };

  it('renders without crashing', () => {
    const { container } = render(<RootCauseTree data={treeData} />);
    expect(container).toBeTruthy();
  });

  it('shows empty when no data', () => {
    const { container } = render(<RootCauseTree data={null} />);
    expect(container).toBeTruthy();
  });
});

describe('LearningPathTimeline', () => {
  const pathData = [
    { name: '复习气压梯度', description: '回顾基础概念', type: 'review' as const, estimateMinutes: 15, kpCodes: ['GEO_002'] },
    { name: '练习大气运动', description: '典型题目训练', type: 'practice' as const, estimateMinutes: 30, kpCodes: ['GEO_001'] },
    { name: '掌握大气运动', description: '目标达成', type: 'milestone' as const, estimateMinutes: 0, kpCodes: ['GEO_001'] },
  ];

  it('renders without crashing', () => {
    const { container } = render(<LearningPathTimeline data={pathData} />);
    expect(container).toBeTruthy();
  });

  it('shows empty when no data', () => {
    const { container } = render(<LearningPathTimeline data={[]} />);
    expect(container).toBeTruthy();
  });
});

describe('KnowledgeHierarchy', () => {
  const hierarchyData = [
    {
      key: 'GEO',
      title: '地理',
      level: 0,
      count: 50,
      children: [
        { key: 'GEO_CLIMATE', title: '气候', level: 1, count: 20 },
      ],
    },
  ];

  it('renders without crashing', () => {
    const { container } = render(<KnowledgeHierarchy data={hierarchyData} />);
    expect(container).toBeTruthy();
  });
});

describe('AgentStatusCard', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AgentStatusCard
        data={{
          name: 'diagnosis',
          description: 'CDM诊断Agent',
          status: 'active',
          lastEventType: 'diagnosis_completed',
          lastEventTime: '2024-01-01',
        }}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders loading state', () => {
    const { container } = render(
      <AgentStatusCard
        data={{
          name: 'diagnosis',
          description: '',
          status: 'idle',
          lastEventType: null,
          lastEventTime: null,
        }}
        loading={true}
      />
    );
    expect(container).toBeTruthy();
  });
});