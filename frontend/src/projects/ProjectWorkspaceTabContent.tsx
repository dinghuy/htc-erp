import {
  ContractTab,
  DeliveryTab,
  DocumentsTab,
  FinanceTab,
  InboundTab,
  LegalTab,
  OverviewTab,
  ProcurementTab,
  ProjectTasksTab,
  QbuRoundsTab,
  QuotationTab,
  TimelineTab,
} from './ProjectWorkspaceTabs';

export function ProjectWorkspaceTabContent(props: any) {
  const {
    tab,
    currentBaseline,
    executionBaselines,
    activeProcurementLines,
    shortageLines,
    overdueEtaLines,
    overdueDeliveryLines,
    unorderedLines,
    overviewAlerts,
    pendingMilestones,
    milestones,
    workspace,
    projectId,
    goToRoute,
    setTab,
    quotationVersions,
    qbuRounds,
    contractAppendices,
    openContractEditor,
    openAppendixEditor,
    workspaceActionAccess,
    historyProcurementLines,
    openProcurementEditor,
    openInboundFromProcurement,
    openDeliveryFromProcurement,
    inboundLines,
    openInboundEditor,
    deliveryLines,
    openDeliveryEditor,
    token,
    approvals,
    openMilestoneEditor,
    timeline,
    activityStream,
    reviewerRoleCodes,
    openDocumentEditor,
    openBlockerEditor,
    openAuditItem,
    runHeroAction,
    openDocumentThread,
    quickReviewDocument,
  } = props;

  if (tab === 'overview') {
    return (
      <OverviewTab
        currentBaseline={currentBaseline}
        executionBaselines={executionBaselines}
        procurementLines={activeProcurementLines}
        shortageLines={shortageLines}
        overdueEtaLines={overdueEtaLines}
        overdueDeliveryLines={overdueDeliveryLines}
        unorderedLines={unorderedLines}
        overviewAlerts={overviewAlerts}
        pendingMilestones={pendingMilestones}
        milestones={milestones}
        workspace={workspace}
        projectId={projectId}
        goToRoute={goToRoute}
        setTab={setTab}
      />
    );
  }

  if (tab === 'commercial') {
    return (
      <div style={{ display: 'grid', gap: '18px' }}>
        <QuotationTab quotationVersions={quotationVersions} />
        <QbuRoundsTab qbuRounds={qbuRounds} />
        <ContractTab
          workspace={workspace}
          currentBaseline={currentBaseline}
          contractAppendices={contractAppendices}
          executionBaselines={executionBaselines}
          setContractEditor={openContractEditor}
          setAppendixEditor={openAppendixEditor}
          canEditCommercial={workspaceActionAccess.canEditCommercial}
        />
      </div>
    );
  }

  if (tab === 'procurement') {
    return (
      <ProcurementTab
        activeProcurementLines={activeProcurementLines}
        historyProcurementLines={historyProcurementLines}
        unorderedLines={unorderedLines}
        shortageLines={shortageLines}
        overdueEtaLines={overdueEtaLines}
        overdueDeliveryLines={overdueDeliveryLines}
        setProcurementEditor={openProcurementEditor}
        openInboundFromProcurement={openInboundFromProcurement}
        openDeliveryFromProcurement={openDeliveryFromProcurement}
        canEditProcurement={workspaceActionAccess.canEditProcurement}
      />
    );
  }

  if (tab === 'delivery') {
    return (
      <div style={{ display: 'grid', gap: '18px' }}>
        <InboundTab inboundLines={inboundLines} setInboundEditor={openInboundEditor} canEditDelivery={workspaceActionAccess.canEditDelivery} />
        <DeliveryTab deliveryLines={deliveryLines} setDeliveryEditor={openDeliveryEditor} canEditDelivery={workspaceActionAccess.canEditDelivery} />
      </div>
    );
  }

  if (tab === 'finance') {
    return (
      <FinanceTab
        projectId={projectId}
        token={token}
        workspace={workspace}
        approvals={approvals}
        milestones={milestones}
        overdueDeliveryLines={overdueDeliveryLines}
        onChanged={() => void props.loadWorkspace()}
        canEditPricing={workspaceActionAccess.canEditPricing}
      />
    );
  }

  if (tab === 'legal') {
    return <LegalTab workspace={workspace} approvals={approvals} contractAppendices={contractAppendices} setTab={setTab} />;
  }

  if (tab === 'tasks') {
    return <ProjectTasksTab workspace={workspace} milestones={milestones} goToRoute={goToRoute} projectId={projectId} />;
  }

  if (tab === 'timeline') {
    return <TimelineTab milestones={milestones} timeline={timeline} activityStream={activityStream} setMilestoneEditor={openMilestoneEditor} canEditTimeline={workspaceActionAccess.canEditTimeline} />;
  }

  if (tab === 'documents') {
    return (
      <DocumentsTab
        workspace={workspace}
        canEditDocuments={workspaceActionAccess.canReviewDocuments}
        reviewerRoleCodes={reviewerRoleCodes}
        openDocumentEditor={openDocumentEditor}
        openBlockerEditor={openBlockerEditor}
        openAuditItem={openAuditItem}
        onRunAction={runHeroAction}
        onOpenThread={openDocumentThread}
        onQuickReviewAction={quickReviewDocument}
      />
    );
  }

  return null;
}
