import { describe, expect, it } from 'vitest';

import {
  buildBlockerEditorState,
  buildDeliveryEditorState,
  buildDocumentChecklistEditorState,
  buildInboundEditorState,
} from './projectWorkspaceEditors';

describe('project workspace editor builders', () => {
  it('normalizes document checklist editor state', () => {
    expect(
      buildDocumentChecklistEditorState(
        {
          title: 'Ho so ban giao',
          reviewStatus: 'approved',
        },
        'delivery',
      ),
    ).toMatchObject({
      documentName: 'Ho so ban giao',
      requiredAtStage: 'delivery',
      reviewStatus: 'approved',
      status: 'missing',
    });
  });

  it('normalizes blocker editor state', () => {
    expect(buildBlockerEditorState({ title: 'Missing PO' })).toMatchObject({
      title: 'Missing PO',
      source: 'manual',
      status: 'open',
      tone: 'warning',
    });
  });

  it('derives inbound editor quantities from procurement line gaps', () => {
    expect(
      buildInboundEditorState({
        id: 'line-1',
        orderedQty: 10,
        receivedQty: 4,
        shortageQty: 2,
        etaDate: '2026-04-09',
      }),
    ).toMatchObject({
      procurementLineId: 'line-1',
      receivedQty: 6,
      status: 'partial',
      etaDate: '2026-04-09',
    });
  });

  it('derives delivery editor quantities from received balance', () => {
    expect(
      buildDeliveryEditorState({
        id: 'line-1',
        receivedQty: 8,
        deliveredQty: 3,
        committedDeliveryDate: '2026-04-10',
      }),
    ).toMatchObject({
      procurementLineId: 'line-1',
      deliveredQty: 5,
      status: 'completed',
      committedDate: '2026-04-10',
    });
  });
});
