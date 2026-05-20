import { useEffect } from 'react';
import { Select, Space, Tag, Typography } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Project } from '../../types';

interface ProjectSelectorProps {
  value?: string;
  onChange?: (project: Project | null) => void;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
  placeholder?: string;
  allowClear?: boolean;
}

const subjectLabels: Record<string, string> = {
  geography: '地理',
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  chinese: '语文',
  english: '英语',
};

function ProjectSelector({
  value,
  onChange,
  size = 'middle',
  style,
  placeholder = '选择项目',
  allowClear = false,
}: ProjectSelectorProps) {
  const { projects, currentProject, setCurrentProject, fetchProjects } = useProjectStore();

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, []);

  const currentValue = value ?? currentProject?.id;

  const handleChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId) || null;
    setCurrentProject(project);
    onChange?.(project);
  };

  const options = projects.map((p) => ({
    value: p.id,
    label: (
      <Space>
        <span>{p.name}</span>
        <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
          {subjectLabels[p.subject] || p.subject}
        </Tag>
        {p.grade && (
          <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{p.grade}</Tag>
        )}
      </Space>
    ),
  }));

  return (
    <Select
      prefix={<FolderOutlined />}
      value={currentValue}
      onChange={handleChange}
      options={options}
      size={size}
      style={style}
      placeholder={placeholder}
      allowClear={allowClear}
      notFoundContent={
        <Typography.Text type="secondary" style={{ padding: 8, display: 'block', textAlign: 'center' }}>
          暂无项目
        </Typography.Text>
      }
    />
  );
}

export type { ProjectSelectorProps };
export default ProjectSelector;