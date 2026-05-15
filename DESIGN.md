---
name: HueModa
colors:
  surface: '#0f0c1b'
  surface-dim: '#0f0c1b'
  surface-bright: '#2e2749'
  surface-container-lowest: '#000000'
  surface-container-low: '#141123'
  surface-container: '#1b162d'
  surface-container-high: '#211c36'
  surface-container-highest: '#27213f'
  on-surface: '#e9e1ff'
  on-surface-variant: '#aea6cc'
  inverse-surface: '#fdf8ff'
  inverse-on-surface: '#575265'
  outline: '#787194'
  outline-variant: '#4a4464'
  surface-tint: '#cdcdff'
  primary: '#cdcdff'
  on-primary: '#404278'
  primary-container: '#bdbefe'
  on-primary-container: '#37396f'
  inverse-primary: '#585a92'
  secondary: '#c2caab'
  on-secondary: '#3c432c'
  secondary-container: '#212813'
  on-secondary-container: '#9fa78a'
  tertiary: '#f3ffcc'
  on-tertiary: '#506703'
  tertiary-container: '#d9f789'
  on-tertiary-container: '#485e00'
  error: '#fd6f85'
  on-error: '#490013'
  error-container: '#8a1632'
  on-error-container: '#ff97a3'
  primary-fixed: '#bdbefe'
  primary-fixed-dim: '#afb1ef'
  on-primary-fixed: '#222459'
  on-primary-fixed-variant: '#404278'
  secondary-fixed: '#ecf5d4'
  secondary-fixed-dim: '#dee6c6'
  on-secondary-fixed: '#434b33'
  on-secondary-fixed-variant: '#60674e'
  tertiary-fixed: '#defd8e'
  tertiary-fixed-dim: '#d0ee81'
  on-tertiary-fixed: '#3c4e00'
  on-tertiary-fixed-variant: '#556d0a'
  primary-dim: '#afb1ef'
  secondary-dim: '#b4bc9e'
  tertiary-dim: '#d0ee81'
  error-dim: '#c8475d'
  background: '#0f0c1b'
  on-background: '#e9e1ff'
  surface-variant: '#27213f'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 12px
  sidebar-width: 280px
  toolbar-width: 56px
  margin-sm: 8px
  margin-md: 16px
  margin-lg: 24px
---

## Brand & Style

The design system is engineered for high-performance creative workflows, prioritizing visual focus on user content while providing a high-tech, sophisticated utility layer. With the move to an **Expressive** variant, the brand personality shifts from purely clinical to a more nuanced, sophisticated aesthetic. It remains professional and precise but introduces a more curated, editorial feel through its unique color palette.

The aesthetic follows a **Corporate/Modern** philosophy with a **Minimalist** execution. It utilizes a "darkroom" approach, but instead of pure neutrals, it uses tinted "chromatic blacks" and muted earth-tones (lavender and olive) to create a workspace that feels both technical and organic.

Key characteristics include:
- **Precision-driven:** Sharp lines and consistent spacing convey a sense of technical excellence.
- **Sophisticated Palette:** The shift to expressive tones like muted lavender and olive green provides a distinct visual identity that sets it apart from generic "dark mode" interfaces.
- **Content-first:** Deeply tinted surfaces minimize eye strain while providing a rich, immersive backdrop for photography and design work.

## Colors

