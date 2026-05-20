import { useState, useEffect } from 'react';
import {
  Empty, Card, Row, Col, Statistic, Typography, Flex, Select, Button,
  Space, Spin, Table, Descriptions,
} from 'antd';
import {
  ExperimentOutlined, AlertOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { diagnosisApi } from '../../services/diagnosis';
import { useHomeworkStore } from '../../stores/useHomeworkStore';
import type { CDMParams } from '../../types';

const DiagnosisDetail = () => {
  const [loading, setLoading] = useState(false);
  const [homeworkId, setHomeworkId] = useState('');
  const [cdmParams, setCdmParams] = useState<CDMParams | null>(null);
  const { homeworks, fetchHomeworks } = useHomeworkStore();

  useEffect(() => {
    fetchHomeworks();
  }, [fetchHomeworks]);

  useEffect(() => {
    if (homeworks.length > 0 && !homeworkId) {
      setHomeworkId(homeworks[0].id);
    }
  }, [homeworks]);

  useEffect(() => {
    if (homeworkId) {
      handleLoadCDM();
    }
  }, [homeworkId]);

  const handleLoadCDM = async () => {
    if (!homeworkId) return;
    setLoading(true);
    try {
      const params = await diagnosisApi.getCDMParams(homeworkId);
      setCdmParams(params);
    } catch {
      setCdmParams(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>诊断分析</Typography.Title>
          <Typography.Text type="secondary">CDM认知诊断参数与模型详情</Typography.Text>
        </div>
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        <Space>
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
            type="primary"
            icon={<ExperimentOutlined />}
            loading={loading}
            onClick={handleLoadCDM}
            disabled={!homeworkId}
          >
            刷新
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {!cdmParams ? (
          <Card>
            <Empty description={homeworkId ? "该作业暂无CDM参数" : "请选择作业"} />
          </Card>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card>
                  <Statistic title="学生数" value={cdmParams.alpha.student_ids.length} prefix={<ExperimentOutlined />} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="知识点数" value={cdmParams.alpha.kp_codes.length} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="AIC" value={cdmParams.aic} precision={2} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="收敛状态"
                    value={cdmParams.convergence_status === 'converged' ? '已收敛' : '未收敛'}
                    valueStyle={{ color: cdmParams.convergence_status === 'converged' ? '#3f8600' : '#cf1322' }}
                    prefix={cdmParams.convergence_status === 'converged' ? <CheckCircleOutlined /> : <AlertOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card title="Slip参数 (失误率)" size="small">
                  <Table
                    dataSource={cdmParams.slip.map((v, i) => ({ key: i, index: i + 1, kp: cdmParams.alpha.kp_codes[i], value: v }))}
                    pagination={false}
                    size="small"
                    scroll={{ y: 300 }}
                    columns={[
                      { title: '#', dataIndex: 'index', width: 50 },
                      { title: '知识点', dataIndex: 'kp', ellipsis: true },
                      { title: 'Slip', dataIndex: 'value', width: 100, render: (v: number) => v.toFixed(4) },
                    ]}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Guess参数 (猜测率)" size="small">
                  <Table
                    dataSource={cdmParams.guess.map((v, i) => ({ key: i, index: i + 1, kp: cdmParams.alpha.kp_codes[i], value: v }))}
                    pagination={false}
                    size="small"
                    scroll={{ y: 300 }}
                    columns={[
                      { title: '#', dataIndex: 'index', width: 50 },
                      { title: '知识点', dataIndex: 'kp', ellipsis: true },
                      { title: 'Guess', dataIndex: 'value', width: 100, render: (v: number) => v.toFixed(4) },
                    ]}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="模型信息" size="small">
              <Descriptions column={2}>
                <Descriptions.Item label="模型类型">{cdmParams.model_type}</Descriptions.Item>
                <Descriptions.Item label="参数ID">{cdmParams.cdm_params_id}</Descriptions.Item>
                <Descriptions.Item label="BIC">{cdmParams.bic.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="估计时间">{cdmParams.estimated_at ? new Date(cdmParams.estimated_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </>
        )}
      </Spin>
    </>
  );
};

export default DiagnosisDetail;
