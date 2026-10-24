# Authenticity Chain: presentation deck

A React website that behaves like a slide deck: 33 slides in five parts (the problem, the research, how it works,
the live demo, limitations), ending with a thank-you slide. Content comes from `../PPT_PROMPT.md`, the four papers in
`../papers`, and the demo in `../blockchain-demo`.

## Run it

Needs Node 18 or newer. (If your default Node is old, use `/opt/homebrew/bin/node`.)

```bash
export PATH=/opt/homebrew/bin:$PATH
cd presentation
npm install
npm run build
npm run preview        # open http://127.0.0.1:5180
```

No Node? After `npm run build`, serve the `dist` folder with any static server, for example
`python3 -m http.server 5180 --directory dist`.

## Keys

| Key | Action |
| --- | --- |
| Right arrow, Space, Enter | Next (a slide only pauses for a click where a reveal matters: the demo results and the main limitation) |
| Left arrow, Backspace | Back |
| F | Full screen on / off |
| O | Overview of all slides (press O or Esc to close) |
| T | Light / dark theme (light is the default for lit rooms) |
| N | Speaker notes |
| A | Turn animations off or on (diagrams then rest on their fully explained state) |

A control bar sits at the bottom centre (previous, slide count, next, Slides, theme, Fullscreen), laid out like the multimedia deck. It and the mouse pointer hide when the mouse is still, so the audience sees only slides. Swipe left or right on a touch screen to move.
Links: `#/12` opens slide 12, `#/12/1` opens it at its first click, and `?theme=dark` starts in the dark theme.

## Edit

- Team names and roll numbers: `TEAM` at the top of `src/slides.jsx`.
- Slide text and speaker notes: `src/slides.jsx`. The self-playing paper diagrams are in `src/research.jsx`.
- Artwork (title slide, section openers, watch pair, demo window): `src/art.jsx`.
- Colours, fonts and per-part looks: `src/styles.css` (Ledger Slate palette; Space Grotesk, Inter, JetBrains Mono, bundled offline).
- Each slide's content is scaled automatically to fit under its title, so adding text never overflows.
