import React, { useState } from 'react'
import { Table, Tag, Card, Button, Popconfirm, message } from 'antd'
import { DeleteOutlined, DownloadOutlined, CheckOutlined, MinusOutlined } from '@ant-design/icons'
import { useWebsocket } from '../utils'
import moment from 'moment'
import numeral from 'numeral'

const openInNewTab = (url) => {
  const win = window.open(url, '_blank')
  win.focus()
}

const FileCard = ({ file, backends }) => {
  const [activeTab, setActiveTab] = useState('details')
  const { create } = useWebsocket('jobs', { dontFetch: true })
  const { remove } = useWebsocket('files', { dontFetch: true })

  const tabList = [
    {
      key: 'details',
      tab: 'File Details'
    },
    {
      key: 'backends',
      tab: 'Backends'
    }
  ]

  const createCopyJob = (backend) => {
    create({ jobType: 'copyFileToBackend', file: file._id, backend })
    message.success('Copy job created')
  }

  const createDeleteJob = (backend) => {
    create({ jobType: 'deleteFileFromBackend', file: file._id, backend: backend })
    message.success('Delete job created')
  }

  const backendColumns = [
    {
      dataIndex: '_id',
      title: 'Backend',
      key: 'backend',
      render: backend => (
        <>
          <Tag key={backend}>{backend.toUpperCase()}</Tag>
          {file.backends.includes(backend) ? <CheckOutlined /> : <MinusOutlined />}
        </>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => {
        const canCloneTo = !file.backends.includes(record._id)
        const canRemoveFrom = !canCloneTo && file.backends.length > 1

        return (
          <>
            {canCloneTo ? <Button size='small' onClick={() => createCopyJob(record._id)}> Create Copy Job</Button> : null}
            {canRemoveFrom ? <Button size='small' danger onClick={() => createDeleteJob(record._id)}>Create Delete Job</Button> : null}
          </>
        )
      }
    }
  ]

  const contentList = {
    details: <p>File Size: {file.size}</p>,
    backends: <Table dataSource={backends} columns={backendColumns} pagination={false} style={{ marginLeft: '-25px' }} />
  }

  return (
    <Card
      bordered={false}
      tabList={tabList}
      activeTabKey={activeTab}
      onTabChange={(key) => setActiveTab(key)}
      actions={[
        <DownloadOutlined key={0} onClick={() => openInNewTab(`/${file._id}`)} />,
        <Popconfirm
          key={1}
          title='Delete from all backends and database?'
          onConfirm={() => {
            remove(file._id)
            message.success('File deleted')
          }}
          okText='Yes'
          cancelText='No'
        >
          <DeleteOutlined />
        </Popconfirm>
      ]}
    >
      {contentList[activeTab]}
    </Card>
  )
}

export default (props) => {
  const [filter, setFilter] = useState({})
  const [pageSize, setPageSize] = useState(10)
  const [current, setCurrent] = useState(1)
  const [sortColumn, setSortColumn] = useState('_id')
  const [sortOrder, setSortOrder] = useState('descend')

  const { docs, total } = useWebsocket('files', {
    filter,
    sort: { [sortColumn]: sortOrder === 'descend' ? -1 : 1 },
    pageSize,
    current,
    watch: true
  }, [filter, sortColumn, sortOrder, pageSize, current]).data
  const backends = useWebsocket('backends').data

  const columns = [
    {
      title: 'Filename',
      dataIndex: '_id',
      key: 'id',
      sorter: true,
      defaultSortOrder: 'descend'
    },
    {
      title: 'Backends',
      dataIndex: 'backends',
      key: 'backends',
      render: (value) => value.map((backend) => <Tag key={backend}>{backend.toUpperCase()}</Tag>),
      filters: backends.map((backend) => ({ text: backend._id, value: backend._id })),
      width: '250px'
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (value) => numeral(value).format('0 b'),
      sorter: true,
      width: '85px',
      align: 'right'
    },
    {
      title: 'Created At',
      dataIndex: 'mtime',
      key: 'created',
      render: (value) => moment(value).format('DD.MM.YY hh:mm'),
      sorter: true,
      width: '120px'
    }
  ]

  const handleChange = (pagination, filters, sorter) => {
    const filter = {}

    if (filters.backends) {
      filter.backends = { $in: filters.backends }
    }

    setFilter(filter)

    setSortColumn(sorter.field)
    setSortOrder(sorter.order)

    setPageSize(pagination.pageSize)
    setCurrent(pagination.current)
  }

  return (
    <Table
      size='small'
      bordered
      columns={columns}
      dataSource={docs}
      pagination={{
        showSizeChanger: true,
        position: ['topRight'],
        current,
        pageSize,
        total
      }}
      onChange={handleChange}
      tableLayout='auto'
      expandable={{
        expandedRowRender: (record) => <FileCard file={record} backends={backends} />
      }}
    />)
}
