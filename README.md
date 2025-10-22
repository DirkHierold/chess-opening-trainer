# ♟️ Chess Opening Trainer

A mobile-first Progressive Web App for mastering chess opening repertoires using spaced repetition. Learn openings like scrolling through TikTok - addictive, fast, and effective.

## ✨ Features

### 🎯 Core Functionality
- **PGN Upload**: Import your opening repertoires from Lichess or any PGN source
- **Spaced Repetition**: SM-2 algorithm (like Anki) for optimal learning
- **Interactive Chessboard**: Drag-and-drop pieces to answer
- **Instant Feedback**: Correct moves auto-advance, incorrect moves show explanations
- **Multiple Repertoires**: Track progress separately for each opening

### 📱 Mobile-Optimized
- **TikTok-Style UX**: Continuous flow, no friction, no stopping
- **Touch Gestures**: Swipe to continue after mistakes
- **PWA Support**: Install on your phone like a native app
- **Offline First**: Works completely offline, no internet required
- **Dark Theme**: Easy on the eyes during long study sessions

### 📊 Progress Tracking
- **Streak Counter**: Track your learning consistency
- **Accuracy Stats**: See your improvement over time
- **Due Cards**: Only study what needs review
- **Resume Progress**: Pick up exactly where you left off

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd chess-opening-trainer

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the app.

### Building for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

The built files will be in the `dist/` directory, ready for deployment.

## 📖 How to Use

1. **Upload a PGN File**
   - Export your opening repertoire from Lichess Study
   - Click "Upload PGN File" on the home page
   - Your repertoire is converted into flashcards automatically

2. **Start Studying**
   - Click on a repertoire to begin
   - See a position, drag the correct piece to the correct square
   - Correct answers advance immediately
   - Incorrect answers show the right move + explanation
   - Swipe up to continue after mistakes

3. **Build Your Streak**
   - Come back daily to review due cards
   - The SM-2 algorithm schedules reviews optimally
   - Watch your accuracy and streak grow

## 🛠️ Tech Stack

- **React 19** + **TypeScript** - Type-safe component development
- **Vite** - Lightning-fast build tooling
- **chess.js** - Chess logic and PGN parsing
- **react-chessboard** - Touch-optimized chessboard component
- **vite-plugin-pwa** - Progressive Web App capabilities
- **LocalStorage** - Client-side data persistence

## 📂 Project Structure

```
src/
├── components/
│   ├── HomePage.tsx          # Upload & repertoire list
│   ├── HomePage.css
│   ├── StudySession.tsx      # Flashcard study interface
│   └── StudySession.css
├── utils/
│   ├── pgnParser.ts          # PGN to flashcard conversion
│   ├── sm2.ts                # Spaced repetition algorithm
│   └── storage.ts            # LocalStorage management
├── types.ts                  # TypeScript type definitions
└── App.tsx                   # Main app & routing
```

## 🎨 Design Philosophy

- **Zero Friction**: No clicking through menus or choosing difficulty
- **Addictive Flow**: Like social media, but you're learning chess
- **Mobile First**: Designed for phone use during commute/downtime
- **Instant Gratification**: See progress immediately with streak counter
- **No Backend**: All data stays on your device, privacy-first

## 🔒 Privacy

- **100% Local**: All data stored in browser LocalStorage
- **No Tracking**: Zero analytics, no cookies, no servers
- **Offline Capable**: Works without internet after first load
- **Your Data**: Export not implemented yet, but data never leaves your device

## 🚧 Future Enhancements

- [ ] Board orientation (play as Black)
- [ ] Delete/edit repertoires
- [ ] Export learning data
- [ ] Custom review intervals
- [ ] Audio feedback
- [ ] Puzzle mode for tactical positions
- [ ] Import from chess.com

## 📄 License

MIT License - feel free to use this for your own learning!

## 🙏 Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code)
- Chess logic by [chess.js](https://github.com/jhlywa/chess.js)
- Chessboard by [react-chessboard](https://github.com/Clariity/react-chessboard)
- SM-2 algorithm from [SuperMemo](https://www.supermemo.com/)
