import { useState, useEffect } from 'react';
import {
  Typography, Card, Spin, Tag, Space, Timeline, List, Empty, Flex, Row, Col,
} from 'antd';
import { ArrowLeftOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { knowledgeApi } from '../../services/api';
import type { TraceResult, RelatedEntity } from '../../types';

const KnowledgeDetail = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [related, setRelated] = useState<RelatedEntity[]>([]);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      knowledgeApi.trace(code).catch(() => null),
      knowledgeApi.related(code).then(r => r.related).catch(() => []),
    ])
      .then(([traceResult, relatedResult]) => {
        if (traceResult) setTrace(traceResult);
        setRelated(relatedResult as RelatedEntity[]);
      })
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Space>
          <Typography.Link onClick={() => navigate('/knowledge-center')}>
            <ArrowLeftOutlined /> 返回图谱
          </Typography.Link>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {code}
            </Typography.Title>
            <Typography.Text type="secondary">知识点详情与关联分析</Typography.Text>
          </div>
        </Space>
      </Flex>

      <Spin spinning={loading}>
        {!trace ? (
          <Card>
            <Empty description="未找到该知识点的追溯信息" />
          </Card>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card title="前置知识链" size="small">
                  {trace.prerequisite_chains.length === 0 ? (
                    <Empty description="无前置链" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <Flex vertical gap={12}>
                      {trace.prerequisite_chains.map((chain, idx) => (
                        <Card key={idx} size="small" type="inner">
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            链 #{idx + 1} (深度: {chain.depth})
                          </Typography.Text>
                          <Timeline
                            style={{ marginTop: 4 }}
                            items={chain.chain.map((node) => ({
                              color: 'blue',
                              children: (
                                <Space>
                                  <ApartmentOutlined />
                                  <span>{node.name || node.code}</span>
                                  <Tag>{node.code}</Tag>
                                </Space>
                              ),
                            }))}
                          />
                        </Card>
                      ))}
                    </Flex>
                  )}
                </Card>
              </Col>

              <Col span={12}>
                <Card title="下游影响" size="small">
                  {trace.downstream.length === 0 ? (
                    <Empty description="无下游节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <>
                      <Typography.Text type="secondary">
                        影响 {trace.downstream_count} 个下游知识点:
                      </Typography.Text>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {trace.downstream.map(d => (
                          <Tag
                            key={d}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/knowledge-detail/${d}`)}
                          >
                            {d}
                          </Tag>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              </Col>
            </Row>

            {related.length > 0 && (
              <Card title="关联实体" size="small">
                <List
                  size="small"
                  dataSource={related}
                  renderItem={(entity: RelatedEntity) => (
                    <List.Item>
                      <Space>
                        <Tag color={entity.direction === 'outgoing' ? 'blue' : 'green'}>
                          {entity.direction === 'outgoing' ? '指向' : '来自'}
                        </Tag>
                        <Tag>{entity.type}</Tag>
                        <span>{entity.target || entity.source}</span>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          权重: {entity.weight.toFixed(2)} | 置信度: {entity.confidence.toFixed(2)}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </>
        )}
      </Spin>
    </>
  );
};

export default KnowledgeDetail;
