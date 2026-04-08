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
    contractEditor,
    setContractEditor,
    saveMainContract,
    busy,
    appendixEditor,
    setAppendixEditor,
    saveAppendix,
    procurementEditor,
    setProcurementEditor,
    supplierAccounts,
    saveProcurement,
    inboundEditor,
    setInboundEditor,
    inboundEditorProcurementLines,
    saveMoveLine,
    deliveryEditor,
    setDeliveryEditor,
    deliveryEditorProcurementLines,
    milestoneEditor,
    setMilestoneEditor,
    saveMilestone,
    documentEditor,
    setDocumentEditor,
    saveDocumentChecklist,
    documentThread,
    documentThreadMessages,
    documentThreadDraft,
    setDocumentThreadDraft,
    sendDocumentThreadMessage,
    setDocumentThread,
    setDocumentThreadMessages,
    blockerEditor,
    setBlockerEditor,
    saveBlocker,
    auditTrailItem,
    setAuditTrailItem,
  } = props;

  return (
    <>
      {contractEditor ? <ContractEditorModal value={contractEditor} onChange={setContractEditor} onClose={() => setContractEditor(null)} onSave={saveMainContract} saving={busy === 'contract-save'} /> : null}
      {appendixEditor ? <ContractEditorModal value={appendixEditor} isAppendix onChange={setAppendixEditor} onClose={() => setAppendixEditor(null)} onSave={saveAppendix} saving={busy === 'appendix-save'} /> : null}
      {procurementEditor ? <ProcurementEditorModal value={procurementEditor} suppliers={supplierAccounts} onChange={setProcurementEditor} onClose={() => setProcurementEditor(null)} onSave={saveProcurement} saving={busy === 'procurement-save'} /> : null}
      {inboundEditor ? <MoveLineEditorModal value={inboundEditor} procurementLines={inboundEditorProcurementLines} onChange={setInboundEditor} onClose={() => setInboundEditor(null)} onSave={() => saveMoveLine('inbound')} saving={busy === 'inbound-save'} type="inbound" /> : null}
      {deliveryEditor ? <MoveLineEditorModal value={deliveryEditor} procurementLines={deliveryEditorProcurementLines} onChange={setDeliveryEditor} onClose={() => setDeliveryEditor(null)} onSave={() => saveMoveLine('delivery')} saving={busy === 'delivery-save'} type="delivery" /> : null}
      {milestoneEditor ? <MilestoneEditorModal value={milestoneEditor} onChange={setMilestoneEditor} onClose={() => setMilestoneEditor(null)} onSave={saveMilestone} saving={busy === 'milestone-save'} /> : null}
      {documentEditor ? <DocumentChecklistEditorModal value={documentEditor} onChange={setDocumentEditor} onClose={() => setDocumentEditor(null)} onSave={saveDocumentChecklist} saving={busy === 'document-save'} /> : null}
      {documentThread ? (
        <DocumentThreadModal
          document={documentThread.document}
          threadSummary={documentThread.threadSummary}
          messages={documentThreadMessages}
          draft={documentThreadDraft}
          onDraftChange={setDocumentThreadDraft}
          onSend={sendDocumentThreadMessage}
          onClose={() => {
            setDocumentThread(null);
            setDocumentThreadMessages([]);
            setDocumentThreadDraft('');
          }}
          saving={busy === 'document-thread-send'}
        />
      ) : null}
      {blockerEditor ? <BlockerEditorModal value={blockerEditor} onChange={setBlockerEditor} onClose={() => setBlockerEditor(null)} onSave={saveBlocker} saving={busy === 'blocker-save'} /> : null}
      {auditTrailItem ? <AuditTrailDetailModal item={auditTrailItem} onClose={() => setAuditTrailItem(null)} /> : null}
    </>
  );
}
