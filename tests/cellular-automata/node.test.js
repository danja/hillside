import { describe, it, expect } from 'vitest'
import { Node } from '../../src/js/cellular-automata/node.js'

describe('Node', () => {
  it('should create a node with correct properties', () => {
    const node = new Node(1, 10, 20, '#ff0000')
    
    expect(node.id).toBe(1)
    expect(node.x).toBe(10)
    expect(node.y).toBe(20)
    expect(node.color).toBe('#ff0000')
    expect(node.size).toBeGreaterThan(1)
    expect(node.size).toBeLessThan(4)
  })

  it('should update node properties correctly', () => {
    const node = new Node(1, 10, 20, '#ff0000')
    const initialSize = node.size
    
    node.update()
    
    expect(node.size).toBeLessThan(initialSize)
    expect(node.size).toBeGreaterThanOrEqual(1)
    expect(node.size).toBeLessThanOrEqual(100)
  })

  it('should interact with other nodes when close enough', () => {
    const node1 = new Node(1, 0, 0, '#ff0000')
    const node2 = new Node(2, 1, 1, '#00ff00')
    
    node1.size = 2
    node2.size = 2
    
    const distance = Math.sqrt(2) // Distance between (0,0) and (1,1)
    const interacted = node1.interact(node2, distance)
    
    expect(interacted).toBe(true)
  })

  it('should not interact with nodes that are too far', () => {
    const node1 = new Node(1, 0, 0, '#ff0000')
    const node2 = new Node(2, 100, 100, '#00ff00')
    
    const distance = Math.sqrt(20000) // Large distance
    const interacted = node1.interact(node2, distance)
    
    expect(interacted).toBe(false)
  })
})