import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom'; // 修改這裡
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter> {/* 修改這裡，並移除 basename */}
      <App />
    </HashRouter>
  </StrictMode>,
);