The palette is optimized for a professional dark mode environment using an **Expressive** color strategy. Rather than using pure grays, the system utilizes a "chromatic neutral" foundation based on muted slate-purple tones (#797488).

- **Primary Accent:** A muted lavender-slate (#7072ac) is used for primary actions, selection states, and focus indicators, offering a softer yet authoritative presence.
- **Secondary Accent:** A sophisticated olive green (#727a5f) is used for secondary tools and data visualization, providing a natural contrast to the lavender primary.
- **Tertiary Accent:** A deep moss green (#678020) is utilized for specialized status indicators and successful states.
- **Neutral Stack:**
    - **Base:** #0E0E11 (The deepest layer, used for the main workspace background).
    - **Surface:** #1F1F22 (Used for sidebars and tool panels, tinted with the system's slate-purple neutral).
    - **Surface-Elevated:** #353438 (Used for tooltips, menus, and floating modals).
- **Text:** High-contrast white (#FAFAFA) for primary headers, scaling down to a muted, color-tinted gray (#A1A1AA) for labels and metadata to maintain visual hierarchy.

## Typography

This design system utilizes **Geist** for its technical precision and exceptional readability at small sizes. The typeface’s monospaced-inspired terminals and clean geometry reinforce the "high-performance tool" aesthetic.

For mobile or smaller viewports, `display-lg` should be avoided. Use `headline-md` for primary screen titles. The `label-sm` style is critical for tool-heavy panels (e.g., slider names, histogram data), where its uppercase treatment and slight letter-spacing provide clarity in dense layouts.

All numerical data within the photo editing panels should utilize tabular figures if available to ensure that values do not jump when being edited or scrubbed.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for the utility interface while maintaining a **Fluid** viewport for the canvas/image area. This mimics professional desktop software where tools are anchored to the edges.

- **The Workspace:** A 12-column grid is used within the fluid center area, though most layouts will prioritize the 4px baseline rhythm.
- **Sidebars:** Fixed-width panels at 280px house the complex editing controls (Levels, Layers, Brushes).
- **Toolbars:** A slim 56px vertical rail on the far left or right for quick tool switching.
- **Rhythm:** Use a strict 4px / 8px spacing system. For tool density, 4px and 8px gaps are standard. For container padding, 12px or 16px is used to define clear groupings.

## Elevation & Depth

This design system avoids traditional drop shadows to maintain a sleek, modern, and flat aesthetic. Instead, it uses **Tonal Layers** and **Low-contrast Outlines** to communicate depth, enriched by the system's chromatic neutral palette.

- **Layering:** The hierarchy is defined by lightness and color saturation. The further "back" an element is, the darker and more desaturated it is. Backgrounds use the base black, while interactive panels use the slightly lighter Surface gray.
- **Outlines:** Containers are defined by 1px solid borders in a subtle gray-purple (#464554). For active elements or focused inputs, this border transitions to the Primary Muted Lavender or a lighter gray.
- **Backdrop Blur:** For floating menus or dropdowns, a subtle 8px backdrop blur is applied behind the surface-elevated color to create a "glass" effect that picks up the underlying atmospheric colors.

## Shapes

The shape language is **Rounded** (8px radius). This creates a softened, modern aesthetic that balances the expressive color palette, making the professional tool feel more accessible and current.

- **Standard Elements:** Buttons, inputs, and sliders use an 8px (0.5rem) radius.
- **Large Containers:** Modals or larger cards may use 16px (1rem) to signify a higher level of containment.
- **Interactive States:** On hover, backgrounds for list items or menu options use the 8px radius to create a "rounded-tile" appearance.

## Components

### Buttons
Primary buttons use the muted lavender background (#7072ac) with white text. Secondary buttons use a ghost style (border only) or a subtle olive-tinted background. All buttons feature an 8px corner radius. Hover states should involve a slight lightening of the background color.

### Sliders (The Core Editor)
Sliders are the most critical component. They feature a 2px horizontal track in a dark chromatic neutral, with a circular 12px thumb. The track "fills" with the primary lavender color as the value increases from the left or center.

### Sleek Accordions
Panels are separated by 1px horizontal dividers. The accordion header uses `label-sm` typography and a small chevron. When expanded, the background of the header should remain flat to keep the focus on the controls within.

### Tactile Toggles
Toggles are small and pill-shaped. When "on," the background is the primary lavender or secondary olive green. The switch itself should have a subtle gradient to appear slightly metallic or tactile.

### Input Fields
Inputs are minimal: a 1px border on all sides or a simple bottom border for "value scrubbing" fields. They utilize an 8px radius to match the system-wide shape language and use a slightly darker background than the panel they sit on.

### Chips & Badges
Used for metadata (e.g., ISO, Shutter Speed). These are small, dark-slate pills with low-contrast tinted text and a fully rounded (pill) shape, ensuring they provide information without visual clutter.
