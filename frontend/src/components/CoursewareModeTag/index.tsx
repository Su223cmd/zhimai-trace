import { Tag } from 'antd';

interface CoursewareModeTagProps {
  mode: 'template' | 'free';
}

const CoursewareModeTag = ({ mode }: CoursewareModeTagProps) => {
  return mode === 'template'
    ? <Tag color="success">模板模式 (确定性提取)</Tag>
    : <Tag color="warning">自由模式 (需教师确认)</Tag>;
};

export default CoursewareModeTag;
