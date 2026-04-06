import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getComputerCallActions } from '@/lib/computerCalls/getComputerCallActions'

test('getComputerCallActions supports the legacy single action shape', () => {
  const result = getComputerCallActions({
    toolCall: {
      computer_call: {
        action: { type: 'click', x: 1, y: 2 },
        pending_safety_checks: [{ id: 'safe_1' }],
      },
    } as any,
  })

  assert.deepEqual(result.actions, [{ type: 'click', x: 1, y: 2 }])
  assert.deepEqual(result.acknowledgedSafetyChecks, [{ id: 'safe_1' }])
})

test('getComputerCallActions supports the GPT-5.4 batched actions shape', () => {
  const result = getComputerCallActions({
    toolCall: {
      computer_call: {
        actions: [
          { type: 'click', x: 1, y: 2 },
          { type: 'type', text: 'hello' },
        ],
        pending_safety_checks: [{ id: 'safe_1' }],
      },
    } as any,
  })

  assert.deepEqual(result.actions, [
    { type: 'click', x: 1, y: 2 },
    { type: 'type', text: 'hello' },
  ])
  assert.deepEqual(result.acknowledgedSafetyChecks, [{ id: 'safe_1' }])
})
