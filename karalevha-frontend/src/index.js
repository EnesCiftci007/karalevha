import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { LanguageProvider } from './i18n/LanguageContext';

// --- API FETCH INTERCEPTOR ---
// Tüm API isteklerine otomatik JWT Token eklemek için global fetch override
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    
    // Eğer istek bizim API'mize atılıyorsa (8000 portu veya göreceli path)
    if (typeof resource === 'string' && (resource.includes('8000') || resource.startsWith('/api'))) {
        const token = localStorage.getItem('token');
        if (token) {
            config = config || {};
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${token}`
            };
        }
    }
    
    return originalFetch(resource, config);
};
// ------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
