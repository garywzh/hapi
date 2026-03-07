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

        const { blocks } = reduceChatBlocks(messages, agentState, { isInitialMessagesLoading: true })
        const completed = blocks.find(block => block.kind === 'tool-call' && block.id === 'toolu_done')

        expect(completed).toBeUndefined()
    })

    it('shows non-pending permissions when message loading is complete, even with no messages', () => {
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

        const { blocks } = reduceChatBlocks(messages, agentState, { isInitialMessagesLoading: false })
        const completed = blocks.find(block => block.kind === 'tool-call' && block.id === 'toolu_done')

        expect(completed).toBeDefined()
        expect(completed?.kind).toBe('tool-call')
        if (completed?.kind === 'tool-call') {
            expect(completed.tool.permission?.status).toBe('approved')
            expect(completed.tool.state).toBe('completed')
        }
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

    it('does not duplicate pending permission cards when the tool block already exists', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'agent-tool-call',
                localId: null,
                role: 'agent',
                createdAt: 2_000,
                isSidechain: false,
                content: [
                    {
                        type: 'tool-call',
                        id: 'toolu_existing_pending',
                        name: 'WebSearch',
                        input: { query: 'hapi dedupe' },
                        description: null,
                        uuid: 'tool-call-uuid',
                        parentUUID: null
                    }
                ]
            }
        ]
        const agentState = {
            requests: {
                toolu_existing_pending: {
                    tool: 'WebSearch',
                    arguments: { query: 'hapi dedupe' },
                    createdAt: 1_000
                }
            }
        } as unknown as AgentState

        const { blocks } = reduceChatBlocks(messages, agentState)
        const matched = blocks.filter(block => block.kind === 'tool-call' && block.id === 'toolu_existing_pending')

        expect(matched).toHaveLength(1)
        expect(matched[0]?.kind).toBe('tool-call')
        if (matched[0]?.kind === 'tool-call') {
            expect(matched[0].tool.permission?.status).toBe('pending')
        }
    })
})
