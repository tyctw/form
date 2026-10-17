import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Information from './pages/Information';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <PageErrorBoundary key={location.key}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/guide" element={<Information />} />
          <Route path="/privacy" element={<Information />} />
          <Route path="/disclaimer" element={<Information />} />
          <Route path="*" element={
            <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
              <h1 className="text-2xl font-black">找不到這個頁面</h1>
              <p>連結可能已變更，請返回首頁繼續使用。</p>
              <Link to="/" replace className="border-2 border-slate-900 bg-white px-6 py-3 font-bold">返回首頁</Link>
            </main>
          } />
        </Routes>
      </PageErrorBoundary>
    </>
  );
}
