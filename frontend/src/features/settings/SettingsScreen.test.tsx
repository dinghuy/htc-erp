/** @vitest-environment jsdom */

import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/icons', () => ({
  SettingsIcon: () => h('span', { 'data-testid': 'mock-settings-icon' }),
  UserIcon: () => h('span', { 'data-testid': 'mock-user-icon' }),
}));

vi.mock('../../auth', async () => {
  const actual = await vi.importActual<typeof import('../../auth')>('../../auth');
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  };
});

import { fetchWithAuth, type CurrentUser } from '../../auth';
import { I18nContext } from '../../i18n';
import { QA_TEST_IDS } from '../../testing/testIds';
import { SettingsScreen, type SettingsScreenProps } from './SettingsScreen';

const baseUser: CurrentUser = {
  id: 'user-1',
  username: 'jane',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  systemRole: 'sales',
  roleCodes: ['sales'],
  token: 'token-1',
  language: 'vi',
};

const i18nValue = {
  locale: 'vi' as const,
  setLocale: vi.fn(),
  t: (key: string) => key,
};

function buildScreen(props: SettingsScreenProps) {
  return h(I18nContext.Provider, { value: i18nValue }, h(SettingsScreen, props));
}

function queryByTestId<T extends Element>(host: Element, testId: string): T | null {
  return host.querySelector<T>(`[data-testid="${testId}"]`);
}

function requireNode<T extends Element>(node: T | null, message: string): T {
  if (!node) {
    throw new Error(message);
  }
  return node;
}

function updateValue(node: HTMLInputElement | HTMLSelectElement, value: string, eventName: 'input' | 'change') {
  const setter = Object.getOwnPropertyDescriptor(node.constructor.prototype, 'value')?.set;
  setter?.call(node, value);

  node.dispatchEvent(new window.Event(eventName, { bubbles: true, composed: true }));
}

function click(node: HTMLButtonElement) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function submit(node: HTMLButtonElement) {
  const form = node.closest('form');
  if (!form) {
    throw new Error('Expected submit button to be inside a form');
  }
  form.requestSubmit(node);
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function cleanupBody() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

function renderScreen(overrides: Partial<SettingsScreenProps> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const toggleDarkMode = vi.fn();
  const onUserUpdated = vi.fn();

  const buildProps = (nextOverrides: Partial<SettingsScreenProps> = {}): SettingsScreenProps => ({
    isDarkMode: false,
    toggleDarkMode,
    currentUser: baseUser,
    onUserUpdated,
    ...overrides,
    ...nextOverrides,
  });

  render(buildScreen(buildProps()), host);

  return {
    host,
    toggleDarkMode,
    onUserUpdated,
    rerender: (nextOverrides: Partial<SettingsScreenProps> = {}) => {
      render(buildScreen(buildProps(nextOverrides)), host);
    },
  };
}

afterEach(() => {
  cleanupBody();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubGlobal('alert', vi.fn());
});

describe('SettingsScreen', () => {
  it('renders real user sections', () => {
    const { host } = renderScreen();

    expect(queryByTestId(host, QA_TEST_IDS.settings.displayCard)).not.toBeNull();
    expect(queryByTestId(host, QA_TEST_IDS.settings.profileCard)).not.toBeNull();
    expect(queryByTestId(host, QA_TEST_IDS.settings.securityCard)).not.toBeNull();
  });

  it('resyncs profile form fields when currentUser changes', async () => {
    const updatedUser: CurrentUser = {
      ...baseUser,
      fullName: 'Jane Updated',
      email: 'jane.updated@example.com',
      language: 'en',
    };

    const { host, rerender } = renderScreen();

    act(() => {
      rerender({ currentUser: updatedUser });
    });

    await act(async () => {
      await flushMicrotasks();
    });

    const fullNameInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.fullNameInput),
      'Expected full-name input',
    );
    const emailInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.emailInput),
      'Expected email input',
    );
    const languageSelect = requireNode(
      queryByTestId<HTMLSelectElement>(host, QA_TEST_IDS.settings.languageSelect),
      'Expected language select',
    );

    expect(fullNameInput.value).toBe('Jane Updated');
    expect(emailInput.value).toBe('jane.updated@example.com');
    expect(languageSelect.value).toBe('en');
  });

  it('saves the rendered profile values through the session callback', () => {
    const updatedUser: CurrentUser = {
      ...baseUser,
      fullName: 'Jane Updated',
      email: 'jane.updated@example.com',
      language: 'en',
    };

    const { host, onUserUpdated } = renderScreen({ currentUser: updatedUser });
    const saveButton = requireNode(
      queryByTestId<HTMLButtonElement>(host, QA_TEST_IDS.settings.profileSave),
      'Expected save button',
    );

    act(() => {
      click(saveButton);
    });

    expect(onUserUpdated).toHaveBeenCalledWith({
      fullName: 'Jane Updated',
      email: 'jane.updated@example.com',
      language: 'en',
    });
  });

  it('uses the existing dark-mode toggle callback', () => {
    const { host, toggleDarkMode } = renderScreen();
    const button = requireNode(
      queryByTestId<HTMLButtonElement>(host, QA_TEST_IDS.settings.themeToggle),
      'Expected theme toggle button',
    );

    act(() => {
      click(button);
    });

    expect(toggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('submits one password change request for valid input', async () => {
    const fetchWithAuthMock = vi.mocked(fetchWithAuth);
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      status: 200,
    } as Response);

    const { host } = renderScreen();
    const currentInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.passwordCurrentInput),
      'Expected current-password input',
    );
    const nextInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.passwordNewInput),
      'Expected new-password input',
    );
    const confirmInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.passwordConfirmInput),
      'Expected confirm-password input',
    );
    const submitButton = requireNode(
      queryByTestId<HTMLButtonElement>(host, QA_TEST_IDS.settings.passwordSubmit),
      'Expected password submit button',
    );

    act(() => {
      updateValue(currentInput, 'old-password', 'input');
      updateValue(nextInput, 'new-password', 'input');
      updateValue(confirmInput, 'new-password', 'input');
    });

    await act(async () => {
      submit(submitButton);
      await flushMicrotasks();
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      baseUser.token,
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(currentInput.value).toBe('');
    expect(nextInput.value).toBe('');
    expect(confirmInput.value).toBe('');
  });

  it('shows a generic password error when the request fails', async () => {
    const fetchWithAuthMock = vi.mocked(fetchWithAuth);
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'backend says current password hash mismatch' }),
      status: 400,
    } as Response);

    const { host } = renderScreen();
    const currentInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.passwordCurrentInput),
      'Expected current-password input',
    );
    const nextInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.passwordNewInput),
      'Expected new-password input',
    );
    const confirmInput = requireNode(
      queryByTestId<HTMLInputElement>(host, QA_TEST_IDS.settings.passwordConfirmInput),
      'Expected confirm-password input',
    );
    const submitButton = requireNode(
      queryByTestId<HTMLButtonElement>(host, QA_TEST_IDS.settings.passwordSubmit),
      'Expected password submit button',
    );

    act(() => {
      updateValue(currentInput, 'old-password', 'input');
      updateValue(nextInput, 'new-password', 'input');
      updateValue(confirmInput, 'new-password', 'input');
    });

    await act(async () => {
      submit(submitButton);
      await flushMicrotasks();
    });

    expect(host.textContent).toContain('settings.security.error.failed');
    expect(host.textContent).not.toContain('backend says current password hash mismatch');
  });
});
