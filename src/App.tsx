import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import './App.css'
import { GraphData, GraphNode, BlueskyMessage, GraphLink } from './types'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const graphRef = useRef<any>()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket>()

  const updateGraphData = useCallback((message: BlueskyMessage) => {
    const newNode = message.commit.rkey
    const { text, createdAt } = message.commit.record

    setGraphData(prevData => {
      const nodes = new Map(prevData.nodes.map(n => [n.id, n]))
      const links = new Set(prevData.links.map(l => `${l.source}-${l.target}`))
      const newLinks: GraphLink[] = []

      // Add or update the new node
      nodes.set(newNode, {
        id: newNode,
        color: nodes.has(newNode) ? nodes.get(newNode)!.color : getRandomColor(),
        text,
        createdAt
      })

      // Handle reply connections
      if (message.commit.record.reply) {
        const parentNode = message.commit.record.reply.parent.uri
        const rootNode = message.commit.record.reply.root.uri

          // Add parent and root nodes if they don't exist
          ;[parentNode, rootNode].forEach(id => {
            if (!nodes.has(id)) {
              nodes.set(id, {
                id,
                color: getRandomColor()
              })
            }
          })

        // Add links for reply chain
        if (!links.has(`${newNode}-${parentNode}`)) {
          newLinks.push({ source: newNode, target: parentNode })
        }
        if (parentNode !== rootNode && !links.has(`${parentNode}-${rootNode}`)) {
          newLinks.push({ source: parentNode, target: rootNode })
        }
      }

      return {
        nodes: Array.from(nodes.values()),
        links: [...prevData.links, ...newLinks]
      }
    })
  }, [])

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node)
  }, [])

  const memoizedGraphData = useMemo(() => graphData, [graphData])

  useEffect(() => {
    let isComponentMounted = true;

    const connectWebSocket = () => {
      // Close existing connection if any
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = undefined
      }

      // Don't reconnect if we're not supposed to be connected
      if (!isConnected || !isComponentMounted) return;

      socketRef.current = new WebSocket('wss://jetstream2.us-west.bsky.network/subscribe?wantedCollections=app.bsky.feed.post')

      socketRef.current.onmessage = (event) => {
        try {
          // Don't process messages if we're not connected
          if (!isConnected || !isComponentMounted) return;

          const message = JSON.parse(event.data) as BlueskyMessage
          if (message.kind === 'commit' &&
            message.commit.operation === 'create' &&
            message.commit.collection === 'app.bsky.feed.post') {
            updateGraphData(message)
          }
        } catch (error) {
          console.error('Error processing message:', error)
        }
      }

      socketRef.current.onclose = () => {
        console.log('WebSocket closed')
        // Only attempt reconnection if we're still supposed to be connected
        if (isConnected && isComponentMounted) {
          setTimeout(connectWebSocket, 1000)
        }
      }

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    }

    if (isConnected) {
      connectWebSocket()
    } else if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = undefined
    }

    return () => {
      isComponentMounted = false;
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = undefined
      }
    }
  }, [isConnected, updateGraphData])

  const getRandomColor = () => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead', '#ff9999']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
        <button
          onClick={() => setIsConnected(true)}
          disabled={isConnected}
          style={{ marginRight: '10px' }}
        >
          {isConnected ? 'Running' : 'Start'}
        </button>
        <button
          onClick={() => setIsConnected(false)}
          disabled={!isConnected}
        >
          Pause
        </button>
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            maxWidth: '300px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            zIndex: 1,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#aaa' }}>
            {hoveredNode.createdAt && new Date(hoveredNode.createdAt).toLocaleString()}
          </div>
          <div style={{ marginTop: '8px' }}>{hoveredNode.text || 'Post ID: ' + hoveredNode.id}</div>
        </div>
      )}

      <ForceGraph2D
        ref={graphRef}
        graphData={memoizedGraphData}
        backgroundColor="#000"
        nodeRelSize={6}
        linkColor={() => '#ffffff30'}
        onNodeHover={handleNodeHover}
        nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath()
          ctx.arc(node.x || 0, node.y || 0, 5, 0, 2 * Math.PI, false)
          ctx.fillStyle = node.color || '#ffffff'
          ctx.fill()

          // Highlight hovered node
          if (hoveredNode && hoveredNode.id === node.id) {
            ctx.beginPath()
            ctx.arc(node.x || 0, node.y || 0, 8, 0, 2 * Math.PI, false)
            ctx.strokeStyle = '#ffffff'
            ctx.stroke()
          }
        }}
        cooldownTicks={50}
        d3VelocityDecay={0.3}
      />
    </div>
  )
}

export default App
