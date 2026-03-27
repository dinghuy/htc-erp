import { useState, useEffect } from 'preact/hooks';
import { Layout } from './Layout';
import { Leads } from './Leads';
import { Pricing } from './Pricing';
import { Products } from './Products';
import { NotificationContainer, showNotify } from './Notification';
import { Login } from './Login';
import { ForceChangePassword } from './ForceChangePassword';
import { tokens } from './ui/tokens';
import { type CurrentUser, type SystemRole, buildRoleProfile, loadSession, saveSession, clearSession } from './auth';
import type { RolePreviewNavigation } from './authRolePreview';
import { I18nContext, type Locale, translate } from './i18n';
import { isKnownRoute, resolveProtectedRoute } from './core/routes';
import { clearNavContext, setNavContext } from './navContext';
import type { AppModule } from './shared/domain/contracts';
import { routeTestId } from './testing/testIds';
import { Approvals } from './Approvals';
import { Home } from './Home';
import { Inbox } from './Inbox';
import { MyWork } from './MyWork';
import { UsersRoute } from './features/admin';
import { CustomersRoute } from './features/customers';
import { EventLogRoute } from './features/event-log';
import { GanttRoute, OpsChatRoute, OpsOverviewRoute, OpsStaffRoute } from './features/operations';
import { ProjectsRoute } from './features/projects';
import { QuotationsRoute } from './features/quotations';
import { ReportsRoute } from './features/reports';
import { SalesOrdersRoute } from './features/sales-orders';
import { SettingsRoute } from './features/settings';
import { SupportRoute } from './features/support';
import { TasksRoute } from './features/tasks';

export function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => loadSession());
  const [currentRoute, setCurrentRoute] = useState<AppModule>('Home');
  const [autoOpenQuote, setAutoOpenQuote] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [locale, setLocale] = useState<Locale>(() => (loadSession()?.language as Locale) || 'vi');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const persistAndSetUser = (user: CurrentUser) => {
    saveSession(user);
    const nextUser = loadSession();
    setCurrentUser(nextUser);
    setLocale((nextUser?.language as Locale) || 'vi');
  };

  const handleLogin = (user: CurrentUser) => {
    persistAndSetUser(user);
    setCurrentRoute('Home');
  };

  const handleLogout = () => {
    clearNavContext();
    clearSession();
    setCurrentUser(null);
    setLocale('vi');
  };

  const t = (key: string, params?: any) => translate(locale, key, params);

  let content: any = null;

  if (!currentUser) {
    content = <Login onLogin={handleLogin} />;
  } else if (currentUser.mustChangePassword === true) {
    content = (
      <ForceChangePassword
        currentUser={currentUser}
        onDone={(updatedUser: CurrentUser) => {
          persistAndSetUser(updatedUser);
        }}
      />
    );
  } else {
    const roleProfile = buildRoleProfile(currentUser.roleCodes, currentUser.systemRole);
    const allowedModules = roleProfile.allowedModules;
    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
    const handleRolePreviewChange = (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => {
      if (!currentUser) return;
      persistAndSetUser({
        ...currentUser,
        previewRoleCodes: previewRoleCodes && previewRoleCodes.length > 0 ? previewRoleCodes : undefined,
      });
      if (navigation?.navContext) {
        setNavContext(navigation.navContext);
      }
      setCurrentRoute(navigation?.route || 'Home');
    };

    const handleNavigate = (route: string) => {
      if (route === 'Logout') { handleLogout(); return; }
      if (route === 'NewDeal') {
        if (!allowedModules.includes('Sales')) {
          clearNavContext();
          showNotify('Bạn không có quyền tạo báo giá mới trong vai trò hiện tại.', 'error');
          return;
        }
        setAutoOpenQuote(true);
        setCurrentRoute('Sales');
      } else {
        const targetRoute = resolveProtectedRoute(route, allowedModules);
        if (!allowedModules.includes(route as AppModule) && !allowedModules.includes(targetRoute)) {
          clearNavContext();
          showNotify('Bạn không có quyền truy cập màn hình này.', 'error');
          return;
        }
        setCurrentRoute(targetRoute);
      }
    };

    const resolvedRoute = resolveProtectedRoute(currentRoute, allowedModules);
    const contentTestId = routeTestId(resolvedRoute);

    content = (
      <Layout currentRoute={resolvedRoute} onNavigate={handleNavigate} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} isMobile={isMobile} currentUser={currentUser} onRolePreviewChange={handleRolePreviewChange} contentTestId={contentTestId}>
        {resolvedRoute === 'Home' && <Home currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'My Work' && <MyWork currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Inbox' && <Inbox currentUser={currentUser} />}
        {resolvedRoute === 'Approvals' && <Approvals currentUser={currentUser} />}
        {resolvedRoute === 'Leads' && <Leads isMobile={isMobile} currentUser={currentUser} />}
        {resolvedRoute === 'Accounts' && <CustomersRoute route="Accounts" isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Contacts' && <CustomersRoute route="Contacts" isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Partners' && <CustomersRoute route="Partners" isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Equipment' && <Products isMobile={isMobile} currentUser={currentUser} />}
        {resolvedRoute === 'Suppliers' && <CustomersRoute route="Suppliers" isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Sales' && (
          <QuotationsRoute
            autoOpenForm={autoOpenQuote}
            onFormOpened={() => setAutoOpenQuote(false)}
            isMobile={isMobile}
            currentUser={currentUser}
          />
        )}
        {resolvedRoute === 'Ops Overview' && <OpsOverviewRoute isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Gantt' && <GanttRoute currentUser={currentUser} />}
        {resolvedRoute === 'Ops Staff' && <OpsStaffRoute isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Ops Chat' && <OpsChatRoute currentUser={currentUser} />}
        {resolvedRoute === 'Projects' && <ProjectsRoute isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Tasks' && <TasksRoute isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'ERP Orders' && <SalesOrdersRoute isMobile={isMobile} currentUser={currentUser} onNavigate={handleNavigate} />}
        {resolvedRoute === 'Pricing' && <Pricing isMobile={isMobile} currentUser={currentUser} />}
        {resolvedRoute === 'Reports' && <ReportsRoute isMobile={isMobile} currentUser={currentUser} />}
        {resolvedRoute === 'EventLog' && <EventLogRoute onNavigate={handleNavigate} isMobile={isMobile} currentUser={currentUser} />}
        {resolvedRoute === 'Users' && <UsersRoute isMobile={isMobile} currentUser={currentUser} />}
        {resolvedRoute === 'Settings' && (
          <SettingsRoute
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            isMobile={isMobile}
            currentUser={currentUser}
            onRolePreviewChange={handleRolePreviewChange}
            onUserUpdated={(partial: Partial<CurrentUser>) => {
              const merged: CurrentUser = { ...currentUser, ...partial };
              persistAndSetUser(merged);
            }}
          />
        )}
        {resolvedRoute === 'Support' && <SupportRoute isMobile={isMobile} currentUser={currentUser} />}

        {!isKnownRoute(resolvedRoute) && (
          <div style={{ padding: '60px', textAlign: 'center', color: tokens.colors.textSecondary, fontSize: '15px' }}>
            {t('app.module.building', { name: resolvedRoute })}
          </div>
        )}
        <NotificationContainer />
      </Layout>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {content}
    </I18nContext.Provider>
  );
}
