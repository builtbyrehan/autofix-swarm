# Quick Color Reference - AutoFix Swarm

## 🎨 Warm Palette Overview

| Color Name | Hex | Role |
|------------|-----|------|
| **Deep Brown** | `#220901` | Main background |
| **Dark Maroon** | `#621708` | Cards, elevated surfaces |
| **Rich Red** | `#941B0C` | Watcher agent, critical bugs |
| **Orange Red** | `#BC3908` | Reviewer agent, verification |
| **Golden Orange** | `#F6AA1C` | **LOGO + PRIMARY** - CTAs, Codex Fixer |
| **Soft Linen** | `#E6E1D7` | Primary text |
| **Muted Linen** | `#B8B3A8` | Body text |
| **Dark Linen** | `#8A8780` | Secondary text |

---

## 🚀 The Five Brand Colors

### 1. **Deep Brown** `#220901`
**HSL**: `11, 96%, 7%`
**Role**: Primary Background
- App background (gradient start)
- Darkest base layer
- Warm alternative to pure black

### 2. **Dark Maroon** `#621708`
**HSL**: `7, 83%, 21%`
**Role**: Cards & Surfaces
- Card backgrounds (with alpha)
- Panel containers
- Elevated surfaces
- Professional, warm depth

### 3. **Rich Red** `#941B0C`
**HSL**: `6, 84%, 32%`
**Role**: Watcher Agent + Critical Issues
- Watcher agent icon/badge
- Bug detection indicators
- Critical severity markers
- Conveys vigilance, urgency

### 4. **Orange Red** `#BC3908`
**HSL**: `16, 93%, 38%`
**Role**: Reviewer Agent + Verification
- Reviewer agent icon/badge
- Success/verification states
- Test passing indicators
- Balanced, confident validation

### 5. **Golden Orange** `#F6AA1C` ⭐ PRIMARY
**HSL**: `38, 92%, 54%`
**Role**: Logo + CTAs + Codex Fixer
- **LOGO COLOR** (maximum navbar visibility)
- All primary CTAs
- Codex Fixer agent
- Links, hover states, focus rings
- Warm, energetic, calls to action

---

## 📝 Text Colors

### Primary Text - Soft Linen `#E6E1D7`
**HSL**: `40, 22%, 91%`
- Headings (h1, h2, h3)
- Important labels
- High-contrast text

### Body Text - Muted Linen `#B8B3A8`
**HSL**: `40, 11%, 66%`
- Paragraph text
- Descriptions
- Most UI text

### Secondary Text - Dark Linen `#8A8780`
**HSL**: `40, 5%, 51%`
- Hints
- Timestamps
- Less important labels
- Disabled text

---

## 🎯 Interactive States

### Primary Button (Golden Orange)
```css
background: linear-gradient(135deg, #F6AA1C, #E59B12);
color: #220901;
box-shadow: 0 4px 12px rgba(246, 170, 28, 0.3);
```

**Hover:**
```css
background: linear-gradient(135deg, #FFB933, #F6AA1C);
box-shadow: 0 8px 24px rgba(246, 170, 28, 0.5);
transform: translateY(-2px);
```

### Secondary Button (Rich Red)
```css
background: rgba(148, 27, 12, 0.3);
border: 1px solid rgba(148, 27, 12, 0.6);
color: #E6E1D7;
```

**Hover:**
```css
background: rgba(148, 27, 12, 0.5);
border-color: #941B0C;
box-shadow: 0 4px 12px rgba(148, 27, 12, 0.3);
```

### Card Hover
```css
border-color: rgba(246, 170, 28, 0.4); /* Golden orange */
box-shadow: 0 4px 20px rgba(246, 170, 28, 0.25);
```

---

## 🔴 Status & Severity Colors

### Success - Emerald Green `#10B981`
- Tests passed
- Fix succeeded
- Healthy status

### Warning - Amber `#F59E0B`
- Performance issues
- Deprecated code
- Caution needed

### Error - Red `#DC2626`
- Critical bugs
- Failed tests
- Security issues

### Info - Golden Orange `#F6AA1C`
- Suggestions
- General information
- Best practices

---

## 🤖 Agent Colors

| Agent | Color | Hex | Purpose |
|-------|-------|-----|---------|
| **Watcher** | Rich Red | `#941B0C` | Detection, scanning |
| **Codex Fixer** | Golden Orange | `#F6AA1C` | Fixing, primary action |
| **Reviewer** | Orange Red | `#BC3908` | Verification, validation |

---

## 🎨 Common Patterns

### "What color should I use for..."

1. **A button?** → Golden Orange `#F6AA1C` (primary) or Rich Red `#941B0C` (secondary)
2. **A heading?** → Soft Linen `#E6E1D7`
3. **Body text?** → Muted Linen `#B8B3A8`
4. **A background?** → Deep Brown `#220901` or Card `#621708`
5. **The Watcher agent?** → Rich Red `#941B0C`
6. **The Codex Fixer?** → Golden Orange `#F6AA1C`
7. **The Reviewer?** → Orange Red `#BC3908`
8. **Something succeeded?** → Green `#10B981`
9. **Something failed?** → Red `#DC2626`
10. **An icon?** → Golden Orange `#F6AA1C` or Soft Linen `#E6E1D7`
11. **A border?** → `rgba(74, 24, 18, 0.5)` (subtle maroon)
12. **On hover?** → Add golden orange glow `rgba(246, 170, 28, 0.4)`

---

## 🎯 Logo Specifications

**Color**: `#F6AA1C` (Golden Orange)
**Why**: Maximum visibility on dark navbar `#220901`, aligns with primary CTA system
**Format**: Icon only, no text, transparent background
**Style**: Minimalist, geometric, professional SaaS quality

---

## 🔍 Accessibility

All text/background combinations meet **WCAG AA** standards:
- Soft Linen on Deep Brown: ✅ AAA
- Muted Linen on Deep Brown: ✅ AA
- Golden Orange on Deep Brown: ✅ AA
- Dark text on Golden Orange: ✅ AAA

---

## 📦 CSS Variable Names

```css
/* In globals.css */
--background: 11 96% 7%;          /* #220901 */
--card: 7 83% 21%;                /* #621708 */
--primary: 38 92% 54%;            /* #F6AA1C */
--secondary: 6 84% 32%;           /* #941B0C */
--tertiary: 16 93% 38%;           /* #BC3908 */
--foreground: 40 22% 91%;         /* #E6E1D7 */
--muted-foreground: 40 11% 66%;   /* #B8B3A8 */
```

---

## 🎨 Figma/Design Specs

When exporting designs:
- Export logo as `#F6AA1C` (Golden Orange)
- Background: `#220901` (Deep Brown)
- Text: `#E6E1D7` (Soft Linen) for headings
- Text: `#B8B3A8` (Muted Linen) for body
- CTAs: `#F6AA1C` (Golden Orange)

---

**Last Updated**: July 19, 2026
**Theme**: Warm, professional, technical
**Logo Color**: #F6AA1C (Golden Orange)
