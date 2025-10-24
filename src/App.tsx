import { useState } from 'react';
import { HomePage } from './components/HomePage';
import { ChapterSelection } from './components/ChapterSelection';
import { StudySession } from './components/StudySession';
import { getRepertoire } from './utils/storage';
import './App.css';

type AppState = 'home' | 'chapters' | 'studying';

function App() {
  const [appState, setAppState] = useState<AppState>('home');
  const [currentRepertoireId, setCurrentRepertoireId] = useState<string | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);

  const handleSelectRepertoire = (repertoireId: string) => {
    setCurrentRepertoireId(repertoireId);
    setAppState('chapters');
  };

  const handleSelectChapter = (chapterId: string) => {
    setCurrentChapterId(chapterId);
    setAppState('studying');
  };

  const handleBackToHome = () => {
    setCurrentRepertoireId(null);
    setCurrentChapterId(null);
    setAppState('home');
  };

  const handleBackToChapters = () => {
    setCurrentChapterId(null);
    setAppState('chapters');
  };

  const currentRepertoire = currentRepertoireId ? getRepertoire(currentRepertoireId) : null;

  return (
    <div className="app">
      {appState === 'home' && <HomePage onStartStudy={handleSelectRepertoire} />}

      {appState === 'chapters' && currentRepertoire && (
        <ChapterSelection
          repertoireName={currentRepertoire.name}
          chapters={currentRepertoire.flashcards}
          onSelectChapter={handleSelectChapter}
          onBack={handleBackToHome}
        />
      )}

      {appState === 'studying' && currentRepertoireId && currentChapterId && (
        <StudySession
          repertoireId={currentRepertoireId}
          chapterId={currentChapterId}
          onExit={handleBackToChapters}
        />
      )}
    </div>
  );
}

export default App;
