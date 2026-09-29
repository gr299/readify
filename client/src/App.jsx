import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import { Footer } from './components/Footer.jsx';
import { RequireAuth, RequireAdmin, RequireGuest } from './components/RouteGuards.jsx';
import HomePage from './pages/HomePage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import AuthorProfilePage from './pages/AuthorProfilePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import UserDashboardPage from './pages/UserDashboardPage.jsx';
import ArticleEditorPage from './pages/ArticleEditorPage.jsx';
import SavedPage from './pages/SavedPage.jsx';
import MyProfilePage from './pages/MyProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboardPage from './pages/admin/DashboardPage.jsx';
import AdminArticlesPage from './pages/admin/ArticlesPage.jsx';
import AdminUsersPage from './pages/admin/UsersPage.jsx';
import AdminCommentsPage from './pages/admin/CommentsPage.jsx';
import AdminReactionsPage from './pages/admin/ReactionsPage.jsx';
import AdminCategoriesPage from './pages/admin/CategoriesPage.jsx';
import AdminTagsPage from './pages/admin/TagsPage.jsx';
import AdminFeaturedPage from './pages/admin/FeaturedPage.jsx';
import AdminAnalyticsPage from './pages/admin/AnalyticsPage.jsx';
import AdminActivityPage from './pages/admin/ActivityPage.jsx';
import AdminSettingsPage from './pages/admin/SettingsPage.jsx';
import AdminDomainsPage from './pages/admin/DomainsPage.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PublicLayout({ children }) {
  const { pathname } = useLocation();
  return (
    <>
      <Navbar />
      <main className="main" key={pathname}>
        {children}
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
      <Route path="/discover" element={<PublicLayout><DiscoverPage /></PublicLayout>} />
      <Route path="/article/:id" element={<PublicLayout><ArticlePage /></PublicLayout>} />
      <Route path="/authors/:id" element={<PublicLayout><AuthorProfilePage /></PublicLayout>} />
      <Route path="/login" element={<PublicLayout><RequireGuest><LoginPage /></RequireGuest></PublicLayout>} />
      <Route path="/forgot-password" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
      <Route path="/register" element={<PublicLayout><RequireGuest><RegisterPage /></RequireGuest></PublicLayout>} />
      <Route path="/saved" element={<PublicLayout><RequireAuth><SavedPage /></RequireAuth></PublicLayout>} />
      <Route
        path="/profile"
        element={
          <PublicLayout>
            <RequireAuth>
              <MyProfilePage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <PublicLayout>
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route
        path="/verify-email"
        element={
          <PublicLayout>
            <VerifyEmailPage />
          </PublicLayout>
        }
      />

      <Route
        path="/dashboard"
        element={
          <PublicLayout>
            <RequireAuth>
              <UserDashboardPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route
        path="/upload"
        element={
          <PublicLayout>
            <RequireAuth>
              <ArticleEditorPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route
        path="/article/:id/edit"
        element={
          <PublicLayout>
            <RequireAuth>
              <ArticleEditorPage />
            </RequireAuth>
          </PublicLayout>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="articles" element={<AdminArticlesPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="comments" element={<AdminCommentsPage />} />
        <Route path="reactions" element={<AdminReactionsPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="tags" element={<AdminTagsPage />} />
        <Route path="featured" element={<AdminFeaturedPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="domains" element={<AdminDomainsPage />} />
      </Route>

      <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
      </Routes>
    </>
  );
}
