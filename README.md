# easy-tooltips

A lightweight, zero-dependency tooltip library using modern JavaScript and CSS.  
Just add `data-tooltip` to any element — no setup, no config, no JavaScript calls.

[![npm version](https://badge.fury.io/js/easy-tooltips.svg)](https://www.npmjs.com/package/easy-tooltips)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

* No dependencies
* Works with both mouse and touch
* Customizable via CSS variables
* Automatically repositions and shifts to fit the screen

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
<button data-tooltip="Click to save your changes">Save</button>
<span data-tooltip="This field is required">Username *</span>
<div data-tooltip="Multi-line tooltips<br>are supported too">Info</div>
```

## Advanced Usage

### Custom tooltip IDs
For styling specific tooltips:
```html
<button data-tooltip="Special tooltip" data-tooltip-id="save-button">Save</button>
```

```css
#save-button {
  --tooltip-background: #28a745;
  --tooltip-border-color: #1e7e34;
}
```

## Customization

You can style tooltips using CSS variables (recommended) or by targeting the tooltip classes directly. Note that some CSS variables are required for proper positioning:

```css
:root {
  /* Tooltip appearance */
  --tooltip-background: #fff;         /* Background color */
  --tooltip-border-color: #aaa;       /* Border color */
  --tooltip-border-size: 1px;         /* Border thickness */
  --tooltip-max-width: 300px;         /* Maximum width (not set by default) */
  
  /* Positioning (required for JS positioning) */
  --tooltip-vertical-distance: 16px;  /* Distance from trigger element */
  --tooltip-viewport-padding: 16px;   /* Minimum distance from screen edges */
  --tooltip-arrow-size: 12px;         /* Size of the arrow */
  --tooltip-arrow-edge-buffer: 12px;  /* How close the arrow can get to the edge of a tooltip */
  --tooltip-arrow-radius: 0;          /* Border radius of the arrow */
  
  /* Animation (required for JS timing) */
  --tooltip-animation-length: 0.15s;  /* Duration of fade animation */
}
```

## How it works

Easy-tooltips uses a smart positioning system that:

1. **Detects viewport boundaries** - Automatically positions tooltips above or below elements
2. **Handles edge cases** - Shifts tooltips horizontally when they would overflow the screen
3. **Manages animations** - Queues tooltip updates to prevent conflicts

## License

MIT © [Ewan Howell](https://github.com/ewanhowell5195)