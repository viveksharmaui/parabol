import styled from '@emotion/styled'
import graphql from 'babel-plugin-relay/macro'
import {EditorState} from 'draft-js'
import React, {useEffect, useMemo, useRef} from 'react'
import {createFragmentContainer} from 'react-relay'
import {PhaseItemColumn_prompt} from '~/__generated__/PhaseItemColumn_prompt.graphql'
import useAtmosphere from '../../hooks/useAtmosphere'
import {MenuPosition} from '../../hooks/useCoords'
import useRefState from '../../hooks/useRefState'
import useTooltip from '../../hooks/useTooltip'
import SetPhaseFocusMutation from '../../mutations/SetPhaseFocusMutation'
import {DECELERATE} from '../../styles/animation'
import {PALETTE} from '../../styles/paletteV2'
import {BezierCurve, ElementWidth, Gutters} from '../../types/constEnums'
import {NewMeetingPhaseTypeEnum} from '../../types/graphql'
import getNextSortOrder from '../../utils/getNextSortOrder'
import {PhaseItemColumn_meeting} from '../../__generated__/PhaseItemColumn_meeting.graphql'
import RetroPrompt from '../RetroPrompt'
import PhaseItemChits from './PhaseItemChits'
import PhaseItemEditor from './PhaseItemEditor'
import ReflectionStack from './ReflectionStack'

const ColumnWrapper = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  justifyContent: 'flex-start',
  margin: isDesktop ? '0 8px 16px' : undefined,
  minHeight: isDesktop ? undefined : '100%'
}))

const ColumnHighlight = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  backgroundColor: PALETTE.BACKGROUND_REFLECTION,
  borderRadius: 8,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  flexShrink: 0,
  height: isDesktop ? undefined : '100%',
  maxHeight: isDesktop ? 600 : undefined,
  overflow: 'hidden',
  padding: `${Gutters.ROW_INNER_GUTTER} ${Gutters.COLUMN_INNER_GUTTER}`,
  position: 'relative',
  transition: `background 150ms ${DECELERATE}`,
  width: '100%'
}))

const ColumnContent = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  height: '100%',
  justifyContent: isDesktop ? 'space-between' : 'space-between',
  margin: '0 auto',
  width: ElementWidth.REFLECTION_CARD,
  // must be greater than the highlighted el
  zIndex: 1
}))

const HeaderAndEditor = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  flex: isDesktop ? 0.3 : undefined
}))

const EditorSection = styled('div')({
  margin: `0 0 ${Gutters.ROW_INNER_GUTTER}`
})

const ReflectionStackSection = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  flex: isDesktop ? 0.3 : undefined
}))

const Description = styled('div')({
  color: PALETTE.TEXT_MAIN,
  fontSize: 12,
  fontStyle: 'italic',
  fontWeight: 400,
  lineHeight: '16px'
})

const ColorSpacer = styled('div')({
  position: 'relative',
  height: 8,
  width: 8,
  display: 'inline-block',
  verticalAlign: 'middle',
  marginRight: 4
})
const ColumnColorDrop = styled('div')<{groupColor: string; isFocused: boolean}>(
  ({groupColor, isFocused}) => ({
    backgroundColor: groupColor,
    borderRadius: '50%',
    display: 'inline-block',
    verticalAlign: 'middle',
    position: 'absolute',
    marginRight: 8,
    height: 8,
    width: 8,
    top: 20, // must be out of layout  so it doesn't color the text
    transform: `scale(${isFocused ? 163 : 1})`,
    transition: `all 300ms ${BezierCurve.DECELERATE}`,
    opacity: isFocused ? 0.25 : 1
  })
)

const PromptHeader = styled('div')<{isClickable: boolean}>(({isClickable}) => ({
  cursor: isClickable ? 'pointer' : undefined,
  padding: `0 0 ${Gutters.ROW_INNER_GUTTER} 0`,
  position: 'relative',
  userSelect: 'none',
  width: '100%'
}))

interface EditorAndStatusProps {
  isGroupingComplete: boolean
}

const EditorAndStatus = styled('div')<EditorAndStatusProps>(({isGroupingComplete}) => ({
  visibility: isGroupingComplete ? 'hidden' : undefined
}))

const ChitSection = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  flex: isDesktop ? 0.3 : undefined,
  margin: isDesktop ? undefined : `0 0 ${Gutters.ROW_INNER_GUTTER}`,
  minHeight: isDesktop ? 96 : undefined
}))

export interface ReflectColumnCardInFlight {
  key: string
  editorState: EditorState
  transform: string
  isStart: boolean
}

interface Props {
  idx: number
  isDesktop: boolean
  meeting: PhaseItemColumn_meeting
  phaseRef: React.RefObject<HTMLDivElement>
  prompt: PhaseItemColumn_prompt
}

