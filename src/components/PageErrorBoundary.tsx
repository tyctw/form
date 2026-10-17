import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  declare props: Readonly<{ children: ReactNode }>;
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('頁面顯示失敗', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <section role="alert" className="max-w-lg border-2 border-slate-900 bg-white p-8 text-center shadow-[6px_6px_0_#0F172A]">
          <h1 className="text-2xl font-black">頁面暫時無法顯示</h1>
          <p className="mt-4 text-slate-600">請返回首頁再試一次，或重新載入頁面。</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link to="/" replace className="border-2 border-slate-900 px-4 py-2 font-bold">返回首頁</Link>
            <button onClick={() => window.location.reload()} className="border-2 border-slate-900 bg-emerald-300 px-4 py-2 font-bold">重新載入</button>
          </div>
        </section>
      </main>
    );
  }
}
