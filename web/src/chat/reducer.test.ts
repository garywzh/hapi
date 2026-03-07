import { describe, expect, it } from 'vitest'
import type { AgentState } from '@/types/api'
import type { NormalizedMessage } from './types'
import { reduceChatBlocks } from './reducer'

function makeUserMessage(id: string, createdAt: number): NormalizedMessage {
    return {
        id,
        localId: null,
        role: 'user',
        content: { type: 'text', text: 'hello' },
        createdAt,
        isSidechain: false
    }
}

describe('reduceChatBlocks permission fallback cards', () => {
    it('keeps pending permission requests visible even when older than loaded messages', () => {
        const messages: NormalizedMessage[] = [makeUserMessage('msg-1', 2_000)]
        const agentState = {
            requests: {
                toolu_pending: {
                    tool: 'WebSearch',
                    arguments: { query: 'hapi' },
                    createdAt: 1_000
                }
            }
        } as unknown as AgentState

        const { blocks } = reduceChatBlocks(messages, agentState)
        const pending = blocks.find(block => block.kind === 'tool-call' && block.id === 'toolu_pending')

        expect(pending).toBeDefined()
        expect(pending?.kind).toBe('tool-call')
        if (pending?.kind === 'tool-call') {
            expect(pending.tool.permission?.status).toBe('pending')
        }
    })

    it('still hides historical non-pending permission cards outside the current page window', () => {
        const messages: NormalizedMessage[] = [makeUserMessage('msg-2', 2_000)]
        const agentState = {
            completedRequests: {
                toolu_done: {
                    tool: 'WebSearch',
                    arguments: { query: 'hapi' },
                    status: 'approved',
                    createdAt: 1_000,
                    completedAt: 1_100
                }
            }
        } as unknown as AgentState

        const { blocks } = reduceChatBlocks(messages, agentState)
        const completed = blocks.find(block => block.kind === 'tool-call' && block.id === 'toolu_done')

        expect(completed).toBeUndefined()
    })

    it('does not show historical non-pending permissions before messages are loaded', () => {
        const messages: NormalizedMessage[] = []
        const agentState = {
            completedRequests: {
                toolu_done: {
                    tool: 'WebSearch',
                    arguments: { query: 'hapi' },
                    status: 'approved',
                    createdAt: 1_000,
                    completedAt: 1_100
                }
            }
        } as unknown as AgentState

        const { blocks } = reduceChatBlocks(messages, agentState)
        const completed = blocks.find(block => block.kind === 'tool-call' && block.id === 'toolu_done')

        expect(completed).toBeUndefined()
    })

    it('keeps pending permission cards visible when sidechain tool calls are unresolved', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'sidechain-root',
                localId: null,
                role: 'agent',
                createdAt: 2_000,
                isSidechain: true,
                content: [
                    { type: 'sidechain', uuid: 'sidechain-root-uuid', prompt: 'research prompt' }
                ]
            },
            {
                id: 'sidechain-tool-call',
                localId: null,
                role: 'agent',
                createdAt: 2_001,
                isSidechain: true,
                content: [
                    {
                        type: 'tool-call',
                        id: 'toolu_sidechain_pending',
                        name: 'WebSearch',
                        input: { query: 'hapi sidechain' },
                        description: null,
                        uuid: 'sidechain-tool-uuid',
                        parentUUID: 'sidechain-root-uuid'
                    }
                ]
            }
        ]

        const agentState = {
            requests: {
                toolu_sidechain_pending: {
                    tool: 'WebSearch',
                    arguments: { query: 'hapi sidechain' },
                    createdAt: 1_000
                }
            }
        } as unknown as AgentState

        const { blocks } = reduceChatBlocks(messages, agentState)
        const pending = blocks.find(block => block.kind === 'tool-call' && block.id === 'toolu_sidechain_pending')

        expect(pending).toBeDefined()
        expect(pending?.kind).toBe('tool-call')
        if (pending?.kind === 'tool-call') {
            expect(pending.tool.permission?.status).toBe('pending')
        }
    })
})
