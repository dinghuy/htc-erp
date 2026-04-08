import {
  AuditTrailDetailModal,
  BlockerEditorModal,
  ContractEditorModal,
  DocumentChecklistEditorModal,
  DocumentThreadModal,
  MilestoneEditorModal,
  MoveLineEditorModal,
  ProcurementEditorModal,
} from './ProjectWorkspaceModals';

export function ProjectWorkspaceModalHost(props: any) {
  const {
    ui,
    saveMainContract,
    busy,
    saveAppendix,
    supplierAccounts,
    saveProcurement,
    inboundEditorProcurementLines,
    saveMoveLine,
    deliveryEditorProcurementLines,
    saveMilestone,
    saveDocumentChecklist,
    sendDocumentThreadMessage,
    saveBlocker,
  } = props;

  return (
    <>
      {ui.contractEditor ? <ContractEditorModal value={ui.contractEditor} onChange={ui.setContractEditor} onClose={() => ui.setContractEditor(null)} onSave={saveMainContract} saving={busy === 'contract-save'} /> : null}
      {ui.appendixEditor ? <ContractEditorModal value={ui.appendixEditor} isAppendix onChange={ui.setAppendixEditor} onClose={() => ui.setAppendixEditor(null)} onSave={saveAppendix} saving={busy === 'appendix-save'} /> : null}
      {ui.procurementEditor ? <ProcurementEditorModal value={ui.procurementEditor} suppliers={supplierAccounts} onChange={ui.setProcurementEditor} onClose={() => ui.setProcurementEditor(null)} onSave={saveProcurement} saving={busy === 'procurement-save'} /> : null}
      {ui.inboundEditor ? <MoveLineEditorModal value={ui.inboundEditor} procurementLines={inboundEditorProcurementLines} onChange={ui.setInboundEditor} onClose={() => ui.setInboundEditor(null)} onSave={() => saveMoveLine('inbound')} saving={busy === 'inbound-save'} type="inbound" /> : null}
      {ui.deliveryEditor ? <MoveLineEditorModal value={ui.deliveryEditor} procurementLines={deliveryEditorProcurementLines} onChange={ui.setDeliveryEditor} onClose={() => ui.setDeliveryEditor(null)} onSave={() => saveMoveLine('delivery')} saving={busy === 'delivery-save'} type="delivery" /> : null}
      {ui.milestoneEditor ? <MilestoneEditorModal value={ui.milestoneEditor} onChange={ui.setMilestoneEditor} onClose={() => ui.setMilestoneEditor(null)} onSave={saveMilestone} saving={busy === 'milestone-save'} /> : null}
      {ui.documentEditor ? <DocumentChecklistEditorModal value={ui.documentEditor} onChange={ui.setDocumentEditor} onClose={() => ui.setDocumentEditor(null)} onSave={saveDocumentChecklist} saving={busy === 'document-save'} /> : null}
      {ui.documentThread ? (
        <DocumentThreadModal
          document={ui.documentThread.document}
          threadSummary={ui.documentThread.threadSummary}
          messages={ui.documentThreadMessages}
          draft={ui.documentThreadDraft}
          onDraftChange={ui.setDocumentThreadDraft}
          onSend={sendDocumentThreadMessage}
          onClose={ui.resetDocumentThread}
          saving={busy === 'document-thread-send'}
        />
      ) : null}
      {ui.blockerEditor ? <BlockerEditorModal value={ui.blockerEditor} onChange={ui.setBlockerEditor} onClose={() => ui.setBlockerEditor(null)} onSave={saveBlocker} saving={busy === 'blocker-save'} /> : null}
      {ui.auditTrailItem ? <AuditTrailDetailModal item={ui.auditTrailItem} onClose={() => ui.setAuditTrailItem(null)} /> : null}
    </>
  );
}
