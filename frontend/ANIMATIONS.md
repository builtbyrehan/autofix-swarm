# GSAP Animations - AutoFix Swarm

## 🎨 Animation Components Added

### 1. **AnimatedBackground** (`/components/AnimatedBackground.tsx`)
- **What it does**: Canvas-based particle system with connecting lines
- **Effect**: Floating particles in warm colors (#F6AA1C, #BC3908, #941B0C, #621708)
- **Features**:
  - 50 animated particles moving across the screen
  - Dynamic connections between nearby particles
  - Wraps around screen edges
  - Low opacity (0.4) so doesn't interfere with content

### 2. **SplitText** (`/components/SplitText.tsx`)
- **What it does**: Animates text character-by-character or word-by-word
- **Effect**: Letters fade in and slide up with stagger
- **Used on**: Main heading "Software That Fixes Itself."
- **Features**:
  - Scroll-triggered animation
  - Customizable delay, duration, ease
  - Multiple split types (chars, words, lines)
  - Font-loading detection

### 3. **AnimatedCard** (`/components/AnimatedCard.tsx`)
- **What it does**: Animates cards on scroll into view
- **Effect**: Cards fade in and slide from specified direction
- **Used on**: 
  - Stats grid (4 cards)
  - Agent cards (3 cards: Watcher, Codex Fixer, Reviewer)
  - System status panel
- **Features**:
  - Directional entry (left, right, top, bottom)
  - Stagger delays for sequential animation
  - Scale + opacity + position transition
  - ScrollTrigger with reverse on scroll up

### 4. **CounterAnimation** (`/components/CounterAnimation.tsx`)
- **What it does**: Counts up numbers from 0 to target value
- **Effect**: Numbers smoothly increment when visible
- **Used on**: Stats cards (Pipeline Runs, Issues, Fixes, Success Rate)
- **Features**:
  - Intersection Observer for scroll detection
  - Customizable duration and suffix (e.g., "%")
  - Only animates once per page load

### 5. **MagneticButton** (`/components/MagneticButton.tsx`)
- **What it does**: Buttons follow mouse cursor within their bounds
- **Effect**: Magnetic attraction effect on hover
- **Used on**: 
  - "Launch Dashboard" button
  - "View Documentation" button
- **Features**:
  - Smooth elastic return animation
  - Adjustable strength parameter
  - Works on hover + mouse move

### 6. **InfiniteScroll** (`/components/InfiniteScroll.tsx`)
- **What it does**: Creates seamless infinite scrolling marquee
- **Effect**: Tech stack logos scroll continuously
- **Used on**: Tech stack section (OpenAI Codex, GPT-5.6, Semgrep, etc.)
- **Features**:
  - Bidirectional (left/right)
  - Adjustable speed
  - Seamless loop with cloned content
  - No gaps or jumps

---

## 🎬 Animation Sequence on Page Load

1. **Background particles** start animating immediately
2. **Heading** ("Software That Fixes Itself.") - character animation (0.5s)
3. **Tagline** visible immediately
4. **Buttons** ready for magnetic interaction
5. **Stats cards** animate in as user scrolls (staggered 0.1s apart)
6. **Agent cards** animate in (staggered 0.2s apart, directional)
7. **System status** animates in from bottom
8. **Tech marquee** scrolls continuously

---

## 🎯 Key GSAP Features Used

| Feature | Where Used | Purpose |
|---------|------------|---------|
| **ScrollTrigger** | SplitText, AnimatedCard | Trigger animations on scroll |
| **Stagger** | SplitText, AnimatedCard | Sequential animation delays |
| **fromTo** | SplitText, AnimatedCard | Define start and end states |
| **Modifiers** | InfiniteScroll | Custom value transformation |
| **Elastic ease** | MagneticButton | Bouncy return effect |
| **Power3 ease** | Most animations | Smooth, professional easing |
| **Timeline** | Canvas animation | Coordinate particle movements |

---

## 🎨 CSS Enhancements Added

### Enhanced Hover Effects
```css
.glass-panel:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(246, 170, 28, 0.3);
}
```

### Shimmer Effect
```css
.glass-panel::before {
  /* Light sweep on hover */
  background: linear-gradient(90deg, transparent, rgba(246, 170, 28, 0.1), transparent);
}
```

### Split Text Styles
```css
.split-char {
  display: inline-block;
  transform-origin: center;
  color: #E6E1D7;
}
```

---

## 📊 Performance Considerations

1. **Force3D**: Enabled on split text for GPU acceleration
2. **WillChange**: Set on animated elements to optimize rendering
3. **FastScrollEnd**: Enabled on ScrollTrigger for better scroll performance
4. **Once**: SplitText animations only play once per page load
5. **Cleanup**: All animations properly cleaned up on component unmount

---

## 🚀 How to Customize

### Change Animation Speed
```tsx
<AnimatedCard delay={0.5} duration={1.5}>
  {/* Your content */}
</AnimatedCard>
```

### Change Counter Duration
```tsx
<CounterAnimation end={100} duration={3} suffix="%" />
```

### Adjust Magnetic Strength
```tsx
<MagneticButton strength={0.5}>
  {/* Stronger magnetic pull */}
</MagneticButton>
```

### Change Scroll Speed
```tsx
<InfiniteScroll speed={60} direction="right">
  {/* Faster scroll, moving right */}
</InfiniteScroll>
```

### Modify Particle Count
Edit `AnimatedBackground.tsx`:
```tsx
const particleCount = 100; // More particles
```

---

## 🎪 Interactive Features Summary

| Component | Interaction Type | User Feedback |
|-----------|------------------|---------------|
| **MagneticButton** | Hover + Mouse Move | Button follows cursor |
| **AnimatedCard** | Scroll | Fade in + slide |
| **CounterAnimation** | Scroll | Number counts up |
| **Glass Panel** | Hover | Lift + glow + shimmer |
| **Particles** | Passive | Ambient movement |
| **Marquee** | Passive | Continuous scroll |

---

## 🔧 Dependencies

```json
{
  "gsap": "^3.x.x",
  "@gsap/react": "^2.x.x"
}
```

**Note**: GSAP Club plugins (SplitText) require a GSAP membership for commercial use.

---

## 🎨 Color Palette in Animations

All animations use the warm color palette:
- Primary: `#F6AA1C` (Golden Orange)
- Secondary: `#BC3908` (Orange Red)
- Tertiary: `#941B0C` (Rich Red)
- Dark: `#621708` (Dark Maroon)
- Background: `#220901` (Deep Brown)

---

## 📝 Future Enhancement Ideas

- [ ] Parallax scrolling on background particles
- [ ] Page transition animations
- [ ] Loading skeleton animations
- [ ] Toast notification animations
- [ ] Modal enter/exit animations
- [ ] Chart/graph animations for stats
- [ ] Cursor trail effect
- [ ] Morphing SVG animations
- [ ] 3D card flip effects

---

**Last Updated**: July 19, 2026  
**Status**: ✅ Fully implemented and tested
