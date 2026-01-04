# WebToBook Design Guidelines

## Design Approach
**System Selected:** Material Design 3 with Fluent-inspired refinements
**Rationale:** Productivity-focused converter tool requires clarity and efficiency while maintaining professional polish. Material's elevation system works perfectly for floating chat widgets, while Fluent's typography provides the professional refinement needed.

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Headings:** 600 weight, tight tracking (-0.02em)
- **Body:** 400 weight, comfortable line-height (1.6)
- **Accents:** 500 weight for buttons and labels

### Spacing System
**Tailwind Units:** Exclusively use 2, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-4, p-6
- Section spacing: py-12, py-16, py-20
- Icon sizing: w-4, w-6, h-4, h-6

## AI Assistant Components

### Primary AI Button (Fixed Position)
**Location:** Bottom-right corner, 24px from edges (fixed)
**Structure:**
- Circular button, 56px diameter
- Contains AI sparkle icon (w-6 h-6) centered
- Elevation shadow: strong depth (shadow-2xl equivalent)
- Subtle pulse animation on idle (2s cycle, very gentle)

**States:**
- Default: High contrast, prominent
- Hover: Slight scale (1.05), increased shadow
- Active: Scale (0.95), reduced shadow
- Unread indicator: Small red dot badge (8px) positioned top-right

### Floating Chat Widget
**Appearance Trigger:** Click AI button
**Dimensions:** 
- Desktop: 400px width × 600px height
- Tablet: 380px × 580px
- Mobile: Full-screen takeover

**Position:** Anchored bottom-right, 16px gap from AI button

**Structure - Header:**
- Height: 64px, p-4
- Left: "AI Assistant" title (font-semibold)
- Right: Minimize and close icons (w-5 h-5)
- Bottom border: subtle divider

**Message Area:**
- Flexible height container with max-h constraint
- Overflow-y-scroll with custom thin scrollbar
- p-4 padding
- Messages: max-width 80%, alternate left/right alignment
- AI messages: left-aligned, distinct treatment
- User messages: right-aligned, consistent treatment
- Timestamp: text-xs, reduced opacity, mt-1

**Input Area:**
- Fixed at bottom, p-4
- Multi-line textarea with auto-expand (max 4 lines)
- Send button: icon-only (w-5 h-5 paper plane), positioned right inside input
- Suggestion chips above input: "Convert webpage", "Help with settings", "Export tips"

**Interaction Details:**
- Smooth slide-up entrance (300ms ease-out)
- Backdrop blur when open on mobile
- Suggestion chips: pill-shaped, p-2 px-4, dismissible
- Loading state: Three animated dots for AI thinking

## Hero Section

### Layout
**Height:** 70vh on desktop, 60vh on tablet, auto on mobile
**Container:** max-w-7xl mx-auto px-6

**Content Split:**
- Left column (50%): Text content, vertically centered
  - Eyebrow text: "Professional Web Conversion" (text-sm, font-medium)
  - H1: "Transform Web Content into Beautiful Books" (text-5xl, font-semibold, leading-tight)
  - Description: 2-3 sentences, text-lg, mt-6
  - CTA group: mt-8, flex gap-4
    - Primary: "Start Converting" (px-8 py-3)
    - Secondary: "See Examples" (px-8 py-3, outlined)
  - Trust indicators: mt-6, small text with icons (checkmarks): "10k+ conversions", "No signup required"

- Right column (50%): Hero image placement

### Hero Image
**Description:** Modern 3D illustration showing a web browser transforming into an open book with floating pages. Clean, gradient-rich style with soft shadows. Purple-to-blue gradient dominant tones that work in both light/dark modes.

**Placement:** Right 50% of hero, object-cover with aspect ratio maintained
**Treatment:** Subtle parallax on scroll (moves 20% slower than content)

**Buttons on Image Note:** If CTA buttons overlap image at any breakpoint, those buttons require backdrop-blur-md and semi-transparent background

## Icons
**Library:** Heroicons (outline for interface, solid for emphasis)
**Common Icons:**
- AI sparkle: Custom or stars icon
- Send: Paper airplane
- Close: X mark
- Minimize: Minus
- Settings: Cog

## Component Library

### Cards (for features/examples)
- Rounded corners: rounded-xl
- Padding: p-6
- Elevation: subtle shadow (shadow-md)
- Hover: lift effect (translateY -4px, shadow-lg)

### Form Inputs
- Height: h-12
- Padding: px-4
- Border: 1px solid, rounded-lg
- Focus: ring offset with increased border emphasis

### Navigation
- Sticky top, backdrop-blur
- Height: 64px
- Logo left, nav items center, dark mode toggle + AI button right
- Max-width: max-w-7xl mx-auto

This design balances professional utility with approachable AI assistance, ensuring the chat widget feels native to the application while maintaining clear visual hierarchy.