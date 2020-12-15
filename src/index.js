import React from 'react'
import ReactDOM from 'react-dom'
import { HashRouter as Router, Switch, Route, useHistory, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  CloudSyncOutlined,
  ExperimentOutlined,
  FileOutlined
} from '@ant-design/icons'

import Jobs from './containers/jobs'
import Backends from './containers/backends'
import Files from './containers/files'

import 'antd/dist/antd.css'

import io from 'socket.io-client'
import { SocketContext } from './utils'

const { SubMenu } = Menu
const { Sider, Content } = Layout

const App = (props) => {
  const history = useHistory()
  const location = useLocation()
  const selected = location.pathname.substr(1).split('/')[0] || 'dasboard'

  return (
    <Layout style={{ height: '100%' }}>
      <Sider width={320}>
        <div className='logo'>
          <span className='flicker1'>s</span>t<span className='flicker2'>o</span>r<span className='flicker3'>a</span>g<span className='flicker4'>e</span>
        </div>
        <Menu
          mode='inline'
          theme='dark'
          selectedKeys={[selected]}
          defaultOpenKeys={['storage']}
          onSelect={({ key }) => history.push(`/${key}`)}
        >
          <Menu.Item key='dashboard' icon={<DashboardOutlined />}>Dashboard</Menu.Item>
          <SubMenu key='storage' icon={<DatabaseOutlined />} title='Storage'>
            <Menu.Item key='backends' icon={<CloudSyncOutlined />}>Backends</Menu.Item>
            <Menu.Item key='files' icon={<FileOutlined />}>Files</Menu.Item>
            <Menu.Item key='jobs' icon={<ExperimentOutlined />}>jobs</Menu.Item>
          </SubMenu>
        </Menu>
      </Sider>
      <Content style={{ padding: '1em' }}>
        <div style={{ minHeight: '200px', backgroundColor: '#fff', padding: '1em' }}>
          <Switch>
            <Route path='/backends'>
              <Backends />
            </Route>
            <Route path='/files'>
              <Files />
            </Route>
            <Route path='/jobs'>
              <Jobs />
            </Route>
            <Route path='/'>
              <p>dashboard</p>
            </Route>
          </Switch>
        </div>
      </Content>
    </Layout>
  )
}

const socket = io()

socket.on('connect', () => {
  ReactDOM.render((
    <Router>
      <SocketContext.Provider value={socket}>
        <App />
      </SocketContext.Provider>
    </Router>
  ), document.getElementById('root'))
})

/*
import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'use-http'
import { Pane, Text, majorScale } from 'evergreen-ui'
import { HashRouter as Router, Switch, Route } from 'react-router-dom'
import Navigation from './containers/navigation'
import Backends from './containers/backends'
import Files from './containers/files'
import Jobs from './containers/jobs'

ReactDOM.render(
  <Provider options={{ cachePolicy: 'no-cache' }}>
    <Router>
      <Pane elevation={2} width={1000} marginTop={majorScale(2)} display='flex'>
        <Pane flexBasis={180} marginRight={majorScale(2)}>
          <Navigation />
        </Pane>
        <Pane flex='1' margin={majorScale(2)}>
          <Switch>
            <Route path='/backends'>
              <Backends />
            </Route>
            <Route path='/files'>
              <Files />
            </Route>
            <Route path='/jobs'>
              <Jobs />
            </Route>
            <Route path='/'>
              <Text size={300}>The quick brown fox jumps over the lazy dog</Text>
            </Route>
          </Switch>
        </Pane>
      </Pane>
    </Router>
  </Provider>,
  document.getElementById('root')
)
*/
