import { Tag } from 'antd';
import type { TagProps } from 'antd';

interface ExamMethodTagProps extends TagProps {
  method: string;
  type?: 'knowledge' | 'ability' | 'application' | 'synthesis';
  size?: 'small' | 'default';
}

const typeColors: Record<string, string> = {
  knowledge: 'blue',
  ability: 'green',
  application: 'orange',
  synthesis: 'volcano',
};

const typeLabels: Record<string, string> = {
  knowledge: '识记',
  ability: '理解',
  application: '应用',
  synthesis: '综合',
};

function ExamMethodTag({ method, type = 'knowledge', size = 'default', ...tagProps }: ExamMethodTagProps) {
  return (
    <Tag color={typeColors[type]} {...tagProps} style={{ fontSize: size === 'small' ? 11 : undefined }}>
      {typeLabels[type]}：{method}
    </Tag>
  );
}

export default ExamMethodTag;