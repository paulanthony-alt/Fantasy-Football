import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/globals.css';
import { App } from './App';
import { configureRepository } from './data/repository';
import { useUi } from './store/ui';

const ui = useUi.getState();
configureRepository({ live: ui.liveData, nflverseStats: ui.nflverseStats });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
