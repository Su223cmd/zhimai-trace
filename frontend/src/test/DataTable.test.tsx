import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DataTable from '../components/DataTable';

interface TestItem {
  id: number;
  name: string;
  status: string;
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '名称', dataIndex: 'name', key: 'name' },
];

const data: TestItem[] = [
  { id: 1, name: '测试1', status: '完成' },
  { id: 2, name: '测试2', status: '进行中' },
];

describe('DataTable', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <DataTable<TestItem>
        columns={columns}
        dataSource={data}
        rowKey="id"
        total={2}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders search input by default', () => {
    render(
      <DataTable<TestItem>
        columns={columns}
        dataSource={data}
        rowKey="id"
        total={2}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByPlaceholderText('搜索...')).toBeInTheDocument();
  });

  it('hides search when showSearch is false', () => {
    render(
      <DataTable<TestItem>
        columns={columns}
        dataSource={data}
        rowKey="id"
        total={2}
        pageSize={10}
        onPageChange={() => {}}
        showSearch={false}
      />
    );
    expect(screen.queryByPlaceholderText('搜索...')).not.toBeInTheDocument();
  });
});