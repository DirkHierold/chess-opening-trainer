import { useState } from 'react';
import { HomePage } from './components/HomePage';
import { StudySession } from './components/StudySession';
import './App.css';

type AppState = 'home' | 'studying';

function App() {
  const [appState, setAppState] = useState<AppState>('home');
  const [currentRepertoireId, setCurrentRepertoireId] = useState<string | null>(null);

  const handleStartStudy = (repertoireId: string) => {
    setCurrentRepertoireId(repertoireId);
    setAppState('studying');
  };

  const handleExitStudy = () => {
    setCurrentRepertoireId(null);
    setAppState('home');
  };

  return (
    <div className="app">
      {appState === 'home' && <HomePage onStartStudy={handleStartStudy} />}
      {appState === 'studying' && currentRepertoireId && (
        <StudySession repertoireId={currentRepertoireId} onExit={handleExitStudy} />
      )}
    </div>
  );
}

export default App;
