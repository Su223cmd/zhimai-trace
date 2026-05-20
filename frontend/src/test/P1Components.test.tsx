import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProjectSelector from '../components/ProjectSelector';
import StudentCard from '../components/StudentCard';
import ExamPointList from '../components/ExamPointList';
import ExamMethodTag from '../components/ExamMethodTag';
import DiagnosisReport from '../components/DiagnosisReport';
import AgentMessageFlow from '../components/AgentMessageFlow';

describe('ProjectSelector', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProjectSelector />);
    expect(container).toBeTruthy();
  });
});

describe('StudentCard', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <StudentCard
        studentId="S001"
        studentName="张三"
        className="高一(1)班"
        weakKpCount={3}
        totalKpCount={10}
        avgMastery={72}
        status="warning"
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders loading state', () => {
    const { container } = render(<StudentCard studentId="S001" loading={true} />);
    expect(container).toBeTruthy();
  });
});

describe('ExamPointList', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ExamPointList
        data={[
          { id: '1', name: '大气运动', description: '大气运动基础', frequency: 'high', difficulty: 3, relatedQuestions: 12 },
          { id: '2', name: '气压梯度', description: '气压梯度力', frequency: 'medium', difficulty: 4, relatedQuestions: 8 },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe('ExamMethodTag', () => {
  it('renders without crashing', () => {
    const { container } = render(<ExamMethodTag method="识记" />);
    expect(container).toBeTruthy();
  });

  it('renders different types', () => {
    const types = ['knowledge', 'ability', 'application', 'synthesis'] as const;
    for (const t of types) {
      const { container } = render(<ExamMethodTag method="test" type={t} />);
      expect(container).toBeTruthy();
    }
  });
});

describe('DiagnosisReport', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <DiagnosisReport
        data={{
          studentName: '张三',
          className: '高一(1)班',
          homeworkTitle: '期中测试',
          diagnosisDate: '2024-01-15',
          overallMastery: 0.65,
          totalKp: 10,
          masteredKp: 7,
          weakKpCount: 3,
          rootCauseCount: 1,
          recommendations: ['建议复习气压梯度基础概念'],
        }}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders null data', () => {
    const { container } = render(<DiagnosisReport data={null} />);
    expect(container).toBeTruthy();
  });
});

describe('AgentMessageFlow', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AgentMessageFlow
        data={[
          {
            id: '1',
            from: 'knowledge',
            to: 'diagnosis',
            type: 'graph_updated',
            timestamp: '2024-01-01T10:00:00',
            summary: '知识图谱已更新',
          },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders empty state', () => {
    const { container } = render(<AgentMessageFlow data={[]} />);
    expect(container).toBeTruthy();
  });
});