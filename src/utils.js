import React, { useEffect, useState, useContext } from 'react'

export const SocketContext = React.createContext()

export const useWebsocket = (topic, params = {}, deps = []) => {
  const socket = useContext(SocketContext)
  const [data, setData] = useState([])

  useEffect(() => {
    const onResult = (resultTopic, result) => {
      if (resultTopic === topic) {
        if (result.docs) {
          setData({ ...result, docs: result.docs.map((i) => ({ key: i._id, ...i })) })
        } else {
          setData(result.map((i) => ({ key: i._id, ...i })))
        }
      }
    }

    if (!params.dontFetch) {
      socket.emit('get', topic, params)
    }
    socket.on('result', onResult)

    if (params.watch) {
      socket.emit('sub', topic)
    }

    return () => {
      if (params.watch) {
        socket.emit('unsub', topic)
      }
      socket.off('result', onResult)
    }
  }, deps)

  return {
    update: (id, data) => {
      socket.emit('update', topic, id, data)
    },
    create: (data) => {
      socket.emit('create', topic, data)
    },
    remove: (id) => {
      socket.emit('remove', topic, id)
    },
    data
  }
}