const PhaseItemColumn = (props: Props) => {
  const {idx, meeting, phaseRef, prompt, isDesktop} = props
  const {id: retroPhaseItemId, editorIds, question, groupColor, description} = prompt
  const {meetingId, facilitatorUserId, localPhase, phases, reflectionGroups} = meeting
  const {phaseId, focusedPhaseItemId} = localPhase
  const groupPhase = phases.find((phase) => phase.phaseType === NewMeetingPhaseTypeEnum.group)!
  const {stages: groupStages} = groupPhase
  const [groupStage] = groupStages
  const {isComplete} = groupStage

  const atmosphere = useAtmosphere()
  const {viewerId} = atmosphere

  const hasFocusedRef = useRef(false)
  const phaseEditorRef = useRef<HTMLDivElement>(null)
  const stackTopRef = useRef<HTMLDivElement>(null)
  const [cardsInFlightRef, setCardsInFlight] = useRefState<ReflectColumnCardInFlight[]>([])
  const isFacilitator = viewerId === facilitatorUserId
  useEffect(() => {
    hasFocusedRef.current = true
  }, [focusedPhaseItemId])

  const setColumnFocus = () => {
    if (!isFacilitator || isComplete) return
    const variables = {
      meetingId,
      focusedPhaseItemId: focusedPhaseItemId === retroPhaseItemId ? null : retroPhaseItemId
    }
    SetPhaseFocusMutation(atmosphere, variables, {phaseId})
  }

  const nextSortOrder = () => getNextSortOrder(reflectionGroups)

  const isFocused = focusedPhaseItemId === retroPhaseItemId

  const columnStack = useMemo(() => {
    return reflectionGroups
      .slice()
      .sort((a, b) => (a.sortOrder > b.sortOrder ? -1 : 1))
      .flatMap(({reflections}) => reflections || [])
      .filter((reflection) => {
        return (
          reflection.retroPhaseItemId === retroPhaseItemId &&
          !cardsInFlightRef.current.find((card) => card.key === reflection.content)
        )
      })
  }, [reflectionGroups, retroPhaseItemId, cardsInFlightRef.current])

  const reflectionStack = useMemo(() => {
    return columnStack.filter(({isViewerCreator}) => isViewerCreator)
  }, [columnStack])

  const {tooltipPortal, openTooltip, closeTooltip, originRef} = useTooltip<HTMLDivElement>(
    MenuPosition.UPPER_CENTER,
    {
      delay: 200,
      disabled: hasFocusedRef.current || isFocused || !isFacilitator || isComplete
    }
  )

  return (
    <ColumnWrapper data-cy={`reflection-column-${question}`} isDesktop={isDesktop}>
      <ColumnHighlight isDesktop={isDesktop}>
        <ColumnColorDrop isFocused={isFocused} groupColor={groupColor} />
        <ColumnContent isDesktop={isDesktop}>
          <HeaderAndEditor isDesktop={isDesktop}>
            <PromptHeader isClickable={isFacilitator && !isComplete} onClick={setColumnFocus}>
              <RetroPrompt onMouseEnter={openTooltip} onMouseLeave={closeTooltip} ref={originRef}>
                <ColorSpacer />
                {question}
              </RetroPrompt>
              {tooltipPortal(<div>Tap to highlight prompt for everybody</div>)}
              <Description>{description}</Description>
            </PromptHeader>
            <EditorSection data-cy={`editor-section-${question}`}>
              <EditorAndStatus
                data-cy={`editor-status-${question}`}
                isGroupingComplete={isComplete}
              >
                <PhaseItemEditor
                  dataCy={`phase-item-editor-${question}`}
                  cardsInFlightRef={cardsInFlightRef}
                  setCardsInFlight={setCardsInFlight}
                  phaseEditorRef={phaseEditorRef}
                  meetingId={meetingId}
                  nextSortOrder={nextSortOrder}
                  retroPhaseItemId={retroPhaseItemId}
                  stackTopRef={stackTopRef}
                />
              </EditorAndStatus>
            </EditorSection>
          </HeaderAndEditor>
          <ReflectionStackSection isDesktop={isDesktop}>
            <ReflectionStack
              dataCy={`reflection-stack-${question}`}
              reflectionStack={reflectionStack}
              idx={idx}
              phaseEditorRef={phaseEditorRef}
              phaseRef={phaseRef}
              meeting={meeting}
              stackTopRef={stackTopRef}
            />
          </ReflectionStackSection>
          <ChitSection isDesktop={isDesktop}>
            <PhaseItemChits
              count={columnStack.length - reflectionStack.length}
              editorCount={editorIds ? editorIds.length : 0}
            />
          </ChitSection>
        </ColumnContent>
      </ColumnHighlight>
    </ColumnWrapper>
  )
}

export default createFragmentContainer(PhaseItemColumn, {
  prompt: graphql`
    fragment PhaseItemColumn_prompt on RetroPhaseItem {
      id
      description
      editorIds
      groupColor
      question
    }
  `,
  meeting: graphql`
    fragment PhaseItemColumn_meeting on RetrospectiveMeeting {
      ...ReflectionStack_meeting
      facilitatorUserId
      meetingId: id
      localPhase {
        phaseId: id
        phaseType
        ... on ReflectPhase {
          focusedPhaseItemId
        }
      }
      localStage {
        isComplete
      }
      phases {
        id
        phaseType
        stages {
          isComplete
        }
        ... on ReflectPhase {
          focusedPhaseItemId
        }
      }
      reflectionGroups {
        id
        ...ReflectionGroup_reflectionGroup
        sortOrder
        reflections {
          ...ReflectionCard_reflection
          ...DraggableReflectionCard_reflection
          ...DraggableReflectionCard_staticReflections
          content
          groupColor
          id
          isEditing
          isViewerCreator
          retroPhaseItemId
          sortOrder
        }
      }
    }
  `
})
