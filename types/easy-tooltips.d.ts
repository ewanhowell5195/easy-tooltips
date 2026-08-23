export type TooltipSide = "above" | "below" | "left" | "right"

export type TooltipAnchor =
  | "element"
  | "cursor"
  | "cursor-x"
  | "cursor-y"
  | "pin"
  | "pin-x"
  | "pin-y"

export interface TooltipRect {
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface TooltipPoint {
  x: number
  y: number
}

export interface TooltipPlacement {
  /** The side of the anchor the tooltip is on */
  side: TooltipSide
  /** True when the tooltip did not fit on any side, so it floats over the trigger without an arrow */
  inside: boolean
  /** The anchor mode in use, `element` unless the tooltip was opened by pointer */
  anchor: TooltipAnchor
  /** The box the tooltip is anchored to. A zero size box at the anchor point for cursor and pin anchoring */
  anchorRect: TooltipRect
  /** The point on the anchor that the tooltip points at */
  point: TooltipPoint
}

export interface TooltipEventDetail extends TooltipPlacement {
  /** The element the tooltip belongs to */
  trigger: HTMLElement
  /** The tooltip element */
  tooltip: HTMLElement
  /** The tooltip text */
  text: string
  /** The box of the tooltip itself */
  rect: TooltipRect
  /** The placement from before the change, on `easy-tooltip-move` only */
  previous?: TooltipPlacement
}

export type TooltipEvent = CustomEvent<TooltipEventDetail>

export interface TooltipEventMap {
  "easy-tooltip-open": TooltipEvent
  "easy-tooltip-close": TooltipEvent
  "easy-tooltip-move": TooltipEvent
}

declare global {
  interface HTMLElementEventMap extends TooltipEventMap {}
  interface DocumentEventMap extends TooltipEventMap {}
  interface WindowEventMap extends TooltipEventMap {}
}
