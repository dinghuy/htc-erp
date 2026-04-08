import { getDb } from '../../../sqlite-db';
import { createProjectCommercialRepository } from './repositoryProjectCommercial';
import { createProjectExecutionRepository } from './repositoryProjectExecution';
import { createProjectSummaryRepository } from './repositoryProjectSummary';
import { createProjectWorkflowRepository } from './repositoryProjectWorkflow';
const PROJECT_DOCUMENT_THREAD_ROLLUPS_JOIN = `
  LEFT JOIN (
    SELECT
      threadId,
      COUNT(*) AS threadMessageCount,
      MAX(createdAt) AS threadLastMessageAt
    FROM EntityThreadMessage
    WHERE threadId IS NOT NULL
    GROUP BY threadId
  ) pdtr ON pdtr.threadId = pd.threadId
`;

export function createProjectRepository() {
  const summaryRepository = createProjectSummaryRepository();
  const commercialRepository = createProjectCommercialRepository();
  const executionRepository = createProjectExecutionRepository();
  const workflowRepository = createProjectWorkflowRepository(PROJECT_DOCUMENT_THREAD_ROLLUPS_JOIN);

  async function withDb<T>(operation: (db: any) => Promise<T>) {
    return operation(getDb());
  }

  return {
    withDb,
    ...summaryRepository,
    ...workflowRepository,
    ...commercialRepository,
    ...executionRepository,
  };
}
