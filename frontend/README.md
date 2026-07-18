# AutoFix Swarm Frontend

Modern developer tool dashboard built with Next.js 14, React 18, and Tailwind CSS.

## 🎨 Design System

### Color Palette (Dark Mode - NO Purple!)
- **Primary**: Cyan (#06b6d4) - Main brand color
- **Accent**: Teal (#14b8a6) - Secondary highlights  
- **Background**: Slate-900 (#0f172a) - Deep dark background
- **Cards**: Slate-800 (#1e293b) - Elevated surfaces
- **Success**: Green (#10b981)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#dc2626)
- **Info**: Cyan (#06b6d4)

### Typography
- **Sans**: Inter (UI text)
- **Mono**: JetBrains Mono (code, metrics)

### UI Style
- Glassmorphism effects with backdrop blur
- Subtle cyan/teal gradients (NO purple/pink AI gradients)
- Developer tool aesthetic with terminal vibes
- Smooth transitions (200-300ms)
- Status indicators with glow effects

## 🚀 Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📂 Project Structure

```
frontend/
├── src/
│   └── app/
│       ├── layout.tsx          # Root layout with fonts
│       ├── page.tsx             # Home/landing page
│       ├── dashboard/
│       │   └── page.tsx         # Main dashboard
│       └── globals.css          # Global styles + dark theme
├── public/                      # Static assets
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript config
└── package.json                 # Dependencies
```

## 🎯 Features

### Home Page
- System status indicators
- Stats overview (pipeline runs, issues, fixes, success rate)
- Three-agent explanation
- CTA to dashboard

### Dashboard
- Real-time pipeline status
- Run pipeline button
- Issues list with severity badges
- Fixes list with status indicators
- Verification results with test outcomes
- Refresh functionality

## 🎨 UI Components

### Status Indicators
- Success (green glow)
- Warning (amber glow)
- Error (red glow)
- Info (cyan glow)

### Severity Badges
- Critical (red)
- High (orange)
- Medium (amber)
- Low (yellow)

### Cards
- Glass panel effect (backdrop blur + transparency)
- Hover glow on interactive elements
- Smooth transitions

## 🔗 API Integration

All API calls point to `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`)

### Endpoints Used:
- `GET /health` - System health status
- `GET /results/latest` - Latest pipeline run
- `GET /issues/{run_id}` - Issues from a run
- `GET /fixes/{run_id}` - Fixes from a run
- `GET /verdicts/{run_id}` - Verdicts from a run
- `POST /run` - Trigger new pipeline run

## 🚢 Production Build

```bash
npm run build
npm start
```

## 📝 Development Notes

### Design Principles
1. **Developer-First**: Terminal aesthetic, code-friendly visuals
2. **Dark Mode Only**: Optimized for long coding sessions
3. **NO Purple/Pink**: Cyan/teal palette for modern, professional look
4. **Performance**: Fast transitions, minimal animations
5. **Accessibility**: WCAG AA contrast ratios, keyboard navigation

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS 3.4
- **Icons**: Lucide React
- **Fonts**: Inter + JetBrains Mono (Google Fonts)
- **TypeScript**: 5.5

## 🎯 Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Timeline visualization component
- [ ] Code diff viewer
- [ ] Export results (PDF/JSON)
- [ ] Filter and search functionality
- [ ] Dark/light theme toggle (optional)

## 📄 License

See project root LICENSE file.
