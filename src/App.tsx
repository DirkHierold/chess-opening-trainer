import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { ChapterSelection } from './components/ChapterSelection';
import { StudySession } from './components/StudySession';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/repertoire/:repertoireId" element={<ChapterSelection />} />
          <Route path="/repertoire/:repertoireId/chapter/:chapterId" element={<StudySession />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
