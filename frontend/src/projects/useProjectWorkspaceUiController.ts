import { useReducer } from 'preact/hooks';

export type ProjectWorkspaceUiState = {
  contractEditor: any | null;
  appendixEditor: any | null;
  procurementEditor: any | null;
  inboundEditor: any | null;
  deliveryEditor: any | null;
  milestoneEditor: any | null;
  documentEditor: any | null;
  documentThread: any | null;
  documentThreadMessages: any[];
  documentThreadDraft: string;
  blockerEditor: any | null;
  auditTrailItem: any | null;
};

type ProjectWorkspaceUiField = keyof ProjectWorkspaceUiState;

export type ProjectWorkspaceUiAction =
  | { type: 'set'; field: ProjectWorkspaceUiField; value: any }
  | { type: 'resetDocumentThread' };

export const initialProjectWorkspaceUiState: ProjectWorkspaceUiState = {
  contractEditor: null,
  appendixEditor: null,
  procurementEditor: null,
  inboundEditor: null,
  deliveryEditor: null,
  milestoneEditor: null,
  documentEditor: null,
  documentThread: null,
  documentThreadMessages: [],
  documentThreadDraft: '',
  blockerEditor: null,
  auditTrailItem: null,
};

export function projectWorkspaceUiReducer(state: ProjectWorkspaceUiState, action: ProjectWorkspaceUiAction): ProjectWorkspaceUiState {
  if (action.type === 'resetDocumentThread') {
    return {
      ...state,
      documentThread: null,
      documentThreadMessages: [],
      documentThreadDraft: '',
    };
  }

  return {
    ...state,
    [action.field]: action.value,
  };
}

export function useProjectWorkspaceUiController() {
  const [state, dispatch] = useReducer(projectWorkspaceUiReducer, initialProjectWorkspaceUiState);

  const setField = (field: ProjectWorkspaceUiField, value: any) => {
    dispatch({ type: 'set', field, value });
  };

  return {
    ...state,
    setContractEditor: (value: any) => setField('contractEditor', value),
    setAppendixEditor: (value: any) => setField('appendixEditor', value),
    setProcurementEditor: (value: any) => setField('procurementEditor', value),
    setInboundEditor: (value: any) => setField('inboundEditor', value),
    setDeliveryEditor: (value: any) => setField('deliveryEditor', value),
    setMilestoneEditor: (value: any) => setField('milestoneEditor', value),
    setDocumentEditor: (value: any) => setField('documentEditor', value),
    setDocumentThread: (value: any) => setField('documentThread', value),
    setDocumentThreadMessages: (value: any[]) => setField('documentThreadMessages', value),
    setDocumentThreadDraft: (value: string) => setField('documentThreadDraft', value),
    setBlockerEditor: (value: any) => setField('blockerEditor', value),
    setAuditTrailItem: (value: any) => setField('auditTrailItem', value),
    resetDocumentThread: () => dispatch({ type: 'resetDocumentThread' }),
  };
}
