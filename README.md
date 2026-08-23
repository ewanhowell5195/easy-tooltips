# easy-tooltips

A lightweight, zero-dependency tooltip library using modern JavaScript and CSS.  
Just add `data-easy-tooltip` to any element! No setup or config required.

[![npm version](https://badge.fury.io/js/easy-tooltips.svg)](https://www.npmjs.com/package/easy-tooltips)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/easy-tooltips/badge)](https://www.jsdelivr.com/package/npm/easy-tooltips)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**Live Demo**](https://easy-tooltips.ewanhowell.com/)

## Features

* No dependencies
* Works with mouse, touch, and keyboard focus
* Customizable via CSS variables
* Gradient and image backgrounds and borders
* Automatically repositions and shifts to fit the screen
* Smooth, non-interrupting animations with smart skip-delay between adjacent tooltips
* Anchor to the trigger element, the cursor, or where the user first hovered
* Plain text or arbitrary HTML content
* Seamless body + arrow drawn as a single SVG path
* Compatible with Vue, React, Svelte, and more

## Quick Start

### Install via npm
```bash
npm install easy-tooltips
```

```js
import "easy-tooltips/styles.css"
import "easy-tooltips"
```

### Or use via CDN
https://www.jsdelivr.com/package/npm/easy-tooltips

### Add tooltips to your HTML
```html
<button data-easy-tooltip="Click to save your changes">Save</button>
<span data-easy-tooltip="This field is required">Username *</span>
<div data-easy-tooltip="Multi-line tooltips&#10;are supported too">Info</div>
```

Multi-line text uses `&#10;` (newline). For full HTML content see [Custom HTML](#custom-html) below.

No additional setup is needed for Vue, React, Svelte, or other frameworks! Tooltips automatically update when the element updates!

Tooltips also show on keyboard focus. Natively focusable elements (buttons, links, inputs) work automatically; for other elements (such as a `<div>` or `<span>`), add `tabindex="0"` so they can receive focus.

## Advanced Usage

### Custom HTML
You can render custom HTML inside a tooltip using `data-easy-tooltip-src`. The value can be a CSS selector or the literal keywords `next`/`prev`.

The matched element's content is copied into the tooltip.

**Using a CSS selector**
Point to any element in the document. The value is matched by id first, then as a CSS selector, so `tip-shipping` and `#tip-shipping` both work.
```html
<button data-easy-tooltip-src="#tip-shipping">Shipping info</button>
<template id="tip-shipping">
  <strong>Free shipping</strong> on orders over £50<br>
  Delivered in 2 to 4 working days
</template>
```

**Using `next` or `prev`**
Use `next` to automatically pull content from the next DOM element, or `prev` for the previous one.
The source element is automatically hidden.
```html
<button data-easy-tooltip-src="next">Ingredients</button>
<div>
  <ul>
    <li>Oats</li>
    <li>Honey</li>
    <li>Sea salt</li>
  </ul>
</div>
```

### Custom tooltip classes
For styling specific tooltips, add `data-easy-tooltip-class`. The value is applied as a class on the generated tooltip:
```html
<button data-easy-tooltip="Saved!" data-easy-tooltip-class="success-tooltip">Save</button>
<button data-easy-tooltip="This cannot be undone!" data-easy-tooltip-class="danger-tooltip bold-tooltip">Delete</button>
```

```css
.success-tooltip {
  --easy-tooltip-background-color: #f0fdf4;
  --easy-tooltip-border-color: #27ae60;
  --easy-tooltip-text-color: #27ae60;
}

.danger-tooltip {
  --easy-tooltip-background-color: #fef2f2;
  --easy-tooltip-border-color: #e74c3c;
  --easy-tooltip-text-color: #e74c3c;
}

.bold-tooltip {
  font-weight: bold;
}
```

### Per-tooltip styling
For a one-off tweak that doesn't warrant a class, `data-easy-tooltip-style` writes inline styles (typically the CSS variables below) straight onto that tooltip, just like the HTML `style` attribute:
```html
<div data-easy-tooltip="Pill shaped, just for me" data-easy-tooltip-style="--easy-tooltip-border-radius: 999px;">?</div>
```

The attribute is observed, so changing it while the tooltip is visible re-renders it live.

### Preferred side
Use `data-easy-tooltip-prefer` to control which side a tooltip shows on. It still flips to the opposite side when there isn't room. Using `left` or `right` switches the tooltip to horizontal mode.

* `above` (default): show above, fall back to below
* `below`: show below, fall back to above
* `left`: show to the left, fall back to the right
* `right`: show to the right, fall back to the left
* `entry`: show on whichever edge of the trigger the cursor crossed on the way in. The side is locked in as you enter, so it stays right even when you move fast. Keyboard focus has no entry point, so it falls back to `above`

```html
<button data-easy-tooltip="Shows below" data-easy-tooltip-prefer="below">Hover me</button>
<button data-easy-tooltip="Shows on the right" data-easy-tooltip-prefer="right">Hover me</button>
```

### Anchor modes
By default a tooltip is anchored to its trigger element. Use `data-easy-tooltip-anchor` to change the anchor point:

* `element` (default): anchored to the trigger's bounding box.
* `cursor`: anchored to the cursor (or touch point), follows the cursor as it moves around the element. On touch, the tooltip appears at the tap point and tracks the finger if you drag.
* `pin`: pins to the point on the trigger's nearest edge to the cursor when the tooltip appears, so coming in from the left pins it to the left edge at the height you are at. The side defaults to `entry`, and setting `data-easy-tooltip-prefer` overrides that while keeping the pinned position. If the tooltip is delayed, it pins where the cursor ends up rather than where it entered, and it keeps tracking the page as you scroll.

`cursor` and `pin` also come in single axis versions, which take one axis from the cursor and the other from the trigger's bounding box:

* `cursor-x` and `pin-x`: horizontally on the cursor, vertically on the trigger
* `cursor-y` and `pin-y`: vertically on the cursor, horizontally on the trigger

The axis versions of `pin` freeze the cursor position on that axis rather than snapping to an edge.

```html
<div data-easy-tooltip="I follow your cursor" data-easy-tooltip-anchor="cursor">…</div>
<div data-easy-tooltip="I stay where you first hovered" data-easy-tooltip-anchor="pin">…</div>
```

Keyboard focus has no coordinates and automatically falls back to element anchoring.

### Holding while interacting
A tooltip stays open while you are pressing its trigger, even once the pointer leaves it. This means that dragging a slider keeps its tooltip up until you let go, instead of losing it as soon as the cursor leaves the track.

This happens automatically when the press lands on a control: `input`, `select`, `textarea`, `button`, or anything with a `button`, `slider`, `checkbox`, `radio`, or `switch` role. The control can be the trigger itself, or sit inside it.

Use `data-easy-tooltip-hold` to turn it on for anything else, and `data-easy-tooltip-hold="false"` to turn it off for a control:
```html
<div data-easy-tooltip="I stay while you drag me" data-easy-tooltip-hold>…</div>
<button data-easy-tooltip="I hide as soon as you leave" data-easy-tooltip-hold="false">Press me</button>
```

The tooltip hides when you release, unless the pointer is back over the trigger by then.

### Events
Tooltips fire events on their trigger element. They bubble, so you can listen on `document`.

* `easy-tooltip-open`: the tooltip appeared
* `easy-tooltip-close`: the tooltip started hiding
* `easy-tooltip-move`: the tooltip changed where it is attached

```js
document.addEventListener("easy-tooltip-open", e => {
  console.log(e.detail.side, e.detail.point)
})
```

Every event has the same `detail`:

* `trigger`: the element the tooltip belongs to
* `tooltip`: the tooltip element
* `text`: the tooltip text
* `side`: `above`, `below`, `left`, or `right`
* `inside`: `true` when the tooltip did not fit on any side, so it floats over the trigger without an arrow. `side` still reports the side it is using
* `anchor`: the anchor mode in use, `element` unless the tooltip was opened by pointer
* `anchorRect`: the box the tooltip is anchored to. For cursor and pin anchoring this is a zero size box at the anchor point
* `point`: the point on the anchor that the tooltip points at
* `rect`: the box of the tooltip itself
* `previous`: on `move`, the same placement values from before the change

All coordinates are viewport coordinates, the same as `getBoundingClientRect`. TypeScript users get the event names and the `detail` typed automatically, and the types are exported if you need them:

```ts
import type { TooltipEvent, TooltipEventDetail, TooltipSide, TooltipAnchor } from "easy-tooltips"
```

`open` fires when the tooltip actually appears, after any delay, so a hover too brief to show a tooltip fires nothing at all.

`move` fires when the tooltip flips to another side, and when its anchor point moves, for example while scrolling or when using cursor anchoring. Flips are sent straight away. Anchor point changes are limited to one event every 100ms, so cursor anchoring does not spam.

## Customization

You can style tooltips using CSS variables (recommended) or by targeting the tooltip classes directly. Note that some CSS variables are required for proper positioning:

```css
:root {
  /* Tooltip appearance */
  --easy-tooltip-background-color: #fff;     /* Background color */
  --easy-tooltip-text-color: #000;           /* Text color */
  --easy-tooltip-border-color: #aaa;         /* Border color */
  --easy-tooltip-border-size: 1px;           /* Border thickness */
  --easy-tooltip-background: none;           /* Background image/gradient, replaces the background color */
  --easy-tooltip-border: none;               /* Border image/gradient, replaces the border color */
  --easy-tooltip-border-radius: 4px;         /* Corner radius, clamped to half the tooltip like CSS, so a large value gives a pill */
  --easy-tooltip-padding: 8px 12px;          /* Inner padding */
  --easy-tooltip-max-width: 100%;            /* Maximum tooltip width */

  /* Positioning */
  --easy-tooltip-distance: 16px;             /* Distance from trigger element */
  --easy-tooltip-viewport-padding: 16px;     /* Minimum distance from screen edges */
  --easy-tooltip-arrow-size: 16px;           /* Arrow size (height defaults to width / 2; 0 to disable) */
  --easy-tooltip-arrow-size: 16px 8px;       /* Or specify arrow width and height separately */
  --easy-tooltip-arrow-edge-buffer-x: 12px;  /* Minimum arrow gap from where the border radius starts (for above or below tooltips) */
  --easy-tooltip-arrow-edge-buffer-y: 6px;   /* Minimum arrow gap from where the border radius starts (for left or right tooltips) */
  --easy-tooltip-arrow-radius: 0;            /* Border radius of the arrow tip */

  /* Animation */
  --easy-tooltip-animation-length: 0.15s;    /* Duration of fade animation */
  --easy-tooltip-animation-distance: 4px;    /* Distance the tooltip slides in */
  --easy-tooltip-delay: 0s;                  /* Base delay before the tooltip shows; always added */
  --easy-tooltip-inactive-delay: 0.15s;      /* Extra delay when no tooltip was recently active; drops to 0 once a tooltip is showing */
  --easy-tooltip-cooldown: 0.15s;            /* How long after the last tooltip closes before the inactive-delay applies again */
}
```

### Image backgrounds and borders

`--easy-tooltip-background` and `--easy-tooltip-border` accept any CSS `<image>`: gradients or `url()` images. Both follow the tooltip shape, arrow included, and replace the flat background/border colors when set.

```css
.fancy-tooltip {
  --easy-tooltip-background: linear-gradient(135deg, #667eea, #764ba2);
  --easy-tooltip-border: linear-gradient(135deg, #f0f, #0ff);
  --easy-tooltip-border-size: 2px;
  --easy-tooltip-text-color: #fff;
}
```

They can also be set per element with data attributes, which take priority over the variables:

```html
<button data-easy-tooltip="Photo background" data-easy-tooltip-background="url('photo.jpg')">Hover me</button>
<button data-easy-tooltip="Gradient border" data-easy-tooltip-border="linear-gradient(135deg, #f0f, #0ff)">Hover me</button>
```

### Show delay and quick-switch
Easy-tooltips uses a two-part delay so that the first tooltip waits, but switching between adjacent tooltips feels instant:

* On the first hover, the tooltip waits `delay + inactive-delay` (`0 + 0.15s` by default) before showing. This protects against accidental hovers.
* Once a tooltip has fully appeared, all subsequent tooltips skip the inactive-delay and show in just `delay` (`0s` by default, i.e. instantly).
* When all tooltips have been closed for `cooldown` (`0.15s` by default), behaviour resets to "first hover" again.

Each part is its own variable so you can tune them independently. For example, a slow, deliberate tooltip with a long initial wait but instant skip:

```css
.slow-tooltip {
  --easy-tooltip-inactive-delay: 1s;
}
```

Or a permanent delay regardless of recent activity (e.g. a 500ms reveal on every tooltip):

```css
.always-slow-tooltip {
  --easy-tooltip-delay: 500ms;
}
```

### Advanced customization

The tooltip body and arrow are drawn as a single SVG path, so anything beyond the variables can be done by targeting the path directly with SVG-flavored CSS. `.easy-tooltip-bg` is the SVG element; `.easy-tooltip-bg path` is the path that draws the outline and fill.

#### Borders

The border is the SVG path's `stroke`, so any stroke property works:

```css
/* Dashed border */
.dashed-tooltip .easy-tooltip-bg path {
  stroke-dasharray: 5 3;
  stroke-linecap: round;
}
```

#### Backgrounds

For gradient or image backgrounds, use `--easy-tooltip-background` (see [Image backgrounds and borders](#image-backgrounds-and-borders)). Alternatively, the path's `fill` accepts any SVG paint server declared in the document, referenced by id:

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3498db"/>
      <stop offset="100%" stop-color="#9b59b6"/>
    </linearGradient>
  </defs>
</svg>
```

```css
.gradient-tooltip .easy-tooltip-bg path {
  fill: url(#brand-gradient);
}
```

The same approach works for `stroke` (an alternative to `--easy-tooltip-border`), and for radial, conic, or pattern paint servers.

For a drop shadow that follows the full body + arrow shape, apply a filter to the SVG element:

```css
.shadow-tooltip .easy-tooltip-bg {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
}
```

## How it works

Easy-tooltips uses a smart positioning system that:

1. **Picks a side** - Shows on the preferred side (above by default, or below/left/right) and flips to the opposite side when there isn't room
2. **Keeps it on screen** - Shifts the tooltip along its edge (horizontally for above/below, vertically for left/right) so it stays within the viewport while the arrow keeps pointing at the element
3. **Falls back gracefully** - When a tooltip can't fit on either side, it pins inside the viewport instead of overflowing
4. **Manages animations** - Queues tooltip updates to prevent conflicts and flicker on rapid hover
5. **Skips the delay when grazing** - The first hover waits a short delay to ignore accidental movement, but once any tooltip is showing, switching to adjacent tooltips is instant until you stop hovering for the cooldown period
6. **Stacks newest on top** - When multiple tooltips are visible at once, the most recently activated one renders above the others
7. **Always paints above everything** - The tooltip container lives in the browser's top layer (via the Popover API), so tooltips render above any z-index, no matter how large, and re-promote themselves above modal dialogs and fullscreen elements when activated. Falls back to a high z-index in browsers without popover support
8. **Cleans up** - Removes a tooltip automatically when its trigger element leaves the DOM

## License

MIT © [Ewan Howell](https://ewanhowell.com/)