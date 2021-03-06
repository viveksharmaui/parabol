import {RecordProxy, RecordSourceSelectorProxy} from 'relay-runtime'
import getReflectionGroupThreadConn from '~/mutations/connections/getReflectionGroupThreadConn'
import {ThreadSourceEnum} from '~/types/graphql'
import addNodeToArray from '../../utils/relay/addNodeToArray'
import safeRemoveNodeFromConn from '../../utils/relay/safeRemoveNodeFromConn'
import getArchivedTasksConn from '../connections/getArchivedTasksConn'
import getTeamTasksConn from '../connections/getTeamTasksConn'
import getUserTasksConn from '../connections/getUserTasksConn'
import pluralizeHandler from './pluralizeHandler'
import safePutNodeInConn from './safePutNodeInConn'

type Task = RecordProxy<{
  readonly id: string
  readonly teamId: string
  readonly tags: readonly string[]
  readonly threadId: string | null
  readonly threadSource: string | null
  readonly threadParentId: string | null
  readonly meetingId: string | null
  readonly updatedAt: string | null
  readonly userId: string
}>

const handleUpsertTask = (task: Task | null, store: RecordSourceSelectorProxy<any>) => {
  if (!task) return
  // we currently have 3 connections, user, team, and team archive
  const viewer = store.getRoot().getLinkedRecord('viewer')
  if (!viewer) return
  const viewerId = viewer.getDataID()
  const teamId = task.getValue('teamId')
  const taskId = task.getValue('id')
  const tags = task.getValue('tags')
  const threadSource = task.getValue('threadSource')
  const threadParentId = task.getValue('threadParentId')
  if (threadParentId) {
    addNodeToArray(task, store.get(threadParentId), 'replies', 'threadSortOrder')
    return
  }
  const reflectionGroupId =
    threadSource === ThreadSourceEnum.REFLECTION_GROUP ? task.getValue('threadId') : undefined
  const meetingId = task.getValue('meetingId')
  const isNowArchived = tags.includes('archived')
  const archiveConn = getArchivedTasksConn(viewer, teamId)
  const team = store.get(teamId)
  const teamConn = getTeamTasksConn(team)
  const userConn = getUserTasksConn(viewer)
  const reflectionGroup = (reflectionGroupId && store.get(reflectionGroupId)) || null
  const reflectionGroupConn = getReflectionGroupThreadConn(reflectionGroup)
  const meeting = meetingId ? store.get(meetingId) : null

  if (isNowArchived) {
    safeRemoveNodeFromConn(taskId, teamConn)
    safeRemoveNodeFromConn(taskId, userConn)
    safePutNodeInConn(archiveConn, task, store)
  } else {
    safeRemoveNodeFromConn(taskId, archiveConn)
    safePutNodeInConn(teamConn, task, store)
    safePutNodeInConn(reflectionGroupConn, task, store, 'threadSortOrder', true)
    addNodeToArray(task, meeting, 'tasks', 'createdAt')
    if (userConn) {
      const ownedByViewer = task.getValue('userId') === viewerId
      if (ownedByViewer) {
        safePutNodeInConn(userConn, task, store)
      } else {
        safeRemoveNodeFromConn(taskId, userConn)
      }
    }
  }
}

const handleUpsertTasks = pluralizeHandler(handleUpsertTask)
export default handleUpsertTasks
