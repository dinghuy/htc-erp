import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  requestJsonWithAuth: vi.fn(),
}));
const notificationMocks = vi.hoisted(() => ({
  showNotify: vi.fn(),
}));

vi.mock('../shared/api/client', () => ({
  API_BASE: '/api',
  requestJsonWithAuth: clientMocks.requestJsonWithAuth,
}));

vi.mock('../Notification', () => ({
  showNotify: notificationMocks.showNotify,
}));

import { createProjectWorkspaceAsyncActions } from './projectWorkspaceAsyncActions';

const { requestJsonWithAuth } = clientMocks;
const { showNotify } = notificationMocks;

describe('createProjectWorkspaceAsyncActions', () => {
  beforeEach(() => {
    requestJsonWithAuth.mockReset();
    showNotify.mockReset();
  });

  it('opens the project thread on the timeline tab', async () => {
    const ui = {
      setProjectThread: vi.fn(),
      setProjectThreadMessages: vi.fn(),
      setProjectThreadDraft: vi.fn(),
    };
    const setTab = vi.fn();

    requestJsonWithAuth
      .mockResolvedValueOnce({ items: [{ id: 'thread-1', title: 'Project thread' }] })
      .mockResolvedValueOnce({ items: [{ id: 'message-1', content: 'Hello' }] });

    const actions = createProjectWorkspaceAsyncActions({
      token: 'token',
      projectId: 'project-1',
      currentUserId: 'user-1',
      workspace: { id: 'project-1', name: 'Project A' },
      ui,
      setBusy: vi.fn(),
      loadWorkspace: vi.fn(),
      setTab,
      goToRoute: vi.fn(),
    });

    await actions.openProjectThreadInTimeline();

    expect(setTab).toHaveBeenCalledWith('timeline');
    expect(requestJsonWithAuth).toHaveBeenNthCalledWith(
      1,
      'token',
      '/api/v1/threads?entityType=Project&entityId=project-1',
      {},
      'Không thể tải thread dự án',
    );
    expect(ui.setProjectThread).toHaveBeenCalledWith({
      project: { id: 'project-1', name: 'Project A' },
      threadSummary: expect.objectContaining({ threadId: 'thread-1', messageCount: 1, hasActiveThread: true }),
    });
    expect(ui.setProjectThreadMessages).toHaveBeenCalledWith([{ id: 'message-1', content: 'Hello' }]);
    expect(ui.setProjectThreadDraft).toHaveBeenCalledWith('');
  });

  it('creates a project thread before sending the first message', async () => {
    const setBusy = vi.fn();
    const ui = {
      projectThreadDraft: 'Need update',
      projectThread: {
        project: { id: 'project-1', name: 'Project A' },
        threadSummary: { threadId: null },
      },
      setProjectThread: vi.fn(),
      setProjectThreadMessages: vi.fn(),
      setProjectThreadDraft: vi.fn(),
    };

    requestJsonWithAuth
      .mockResolvedValueOnce({ id: 'thread-2' })
      .mockResolvedValueOnce({ id: 'message-2' })
      .mockResolvedValueOnce({ items: [{ id: 'thread-2', title: 'Project A' }] })
      .mockResolvedValueOnce({ items: [{ id: 'message-2', content: 'Need update' }] });

    const actions = createProjectWorkspaceAsyncActions({
      token: 'token',
      projectId: 'project-1',
      currentUserId: 'user-1',
      workspace: { id: 'project-1', name: 'Project A' },
      ui,
      setBusy,
      loadWorkspace: vi.fn(),
      setTab: vi.fn(),
      goToRoute: vi.fn(),
    });

    await actions.sendProjectThreadMessage();

    expect(requestJsonWithAuth).toHaveBeenNthCalledWith(
      1,
      'token',
      '/api/v1/threads',
      {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'Project',
          entityId: 'project-1',
          title: 'Project A',
        }),
      },
      'Không thể tạo thread dự án',
    );
    expect(requestJsonWithAuth).toHaveBeenNthCalledWith(
      2,
      'token',
      '/api/v1/threads/thread-2/messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Need update' }),
      },
      'Không thể gửi message thread dự án',
    );
    expect(setBusy).toHaveBeenNthCalledWith(1, 'project-thread-send');
    expect(setBusy).toHaveBeenLastCalledWith(null);
    expect(ui.setProjectThread).toHaveBeenCalledWith({
      project: { id: 'project-1', name: 'Project A' },
      threadSummary: expect.objectContaining({ threadId: 'thread-2', messageCount: 1, hasActiveThread: true }),
    });
    expect(showNotify).not.toHaveBeenCalled();
  });
});
