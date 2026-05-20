import { Table, Input, Button, Space } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useCallback } from 'react';

interface DataTableProps<T> {
  columns: ColumnsType<T>;
  dataSource: T[];
  loading?: boolean;
  rowKey?: string | ((record: T) => string);
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onSort?: (sorter: SorterResult<T>) => void;
  onFilter?: (filters: Record<string, FilterValue | null>) => void;
  onRefresh?: () => void;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showRefresh?: boolean;
}

function DataTable<T extends object>({
  columns,
  dataSource,
  loading = false,
  rowKey = 'id',
  total,
  pageSize = 10,
  onPageChange,
  onSort,
  onFilter,
  onRefresh,
  onSearch,
  searchPlaceholder = '搜索...',
  showSearch = true,
  showRefresh = true,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState('');

  const handleTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<T> | SorterResult<T>[],
    ) => {
      if (onFilter) onFilter(filters);
      if (onSort) onSort(sorter as SorterResult<T>);
      if (onPageChange && pagination.current && pagination.pageSize) {
        onPageChange(pagination.current, pagination.pageSize);
      }
    },
    [onFilter, onSort, onPageChange],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (onSearch) onSearch(value);
    },
    [onSearch],
  );

  return (
    <div>
      {(showSearch || showRefresh) && (
        <Space style={{ marginBottom: 16 }}>
          {showSearch && (
            <Input.Search
              placeholder={searchPlaceholder}
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 260 }}
            />
          )}
          {showRefresh && (
            <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
              刷新
            </Button>
          )}
        </Space>
      )}
      <Table<T>
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey={rowKey}
        pagination={{
          total: total ?? dataSource.length,
          pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}

export type { DataTableProps, ColumnsType, SorterResult, FilterValue };
export default DataTable;