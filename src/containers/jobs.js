import React, { useState } from 'react'
import { Table, Drawer, Form, Button, Col, Row, Space, Select, Tag, Spin } from 'antd'
import { useWebsocket } from '../utils'
import {
  PlusCircleOutlined,
  DeleteOutlined,
  RedoOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import moment from 'moment'

const { Option } = Select

const JobForm = (props) => {
  const [form] = Form.useForm()

  const onFinish = (data) => {
    form.resetFields()
    props.onCreate(data)
    props.onClose()
  }

  return (
    <Drawer
      title='Create a new job'
      width={720}
      onClose={props.onClose}
      visible={props.visible}
      bodyStyle={{ paddingBottom: 80 }}
      footer={(
        <div style={{ textAlign: 'right' }}>
          <Button onClick={() => { form.resetFields(); props.onClose() }} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button onClick={() => form.submit()} type='primary'>
            Create
          </Button>
        </div>
      )}
    >
      <Form form={form} onFinish={onFinish}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name='jobType' label='Job' rules={[{ required: true }]}>
              <Select allowClear>
                <Option value='index'>Index</Option>
                <Option value='move'>Move</Option>
                <Option value='copy'>Copy</Option>
                <Option value='removeRedundant'>Remove redundant files</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name='src' label='Backend' rules={[{ required: true }]}>
              <Select allowClear>
                {props.backends.map((backend) => <Option key={backend._id} value={backend._id}>{backend._id}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.jobType !== currentValues.jobType}>
              {({ getFieldValue }) => (
                ['move', 'copy'].indexOf(getFieldValue('jobType')) !== -1 ? (
                  <Form.Item name='dst' label='Dest' rules={[{ required: true }]}>
                    <Select allowClear>
                      {props.backends.map((backend) => <Option key={backend._id} value={backend._id}>{backend._id}</Option>)}
                    </Select>
                  </Form.Item>
                ) : null
              )}
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  )
}

const colorForState = (state) => ({
  queued: 'purple',
  running: 'blue',
  stopping: 'blue',
  stopped: 'green',
  pausing: 'blue',
  paused: 'blue',
  completed: 'green',
  failed: 'red',
  failedrestart: 'red'
})[state]

const allStates = ['completed', 'failed', 'failedrestart', 'paused', 'queued', 'running', 'stopped']
const canDelete = (state) => ['queued', 'completed', 'stopped', 'failed', 'failedrestart'].indexOf(state) !== -1
const canRestart = (state) => ['completed', 'stopped', 'failed', 'failedrestart'].indexOf(state) !== -1
const canPause = (state) => ['running'].indexOf(state) !== -1
const canResume = (state) => ['paused'].indexOf(state) !== -1
const canStopp = (state) => ['running'].indexOf(state) !== -1

export default (props) => {
  const [formVisible, setFormVisible] = useState(false)
  const { data, create, remove, update } = useWebsocket('jobs', { watch: true })
  const backends = useWebsocket('backends').data

  const columns = [
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'created',
      render: (value) => moment(value).format('DD.MM.YY hh:mm'),
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.createdAt - b.createdAt
    },
    {
      title: 'Type',
      dataIndex: 'jobType',
      key: 'type',
      filters: [
        { text: 'Index', value: 'index' },
        { text: 'Verify', value: 'verify' }
      ],
      onFilter: (value, record) => record.jobType === value
    },
    {
      title: 'Backend',
      dataIndex: 'src',
      key: 'src',
      filters: backends.map((backend) => ({ text: backend._id, value: backend._id })),
      onFilter: (value, record) => record.src === value
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (value) => <Tag color={colorForState(value)}>{value.toUpperCase()}</Tag>,
      filters: allStates.map((state) => ({ text: state, value: state })),
      onFilter: (value, record) => record.state === value
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        const { state, _id } = record
        const actions = []

        if (canDelete(state)) {
          actions.push(<Button key='delete' icon={<DeleteOutlined />} danger size='small' onClick={() => remove(_id)}>Delete</Button>)
        }

        if (canRestart(state)) {
          actions.push(<Button key='restart' icon={<RedoOutlined />} size='small' onClick={() => update(_id, { state: 'queued' })}>Restart</Button>)
        }

        if (canPause(state)) {
          actions.push(<Button key='restart' icon={<PauseCircleOutlined />} size='small' onClick={() => update(_id, { state: 'pausing' })}>Pause</Button>)
        }

        if (canResume(state)) {
          actions.push(<Button key='restart' icon={<PlayCircleOutlined />} size='small' onClick={() => update(_id, { state: 'resuming' })}>Resume</Button>)
        }

        if (canStopp(state)) {
          actions.push(<Button key='restart' icon={<StopOutlined />} size='small' onClick={() => update(_id, { state: 'stoping' })}>Stop</Button>)
        }

        return <Space>{actions}</Space>
      }
    }

  ]

  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Button icon={<PlusCircleOutlined />} type='dashed' onClick={() => setFormVisible(true)}>Add Job</Button>
      <JobForm visible={formVisible} onClose={() => setFormVisible(false)} onCreate={create} backends={backends} />
      <Table
        size='small'
        bordered
        columns={columns}
        dataSource={data}
        expandable={{
          expandedRowRender: (record) => {
            if (!(record.ticks && record.ticks.length > 0)) {
              return ''
            } else {
              const content = <>{record.ticks[0].file._id} <small><i>{moment(record.ticks[0].at).fromNow()}</i></small></>
              if (record.state === 'running') {
                return (
                  <div style={{ position: 'relative' }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 12 }} spin />} style={{ position: 'absolute' }} />
                    <p style={{ margin: 0, marginLeft: '20px' }}>{content}</p>
                  </div>
                )
              }
              return <p style={{ margin: 0 }}>{content}</p>
            }
          },
          rowExpandable: (record) => record.ticks && record.ticks.length > 0
        }}
        pagination={false}
      />
    </Space>
  )
}
