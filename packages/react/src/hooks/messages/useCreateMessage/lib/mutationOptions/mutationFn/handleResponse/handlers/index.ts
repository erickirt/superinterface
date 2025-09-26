import { threadCreated } from './threadCreated'
import { threadMessageCreated } from './threadMessageCreated'
import { threadMessageDelta } from './threadMessageDelta'
import { threadMessageCompleted } from './threadMessageCompleted'
import { threadRunCreated } from './threadRunCreated'
import { threadRunFailed } from './threadRunFailed'
import { threadRunStepCreated } from './threadRunStepCreated'
import { threadMessageInProgress } from './threadMessageInProgress'
import { threadRunStepDelta } from './threadRunStepDelta'
import { threadRunStepCompleted } from './threadRunStepCompleted'
import { threadRunRequiresAction } from './threadRunRequiresAction'

export const handlers = {
  'thread.created': threadCreated,
  'thread.message.created': threadMessageCreated,
  'thread.message.in_progress': threadMessageInProgress,
  'thread.message.delta': threadMessageDelta,
  'thread.message.completed': threadMessageCompleted,
  'thread.run.created': threadRunCreated,
  'thread.run.failed': threadRunFailed,
  'thread.run.step.created': threadRunStepCreated,
  'thread.run.step.delta': threadRunStepDelta,
  'thread.run.step.completed': threadRunStepCompleted,
  'thread.run.requires_action': threadRunRequiresAction,
}
