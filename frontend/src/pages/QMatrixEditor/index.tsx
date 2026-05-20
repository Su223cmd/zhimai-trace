import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Card, Select, Button, Space, Table, Tag, Spin, Empty, Flex, message,
} from 'antd';
import {
  TableOutlined, CheckOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useHomeworkStore } from '../../stores/useHomeworkStore';
import { homeworkApi } from '../../services/homework';
import type { QMatrixResponse, QMatrixRow } from '../../types';

const QMatrixEditor = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [homeworkId, setHomeworkId] = useState('');
  const [qMatrix, setQMatrix] = useState<QMatrixResponse | null>(null);
  const { homeworks, fetchHomeworks } = useHomeworkStore();

  useEffect(() => {
    fetchHomeworks();
  }, [fetchHomeworks]);

  useEffect(() => {
    const urlId = searchParams.get('homeworkId');
    if (urlId) {
      setHomeworkId(urlId);
    } else if (homeworks.length > 0 && !homeworkId) {
      setHomeworkId(homeworks[0].id);
    }
  }, [homeworks, searchParams]);

  useEffect(() => {
    if (homeworkId) handleLoad();
  }, [homeworkId]);

  const handleGenerate = async () => {
    if (!homeworkId) return;
    setLoading(true);
    try {
      const res = await homeworkApi.generateQMatrix(homeworkId);
      message.success(`Q矩阵生成成功: ${res.n_questions} 道题目`);
      const mapped: QMatrixResponse = {
        status: res.status,
        homework_id: res.homework_id,
        kp_codes: res.kp_codes,
        kp_names: res.kp_names,
        questions: res.q_matrix.map((row, i) => ({
          question_id: `q_${i + 1}`,
          seq: i + 1,
          content: `题目 ${i + 1}`,
          q_vector: row,
          confirmed: false,
        })),
      };
      setQMatrix(mapped);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || 'Q矩阵生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!homeworkId) return;
    setLoading(true);
    try {
      const res = await homeworkApi.getQMatrix(homeworkId);
      setQMatrix(res);
    } catch {
      setQMatrix(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!homeworkId || !qMatrix) return;
    setConfirming(true);
    try {
      const adjustments: Record<string, Record<string, number>> = {};
      qMatrix.questions.forEach((q) => {
        const kpAdjustments: Record<string, number> = {};
        qMatrix.kp_codes.forEach((kpCode, kpIdx) => {
          if (q.q_vector[kpIdx] === 1) {
            kpAdjustments[kpCode] = 1;
          }
        });
        if (Object.keys(kpAdjustments).length > 0) {
          adjustments[q.question_id] = kpAdjustments;
        }
      });
      await homeworkApi.confirmQMatrix(homeworkId, adjustments);
      message.success('Q矩阵确认成功');
      setQMatrix(prev => prev ? { ...prev, questions: prev.questions.map(q => ({ ...q, confirmed: true })) } : null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || 'Q矩阵确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const toggleCell = (rowIdx: number, colIdx: number) => {
    if (!qMatrix) return;
    const updated = { ...qMatrix };
    const row = { ...updated.questions[rowIdx] };
    const newVector = [...row.q_vector];
    newVector[colIdx] = newVector[colIdx] === 1 ? 0 : 1;
    row.q_vector = newVector;
    const newQuestions = [...updated.questions];
    newQuestions[rowIdx] = row;
    updated.questions = newQuestions;
    setQMatrix(updated);
  };

  const columns = qMatrix
    ? [
        {
          title: '#',
          width: 50,
          render: (_: unknown, __: unknown, idx: number) => idx + 1,
        },
        {
          title: '题目',
          dataIndex: 'content',
          key: 'content',
          width: 200,
          ellipsis: true,
        },
        ...qMatrix.kp_codes.map((kpCode, colIdx) => ({
          title: (
            <div style={{ fontSize: 11, whiteSpace: 'normal', textAlign: 'center' as const }}>
              {qMatrix.kp_names[colIdx] || kpCode}
            </div>
          ),
          key: kpCode,
          width: 60,
          render: (_: unknown, record: QMatrixRow, rowIdx: number) => {
            const val = record.q_vector[colIdx];
            return (
              <div
                onClick={() => toggleCell(rowIdx, colIdx)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: val ? '#fff' : '#999',
                  background: val ? '#1677ff' : '#f5f5f5',
                  borderRadius: 4,
                  lineHeight: '24px',
                  userSelect: 'none',
                }}
              >
                {val}
              </div>
            );
          },
        })),
        {
          title: '状态',
          dataIndex: 'confirmed',
          key: 'confirmed',
          width: 80,
          render: (confirmed: boolean) => (
            <Tag color={confirmed ? 'green' : 'orange'}>
              {confirmed ? '已确认' : '待确认'}
            </Tag>
          ),
        },
      ]
    : [];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Q矩阵编辑</Typography.Title>
          <Typography.Text type="secondary">题目-知识点关联矩阵，定义每道题考查哪些知识点</Typography.Text>
        </div>
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Typography.Text>作业:</Typography.Text>
          <Select
            showSearch
            placeholder="选择作业"
            value={homeworkId || undefined}
            onChange={setHomeworkId}
            style={{ width: 300 }}
            options={homeworks.map(hw => ({ value: hw.id, label: `${hw.title} (${hw.id.slice(0, 8)}...)` }))}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false}
          />
          <Button
            icon={<ExperimentOutlined />}
            loading={loading}
            onClick={handleGenerate}
            disabled={!homeworkId}
          >
            重新生成
          </Button>
          <Button
            icon={<TableOutlined />}
            onClick={handleLoad}
            disabled={!homeworkId}
          >
            加载已有
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {!qMatrix ? (
          <Card>
            <Empty description={homeworkId ? "该作业暂无Q矩阵数据" : "请选择作业"} />
          </Card>
        ) : (
          <>
            <Card
              title={
                <Flex justify="space-between" align="center">
                  <span>Q矩阵 ({qMatrix.questions.length} 题目 x {qMatrix.kp_codes.length} 知识点)</span>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={confirming}
                    onClick={handleConfirm}
                  >
                    确认Q矩阵
                  </Button>
                </Flex>
              }
            >
              <Table
                dataSource={qMatrix.questions}
                rowKey="question_id"
                columns={columns}
                pagination={false}
                size="small"
                scroll={{ x: qMatrix.kp_codes.length * 60 + 330 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </>
  );
};

export default QMatrixEditor;
