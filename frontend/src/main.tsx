import '@fontsource-variable/inter/wght.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { daftarkanPembaruan } from './lib/pembaruan';
import { muatAwal } from './lib/sesi';

void muatAwal();
daftarkanPembaruan();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
