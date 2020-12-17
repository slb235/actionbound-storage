import React, { useEffect } from 'react'
import { useWebsocket } from '../utils'
import { Statistic, Row, Col, Card } from 'antd'
import { ArrowUpOutlined } from '@ant-design/icons'
import { BarChart, Bar, ResponsiveContainer, XAxis, Legend, Tooltip, YAxis } from 'recharts'
import numeral from 'numeral'
import moment from 'moment'

const DashboardChart = ({ data, dataKey, formatter }) => (
  <ResponsiveContainer width='100%' height={200}>
    <BarChart data={data}>
      <XAxis dataKey='_id' />
      <YAxis tickFormatter={formatter} />
      <Bar name='Files' dataKey={dataKey} fill='#121559' formatter={formatter} />
      <Tooltip />
      <Legend />
    </BarChart>
  </ResponsiveContainer>
)
export default () => {
  const { data, get } = useWebsocket('dashboard')

  useEffect(() => {
    const interval = setInterval(get, 120000)
    return () => clearInterval(interval)
  })

  if (data.length) {
    const [total, years, _months, _days] = data.map((entry) => Object.keys(entry).map((key) => entry[key]).filter((entry) => entry))

    const months = _months.map((month) => ({ ...month, _id: moment(`2020-${month._id}-15`).format('MMM') }))
    const days = _days.map((day) => ({ ...day, _id: moment(day._id).format('M-D') }))

    return (
      <>
        <Row gutter={32}>
          <Col span={8}>
            <Statistic title='Total files' value={total[0].files} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Col>
          <Col span={8}>
            <Statistic title='Total size' value={numeral(total[0].size).format('0 b')} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Col>
          <Col span={8}>
            <Statistic title='Average size' value={numeral(total[0].size / total[0].files).format('0 b')} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Col>
        </Row>
        <Row gutter={32} style={{ marginTop: '2em' }}>
          <Col span={12}>
            <Card title='Last 14 days'>
              <DashboardChart data={days} dataKey='files' />
            </Card>
          </Col>
          <Col span={12}>
            <Card title='Last 14 days'>
              <DashboardChart data={days} dataKey='size' formatter={(entry) => numeral(entry).format('0b')} />
            </Card>
          </Col>
        </Row>
        <Row gutter={32} style={{ marginTop: '2em' }}>
          <Col span={12}>
            <Card title='Files per year'>
              <DashboardChart data={years} dataKey='files' />
            </Card>
          </Col>
          <Col span={12}>
            <Card title='Size per year'>
              <DashboardChart data={years} dataKey='size' formatter={(entry) => numeral(entry).format('0b')} />
            </Card>
          </Col>
        </Row>
        <Row gutter={32} style={{ marginTop: '2em' }}>
          <Col span={12}>
            <Card title='Files per month'>
              <DashboardChart data={months} dataKey='files' />
            </Card>
          </Col>
          <Col span={12}>
            <Card title='Size per month'>
              <DashboardChart data={months} dataKey='size' formatter={(entry) => numeral(entry).format('0b')} />
            </Card>
          </Col>
        </Row>

      </>
    )
  } else {
    return (<p>loading</p>)
  }
}
