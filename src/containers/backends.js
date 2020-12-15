import React from 'react'
import { Table, Tag } from 'antd'
import { useWebsocket } from '../utils'
import moment from 'moment'

export default (props) => {
  const { data } = useWebsocket('backends')

  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: 'id'
    },
    {
      title: 'Type',
      dataIndex: 'backendType',
      key: 'type',
      render: (value) => <Tag>{value.toUpperCase()}</Tag>
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url'
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'created',
      render: (value) => moment(value).format('DD.MM.YY hh:mm')
    }
  ]

  return (
    <Table
      size='small'
      bordered
      columns={columns}
      dataSource={data}
      pagination={false}
      tableLayout='auto'
    />)
}
