# easy-tooltips

A lightweight, zero-dependency tooltip library using modern JavaScript and CSS.  
Just add `data-easy-tooltip` to any element! No setup or config required.

[![npm version](https://badge.fury.io/js/easy-tooltips.svg)](https://www.npmjs.com/package/easy-tooltips)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/easy-tooltips/badge)](https://www.jsdelivr.com/package/npm/easy-tooltips)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**Live Demo**](https://easy-tooltips.ewanhowell.com/)

## Features

* No dependencies
* Works with both mouse and touch
* Customizable via CSS variables
* Automatically repositions and shifts to fit the screen
* Smooth, non-interrupting animations (no flicker on rapid hover)
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
<div data-easy-tooltip="Multi-line tooltips<br>are supported too">Info</div>
```

No additional setup is needed for Vue, React, Svelte, or other frameworks! Tooltips automatically update when the element updates!

## Advanced Usage

### Custom HTML
You can render custom HTML inside a tooltip using `data-easy-tooltip-src`. The value can be a CSS selector or the literal keyword `next`.

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

**Using `next`**
Use `next` to automatically pull content from the next DOM element.
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

## Customization

You can style tooltips using CSS variables (recommended) or by targeting the tooltip classes directly. Note that some CSS variables are required for proper positioning:

```css
:root {
  /* Tooltip appearance */
  --easy-tooltip-background-color: #fff;   /* Background color */
  --easy-tooltip-text-color: #000;         /* Text color */
  --easy-tooltip-border-color: #aaa;       /* Border color */
  --easy-tooltip-border-size: 1px;         /* Border thickness */
  --easy-tooltip-max-width: 100%;          /* Maximum tooltip width */
  
  /* Positioning (required for JS positioning) */
  --easy-tooltip-vertical-distance: 16px;  /* Distance from trigger element */
  --easy-tooltip-viewport-padding: 16px;   /* Minimum distance from screen edges */
  --easy-tooltip-arrow-size: 12px;         /* Size of the arrow */
  --easy-tooltip-arrow-edge-buffer: 12px;  /* How close the arrow can get to the edge of a tooltip */
  --easy-tooltip-arrow-radius: 0;          /* Border radius of the arrow */
  
  /* Animation (required for JS timing) */
  --easy-tooltip-animation-length: 0.15s;  /* Duration of fade animation */
  --easy-tooltip-delay: 0.15s;             /* How long before the animation starts */
}
```

## How it works

Easy-tooltips uses a smart positioning system that:

1. **Detects viewport boundaries** - Automatically positions tooltips above or below elements
2. **Handles edge cases** - Shifts tooltips horizontally when they would overflow the screen
3. **Manages animations** - Queues tooltip updates to prevent conflicts

## License

MIT © [Ewan Howell](https://ewanhowell.com/)