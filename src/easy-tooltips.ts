import "./easy-tooltips.css"

type TooltipSide = "above" | "below" | "left" | "right"
type TooltipAnchor = "element" | "cursor" | "cursor-x" | "cursor-y" | "pin" | "pin-x" | "pin-y"

type TooltipRect = {
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

type TooltipPlacement = {
  side: TooltipSide
  inside: boolean
  anchor: TooltipAnchor
  anchorRect: TooltipRect
  point: { x: number, y: number }
}

type TooltipElement = HTMLElement & {
  _tooltip?: TooltipElement
  _tooltipText?: HTMLElement
  _activated?: boolean
  _source?: Node
  _timeout?: number
  _activateTimer?: number
  _tooltipClass?: string
  _start?: number
  _delay?: number
  _animation_duration?: number
  _next?: boolean
  _anchorPoint?: { x: number, y: number }
  _anchorSide?: TooltipSide
  _svgPath?: SVGPathElement
  _clipPath?: SVGPathElement
  _foreignObj?: SVGForeignObjectElement
  _surfaceDiv?: HTMLDivElement
  _borderMask?: SVGMaskElement
  _borderMaskPath?: SVGPathElement
  _borderForeignObj?: SVGForeignObjectElement
  _borderSurfaceDiv?: HTMLDivElement
  _observer?: MutationObserver
  _sourceObserver?: MutationObserver
  _trigger?: TooltipElement
  _placement?: TooltipPlacement
  _reported?: TooltipPlacement
  _dispatched?: boolean
  _dispatchQueued?: boolean
  _moveAt?: number
  _moveTimer?: number
  _held?: boolean
}

{
  function initTooltips() {
    const tooltips = document.createElement("div")
    tooltips.id = "easy-tooltips"
    document.body.append(tooltips)

    const supportsPopover = !!tooltips.showPopover
    function showTooltipLayer() {
      if (!supportsPopover || tooltips.matches(":popover-open")) return
      try { tooltips.showPopover() } catch {}
    }
    function promoteTooltipLayer() {
      if (!supportsPopover) return
      try {
        if (tooltips.matches(":popover-open")) tooltips.hidePopover()
      } catch {}
      showTooltipLayer()
    }
    if (supportsPopover) {
      tooltips.popover = "manual"
      showTooltipLayer()
      tooltips.addEventListener("toggle", e => {
        if ((e as ToggleEvent).newState === "closed") requestAnimationFrame(showTooltipLayer)
      })
    }

    let
      lastElement: TooltipElement | undefined,
      lastByPointer: boolean,
      mouseActive: boolean,
      cursorX: number,
      cursorY: number,
      cursorAnchorActive: boolean,
      cursorRafQueued: boolean,
      cooldownTimer: number,
      ignoreFocusReturn: boolean,
      activeCount = 0,
      visibleCount = 0,
      zIndexCounter = 0

    const moveThrottle = 100
    const holdControls = "input, select, textarea, button, [role=button], [role=slider], [role=checkbox], [role=radio], [role=switch]"
    let heldTrigger: TooltipElement | undefined

    function activateTooltip(tooltip: TooltipElement) {
      promoteTooltipLayer()
      tooltip._activated = true
      queueVisibilityEvent(tooltip)
      const trigger = tooltip._trigger
      if (trigger && anchorBaseOf(trigger.dataset.easyTooltipAnchor) === "pin" && lastByPointer && cursorX !== undefined) {
        capturePin(trigger)
        reloadTooltips()
      }
      activeCount++
      clearTimeout(cooldownTimer)
      tooltips.classList.add("easy-tooltips-active")
      tooltip.style.zIndex = String(++zIndexCounter)
      startHoverPoll()
    }

    function deactivateTooltip(tooltip: TooltipElement) {
      if (!tooltip._activated) return
      tooltip._activated = false
      queueVisibilityEvent(tooltip)
      if (--activeCount <= 0) {
        activeCount = 0
        clearTimeout(cooldownTimer)
        cooldownTimer = setTimeout(
          () => tooltips.classList.remove("easy-tooltips-active"),
          ms(getComputedStyle(document.documentElement).getPropertyValue("--easy-tooltip-cooldown"))
        )
      }
    }

    const triggers = new Set<TooltipElement>()

    function releaseTooltip(node: TooltipElement) {
      const t = node._tooltip
      if (t) {
        clearTimeout(t._moveTimer)
        if (node === heldTrigger) heldTrigger = undefined
        if (t._dispatched) {
          t._dispatched = false
          tooltipEvent(t, "close")
        }
        if (t.classList.contains("easy-tooltip-visible")) visibleCount--
        clearTimeout(t._timeout)
        clearTimeout(t._activateTimer)
        deactivateTooltip(t)
        t.remove()
      }

      node._observer?.disconnect()
      node._sourceObserver?.disconnect()
      node._observer = node._sourceObserver = undefined

      triggers.delete(node)
      node._tooltip = node._tooltipText = node._svgPath = node._clipPath = node._foreignObj = node._surfaceDiv = node._borderMask = node._borderMaskPath = node._borderForeignObj = node._borderSurfaceDiv = node._tooltipClass = node._source = node._anchorPoint = node._anchorSide = undefined
      if (node === lastElement) lastElement = undefined
    }

    let releaseScheduled: boolean
    new MutationObserver(records => {
      if (releaseScheduled || !records.some(r => r.removedNodes.length)) return
      releaseScheduled = true
      queueMicrotask(() => {
        releaseScheduled = false
        for (const node of triggers) {
          if (!node.isConnected) releaseTooltip(node)
        }
      })
    }).observe(document.body, { childList: true, subtree: true })

    let hoverPollRaf: number
    function pollHover() {
      hoverPollRaf = 0
      if (mouseActive && cursorX !== undefined) {
        const cursorEl = document.elementFromPoint(cursorX, cursorY)
        for (const trigger of triggers) {
          const tip = trigger._tooltip
          if (tip && !tip._held && tip.classList.contains("easy-tooltip-visible") && trigger !== cursorEl && !trigger.contains(cursorEl)) {
            tooltipVisibility(tip, false)
          }
        }
      }
      if (visibleCount > 0) hoverPollRaf = requestAnimationFrame(pollHover)
    }
    function startHoverPoll() {
      if (!hoverPollRaf) hoverPollRaf = requestAnimationFrame(pollHover)
    }

    function anchorAxisOf(mode: string | undefined) {
      return mode?.endsWith("-x") ? "x" : mode?.endsWith("-y") ? "y" : "both"
    }

    function anchorBaseOf(mode: string | undefined) {
      return mode?.replace(/-[xy]$/, "")
    }

    function capturePin(node: TooltipElement) {
      if (anchorAxisOf(node.dataset.easyTooltipAnchor) !== "both") {
        node._anchorSide = undefined
        node._anchorPoint = { x: cursorX + window.scrollX, y: cursorY + window.scrollY }
        return
      }

      const box = node.getBoundingClientRect()
      const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
      const gaps = {
        left: cursorX - box.left,
        right: box.right - cursorX,
        above: cursorY - box.top,
        below: box.bottom - cursorY,
      }
      const side = (Object.keys(gaps) as TooltipSide[]).reduce((a, b) => gaps[b] < gaps[a] ? b : a)
      const x = side === "left" ? box.left : side === "right" ? box.right : clamp(cursorX, box.left, box.right)
      const y = side === "above" ? box.top : side === "below" ? box.bottom : clamp(cursorY, box.top, box.bottom)

      node._anchorSide = side
      node._anchorPoint = { x: x + window.scrollX, y: y + window.scrollY }
    }

    function rectValue(rect: { left: number, top: number, right: number, bottom: number, width: number, height: number }): TooltipRect {
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      }
    }

    function tooltipEvent(tooltip: TooltipElement, type: "open" | "close" | "move", previous?: TooltipPlacement) {
      const trigger = tooltip._trigger
      if (!trigger) return
      const placement = tooltip._placement
      if (placement) tooltip._reported = placement
      trigger.dispatchEvent(new CustomEvent(`easy-tooltip-${type}`, {
        bubbles: true,
        composed: true,
        detail: {
          trigger,
          tooltip,
          text: trigger._tooltipText?.textContent ?? "",
          side: placement?.side,
          inside: placement?.inside ?? false,
          anchor: placement?.anchor ?? "element",
          anchorRect: placement?.anchorRect,
          point: placement?.point,
          rect: rectValue(tooltip.getBoundingClientRect()),
          previous
        }
      }))
    }

    function anchorPoint(rect: TooltipRect, side: TooltipSide) {
      if (side === "left" || side === "right") {
        return { x: Math.round(side === "left" ? rect.left : rect.right), y: Math.round(rect.top + rect.height / 2) }
      }
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(side === "below" ? rect.bottom : rect.top) }
    }

    function tooltipMove(tooltip: TooltipElement) {
      const previous = tooltip._reported
      const placement = tooltip._placement
      if (!previous || !placement) return
      const flipped = previous.side !== placement.side || previous.inside !== placement.inside || previous.anchor !== placement.anchor
      if (!flipped && previous.point.x === placement.point.x && previous.point.y === placement.point.y) return

      const now = performance.now()
      const wait = flipped ? 0 : moveThrottle - (now - (tooltip._moveAt ?? 0))

      if (wait <= 0) {
        clearTimeout(tooltip._moveTimer)
        tooltip._moveTimer = undefined
        tooltip._moveAt = now
        tooltipEvent(tooltip, "move", previous)
        return
      }

      if (tooltip._moveTimer) return
      tooltip._moveTimer = setTimeout(() => {
        tooltip._moveTimer = undefined
        if (!tooltip._dispatched || !tooltip._reported || !tooltip._placement) return
        tooltip._moveAt = performance.now()
        tooltipEvent(tooltip, "move", tooltip._reported)
      }, wait)
    }

    function queueVisibilityEvent(tooltip: TooltipElement) {
      if (tooltip._dispatchQueued) return
      tooltip._dispatchQueued = true
      queueMicrotask(() => {
        tooltip._dispatchQueued = false
        const visible = !!tooltip._activated
        if (visible === !!tooltip._dispatched) return
        tooltip._dispatched = visible
        clearTimeout(tooltip._moveTimer)
        tooltip._moveTimer = undefined
        tooltip._moveAt = visible ? performance.now() : undefined
        tooltipEvent(tooltip, visible ? "open" : "close")
      })
    }

    function ms(value: string) {
      value = value.trim()
      const n = parseFloat(value)
      return value.endsWith("ms") ? n : n * 1000
    }

    function tooltipVisibility(tooltip: TooltipElement, visible: boolean) {
      const styles = getComputedStyle(tooltip)
      const length = ms(styles.getPropertyValue("--easy-tooltip-animation-length"))
      if (visible) {
        const delay = ms(styles.getPropertyValue("--easy-tooltip-delay")) + ms(styles.getPropertyValue("--easy-tooltip-inactive-delay"))
        if (delay) {
          tooltip._start = performance.now()
          tooltip._delay = delay
        }
        tooltip._animation_duration = length + delay
      } else {
        if (tooltip._delay && performance.now() < Number(tooltip._start) + tooltip._delay) {
          if (tooltip.classList.contains("easy-tooltip-visible")) visibleCount--
          tooltip.classList.remove("easy-tooltip-visible")
          clearTimeout(tooltip._timeout)
          clearTimeout(tooltip._activateTimer)
          tooltip._timeout = tooltip._activateTimer = tooltip._start = tooltip._delay = undefined
          return
        }
        tooltip._animation_duration = length
      }

      if (tooltip.classList.contains("easy-tooltip-visible") === visible) {
        tooltip._next = undefined
        return
      }

      if (tooltip._timeout === undefined) {
        tooltip._next = undefined
        tooltip.classList.toggle("easy-tooltip-visible", visible)
        visibleCount += visible ? 1 : -1

        clearTimeout(tooltip._activateTimer)
        tooltip._activateTimer = undefined
        if (visible) {
          if (tooltip._delay) {
            tooltip._activateTimer = setTimeout(() => {
              tooltip._activateTimer = undefined
              activateTooltip(tooltip)
            }, tooltip._delay)
          } else {
            activateTooltip(tooltip)
          }
        } else {
          deactivateTooltip(tooltip)
        }

        tooltip._timeout = setTimeout(() => {
          tooltip._timeout = undefined
          if (tooltip._next !== undefined) {
            tooltipVisibility(tooltip, tooltip._next)
          }
        }, tooltip._animation_duration)
      } else {
        tooltip._next = visible
      }
    }

    function addTooltips() {
      cursorAnchorActive = false
      if (lastElement) {
        const containerRect = tooltips.getBoundingClientRect()
        tooltips.style.setProperty("--easy-tooltip-view-width", (visualViewport?.width ?? document.documentElement.clientWidth) + "px")
        const toAdd = []
        let node: TooltipElement | null = lastElement
        while (node && node !== document.body) {
          if (node.dataset.easyTooltip) {
            toAdd.push(node)
          } else if (node.dataset.easyTooltipSrc) {
            const src = node.dataset.easyTooltipSrc
            const oldSource = node._source
            if (src === "next") {
              node._source = node.nextElementSibling ?? undefined
            } else if (src === "prev") {
              node._source = node.previousElementSibling ?? undefined
            } else {
              try { node._source = (document.getElementById(src) || document.querySelector(src)) ?? undefined } catch {}
            }
            if (oldSource !== node._source && node._sourceObserver) {
              node._sourceObserver.disconnect()
              node._sourceObserver = undefined
            }
            if (node._source) toAdd.push(node)
            else if (node._tooltip && !node._tooltip._held) tooltipVisibility(node._tooltip, false)
          } else if (node._tooltip && !node._tooltip._held) {
            tooltipVisibility(node._tooltip, false)
          }
          node = node.parentElement as TooltipElement | null
        }
        for (let i = toAdd.length; i--;) {
          const node = toAdd[i]
          let tooltip = node._tooltip
          let tooltipText = node._tooltipText
          if (!tooltip || !tooltipText) {
            tooltip = document.createElement("div") as TooltipElement
            tooltip.className = "easy-tooltip easy-tooltip-setup"
            tooltip._trigger = node
            node._tooltip = tooltip

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.classList.add("easy-tooltip-bg")
            svg.setAttribute("aria-hidden", "true")

            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
            const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath")
            const clipId = "easy-tooltip-clip-" + Math.random().toString(36).substring(2, 9)
            clipPath.id = clipId

            const clipSvgPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
            clipPath.append(clipSvgPath)
            defs.append(clipPath)
            node._clipPath = clipSvgPath

            const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")
            foreignObj.setAttribute("clip-path", `url(#${clipId})`)

            const surfaceDiv = document.createElement("div")
            surfaceDiv.className = "easy-tooltip-surface"
            foreignObj.append(surfaceDiv)

            node._foreignObj = foreignObj
            node._surfaceDiv = surfaceDiv

            const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask")
            const maskId = "easy-tooltip-mask-" + Math.random().toString(36).substring(2, 9)
            mask.id = maskId
            mask.setAttribute("maskUnits", "userSpaceOnUse")

            const maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
            mask.append(maskPath)
            defs.append(mask)
            node._borderMask = mask
            node._borderMaskPath = maskPath

            const borderForeignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")
            borderForeignObj.setAttribute("mask", `url(#${maskId})`)

            const borderSurfaceDiv = document.createElement("div")
            borderSurfaceDiv.className = "easy-tooltip-surface"
            borderForeignObj.append(borderSurfaceDiv)

            node._borderForeignObj = borderForeignObj
            node._borderSurfaceDiv = borderSurfaceDiv

            const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
            node._svgPath = svgPath

            svg.append(defs, foreignObj, svgPath, borderForeignObj)

            tooltipText = document.createElement("div")
            tooltipText.className = "easy-tooltip-text"
            node._tooltipText = tooltipText

            tooltip.append(svg, tooltipText)
            tooltips.append(tooltip)
          }

          const zIndex = tooltip.style.zIndex
          tooltip.style.cssText = node.dataset.easyTooltipStyle ?? ""
          if (zIndex) tooltip.style.zIndex = zIndex

          const customClass = node.dataset.easyTooltipClass
          if (node._tooltipClass !== customClass) {
            if (node._tooltipClass) {
              tooltip.classList.remove(...node._tooltipClass.trim().split(/\s+/))
            }
            if (customClass) {
              tooltip.classList.add(...customClass.trim().split(/\s+/))
            }
            node._tooltipClass = customClass
          }

          if (node._source) {
            tooltipText.replaceChildren(...node._source.cloneNode(true).childNodes)
            tooltipText.classList.add("easy-tooltip-text-html")
          } else {
            tooltipText.textContent = node.dataset.easyTooltip ?? null
            tooltipText.classList.remove("easy-tooltip-text-html")
          }

          const anchorMode = node.dataset.easyTooltipAnchor
          const anchorAxis = anchorAxisOf(anchorMode)
          const anchorBase = anchorBaseOf(anchorMode)
          const useCursor = anchorBase === "cursor" && lastByPointer
          const usePin = anchorBase === "pin" && lastByPointer
          if (useCursor) cursorAnchorActive = true
          if (usePin && !tooltip._activated) capturePin(node)
          let rect
          if (useCursor || (usePin && node._anchorPoint)) {
            const x = useCursor ? cursorX : node._anchorPoint!.x - window.scrollX
            const y = useCursor ? cursorY : node._anchorPoint!.y - window.scrollY
            const box = anchorAxis === "both" ? null : node.getBoundingClientRect()
            rect = {
              left: anchorAxis === "y" ? box!.left : x,
              right: anchorAxis === "y" ? box!.right : x,
              width: anchorAxis === "y" ? box!.width : 0,
              top: anchorAxis === "x" ? box!.top : y,
              bottom: anchorAxis === "x" ? box!.bottom : y,
              height: anchorAxis === "x" ? box!.height : 0,
            }
          } else {
            rect = node.getBoundingClientRect()
          }

          const styles = getComputedStyle(tooltip)
          const distance = parseFloat(styles.getPropertyValue("--easy-tooltip-distance"))
          const padding = parseFloat(styles.getPropertyValue("--easy-tooltip-viewport-padding"))
          const arrowSizeParts = styles.getPropertyValue("--easy-tooltip-arrow-size").trim().split(/\s+/)
          const arrowBase = parseFloat(arrowSizeParts[0])
          const edgeBufferX = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-edge-buffer-x"))
          const edgeBufferY = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-edge-buffer-y"))
          const br = parseFloat(styles.getPropertyValue("--easy-tooltip-border-radius")) || 0

          tooltip.style.minWidth = `${edgeBufferX * 2 + arrowBase}px`
          tooltipText.style.minHeight = ""
          const radius = Math.min(br, tooltipText.getBoundingClientRect().height / 2)
          tooltip.style.minWidth = `${edgeBufferX * 2 + arrowBase + radius * 2}px`

          const viewLeft = containerRect.left + (visualViewport?.offsetLeft ?? 0)
          const viewTop = containerRect.top + (visualViewport?.offsetTop ?? 0)
          const viewportWidth = visualViewport?.width ?? document.documentElement.clientWidth
          const viewportHeight = visualViewport?.height ?? document.documentElement.clientHeight
          const prefer = node.dataset.easyTooltipPrefer || (usePin ? node._anchorSide : undefined)
          const rightPlacementOffset = Math.round(rect.right - viewLeft + distance - padding)
          const leftPlacementOffset = Math.round(viewLeft + viewportWidth - rect.left + distance - padding)

          tooltip.style.translate = ""
          tooltip.style.removeProperty("--easy-tooltip-left-offset")
          tooltip.style.removeProperty("--easy-tooltip-right-offset")
          tooltipText.style.translate = ""
          tooltip.classList.remove("easy-tooltip-below", "easy-tooltip-inside", "easy-tooltip-left", "easy-tooltip-right")

          let tooltipWidth: number = 0, tooltipHeight: number = 0
          let dir: "above" | "below" | "right" | "left" | undefined, inside

          if (prefer === "left" || prefer === "right") {
            tooltip.style.minWidth = `${radius * 2}px`
            tooltipText.style.width = "min-content"
            tooltipText.style.minWidth = "0"
            const minWidth = tooltip.getBoundingClientRect().width
            tooltipText.style.width = ""
            tooltipText.style.minWidth = ""

            for (const side of [prefer, prefer === "left" ? "right" : "left"] as ("right" | "left")[]) {
              if ((side === "left" ? rect.left - viewLeft - distance - padding : viewLeft + viewportWidth - rect.right - distance - padding) < minWidth) continue
              tooltip.classList.remove("easy-tooltip-left", "easy-tooltip-right")
              tooltip.classList.add("easy-tooltip-" + side)
              if (side === "right") {
                tooltip.style.setProperty("--easy-tooltip-left-offset", `${rightPlacementOffset}px`)
                tooltip.style.removeProperty("--easy-tooltip-right-offset")
              } else {
                tooltip.style.setProperty("--easy-tooltip-right-offset", `${leftPlacementOffset}px`)
                tooltip.style.removeProperty("--easy-tooltip-left-offset")
              }
              if (tooltip.getBoundingClientRect().height <= viewportHeight - padding * 2) {
                dir = side
                break
              }
            }
            if (!dir) {
              dir = prefer
              inside = true
            }
          } else {
            ;({ width: tooltipWidth, height: tooltipHeight } = tooltip.getBoundingClientRect())
            const y = Math.round(rect.top)
            const fitsAbove = y - tooltipHeight - distance > viewTop + padding
            const fitsBelow = y + rect.height + tooltipHeight + distance < viewTop + viewportHeight - padding

            if (prefer === "below") {
              dir = fitsBelow ? "below" : fitsAbove ? "above" : "below"
            } else {
              dir = fitsAbove ? "above" : fitsBelow ? "below" : "above"
            }
            inside = !fitsAbove && !fitsBelow
          }

          tooltip.classList.remove("easy-tooltip-below", "easy-tooltip-inside", "easy-tooltip-left", "easy-tooltip-right")
          tooltip.style.removeProperty("--easy-tooltip-left-offset")
          tooltip.style.removeProperty("--easy-tooltip-right-offset")
          tooltip.style.top = ""
          tooltip.style.left = ""

          if (dir !== "above") tooltip.classList.add("easy-tooltip-" + dir)
          if (inside) tooltip.classList.add("easy-tooltip-inside")

          tooltip.classList.remove("easy-tooltip-setup")
          let show = true
          if (mouseActive && cursorX !== undefined) {
            const cursorEl = document.elementFromPoint(cursorX, cursorY)
            show = !!cursorEl && (node === cursorEl || node.contains(cursorEl))
          }
          tooltipVisibility(tooltip, show || !!tooltip._held)

          if (dir === "left" || dir === "right") {
            tooltipText.style.minHeight = `${edgeBufferY * 2 + arrowBase + radius * 2}px`
          } else {
            tooltipText.style.minHeight = `${radius * 2}px`
          }

          function shift(
            before: number,
            after: number,
            size: number,
            viewStart: number,
            viewportSize: number,
            edgeBuffer: number,
            vertical: boolean
          ) {
            const maxTextShift = size / 2 - arrowBase / 2 - edgeBuffer - br
            const min = viewStart + padding
            const max = viewStart + viewportSize - padding
            let text = 0, tip = 0
            if (before < min) {
              text = Math.min(min - before, maxTextShift)
              if (before + text < min) tip = min - (before + text)
            } else if (after > max) {
              text = -Math.min(after - max, maxTextShift)
              if (after + text > max) tip = -(after + text - max)
            }
            if (text && tooltipText !== undefined) tooltipText.style.translate = vertical ? `0 ${text}px` : `${text}px`
            if (tip && tooltip !== undefined) tooltip.style.translate = vertical ? `0 ${tip}px` : `${tip}px 0`
            return text
          }

          function arrowPath(
            dir: "above" | "below" | "right" | "left",
            w: number,
            h: number,
            r: number,
            ab: number,
            ah: number,
            ax: number,
            ay: number,
            ar: number
          ) {
            const ahb = ab / 2
            const s = ar * Math.SQRT1_2
            if (dir === "above") {
              const tip = ar > 0 ? `L${ax+s} ${h+ah-s}A${ar} ${ar} 0 0 1 ${ax-s} ${h+ah-s}` : `L${ax} ${h+ah}`
              return `M${r} 0H${w-r}A${r} ${r} 0 0 1 ${w} ${r}V${h-r}A${r} ${r} 0 0 1 ${w-r} ${h}H${ax+ahb}${tip}L${ax-ahb} ${h}H${r}A${r} ${r} 0 0 1 0 ${h-r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
            }
            if (dir === "below") {
              const tip = ar > 0 ? `L${ax-s} ${-ah+s}A${ar} ${ar} 0 0 1 ${ax+s} ${-ah+s}` : `L${ax} ${-ah}`
              return `M${r} 0H${ax-ahb}${tip}L${ax+ahb} 0H${w-r}A${r} ${r} 0 0 1 ${w} ${r}V${h-r}A${r} ${r} 0 0 1 ${w-r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h-r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
            }
            if (dir === "right") {
              const tip = ar > 0 ? `L${-ah+s} ${ay+s}A${ar} ${ar} 0 0 1 ${-ah+s} ${ay-s}` : `L${-ah} ${ay}`
              return `M${r} 0H${w-r}A${r} ${r} 0 0 1 ${w} ${r}V${h-r}A${r} ${r} 0 0 1 ${w-r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h-r}V${ay+ahb}${tip}L0 ${ay-ahb}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
            }
            const tip = ar > 0 ? `L${w+ah-s} ${ay-s}A${ar} ${ar} 0 0 1 ${w+ah-s} ${ay+s}` : `L${w+ah} ${ay}`
            return `M${r} 0H${w-r}A${r} ${r} 0 0 1 ${w} ${r}V${ay-ahb}${tip}L${w} ${ay+ahb}V${h-r}A${r} ${r} 0 0 1 ${w-r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h-r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
          }

          let textShift

          if (dir === "left" || dir === "right") {
            const cy = Math.round(rect.top + rect.height / 2)
            tooltip.style.top = `${cy - containerRect.top}px`
            if (!inside) {
              tooltip.style.left = `${Math.round(dir === "right" ? rect.right : rect.left) - containerRect.left}px`
              if (dir === "right") {
                tooltip.style.setProperty("--easy-tooltip-left-offset", `${rightPlacementOffset}px`)
                tooltip.style.removeProperty("--easy-tooltip-right-offset")
              } else {
                tooltip.style.setProperty("--easy-tooltip-right-offset", `${leftPlacementOffset}px`)
                tooltip.style.removeProperty("--easy-tooltip-left-offset")
              }
            }

            const height = tooltip.getBoundingClientRect().height
            textShift = shift(cy - height / 2, cy + height / 2, height, viewTop, viewportHeight, edgeBufferY, true)
          } else {
            const x = Math.round(rect.left + rect.width / 2)
            const y = Math.round(rect.top)
            tooltip.style.left = `${x - containerRect.left}px`
            if (!inside) {
              tooltip.style.top = dir === "above" ? `${y - containerRect.top}px` : `${y + rect.height - containerRect.top}px`
            }

            textShift = shift(x - tooltipWidth / 2, x + tooltipWidth / 2, tooltipWidth, viewLeft, viewportWidth, edgeBufferX, false)
          }

          const { width: bw, height: bh } = tooltipText.getBoundingClientRect()
          const ah = arrowSizeParts[1] ? parseFloat(arrowSizeParts[1]) : arrowBase / 2
          const ar = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-radius")) || 0
          const vertical = dir === "left" || dir === "right"
          const ax = vertical ? bw / 2 : bw / 2 - textShift
          const ay = vertical ? bh / 2 - textShift : bh / 2

          const arrowRoom = vertical
            ? (bh - arrowBase - edgeBufferY * 2) / 2
            : (bw - arrowBase - edgeBufferX * 2) / 2
          const drawnRadius = Math.max(0, Math.min(br, bw / 2, bh / 2, arrowRoom))

          const pathData = arrowPath(dir, bw, bh, drawnRadius, arrowBase, ah, ax, ay, ar)
          node._svgPath?.setAttribute("d", pathData)
          node._clipPath?.setAttribute("d", pathData)
          node._borderMaskPath?.setAttribute("d", pathData)

          if (textShift) {
            const transformVal = vertical ? `translate(0 ${textShift})` : `translate(${textShift} 0)`
            node._svgPath?.setAttribute("transform", transformVal)
            node._clipPath?.setAttribute("transform", transformVal)
            node._borderMaskPath?.setAttribute("transform", transformVal)
          } else {
            node._svgPath?.removeAttribute("transform")
            node._clipPath?.removeAttribute("transform")
            node._borderMaskPath?.removeAttribute("transform")
          }

          const customBg = node.dataset.easyTooltipBackground || styles.getPropertyValue("--easy-tooltip-background").trim()
          const customBorder = node.dataset.easyTooltipBorder || styles.getPropertyValue("--easy-tooltip-border").trim()

          let minX = 0, maxX = bw, minY = 0, maxY = bh
          if (dir === "left") maxX += ah
          else if (dir === "right") minX -= ah
          else if (dir === "above") maxY += ah
          else if (dir === "below") minY -= ah

          if (textShift) {
            if (vertical) {
              minY += Math.min(0, textShift)
              maxY += Math.max(0, textShift)
            } else {
              minX += Math.min(0, textShift)
              maxX += Math.max(0, textShift)
            }
          }

          if (customBg && node._surfaceDiv && node._foreignObj) {
            node._foreignObj.setAttribute("x", `${minX}`)
            node._foreignObj.setAttribute("y", `${minY}`)
            node._foreignObj.setAttribute("width", `${maxX - minX}`)
            node._foreignObj.setAttribute("height", `${maxY - minY}`)

            node._surfaceDiv.style.width = "100%"
            node._surfaceDiv.style.height = "100%"
            node._surfaceDiv.style.background = customBg
            node._foreignObj.style.display = ""
            node._svgPath?.style.setProperty("fill", "none")
          } else if (node._foreignObj) {
            node._foreignObj.style.display = "none"
            node._svgPath?.style.removeProperty("fill")
          }

          if (customBorder && customBorder !== "none" && node._borderMask && node._borderSurfaceDiv && node._borderForeignObj) {
            const bs = parseFloat(styles.getPropertyValue("--easy-tooltip-border-size")) || 0
            const pad = bs * 2
            const bx = minX - pad
            const by = minY - pad
            const bWidth = maxX - minX + pad * 2
            const bHeight = maxY - minY + pad * 2

            node._borderMask.setAttribute("x", `${bx}`)
            node._borderMask.setAttribute("y", `${by}`)
            node._borderMask.setAttribute("width", `${bWidth}`)
            node._borderMask.setAttribute("height", `${bHeight}`)

            node._borderForeignObj.setAttribute("x", `${bx}`)
            node._borderForeignObj.setAttribute("y", `${by}`)
            node._borderForeignObj.setAttribute("width", `${bWidth}`)
            node._borderForeignObj.setAttribute("height", `${bHeight}`)

            node._borderSurfaceDiv.style.width = "100%"
            node._borderSurfaceDiv.style.height = "100%"
            node._borderSurfaceDiv.style.background = customBorder
            node._borderForeignObj.style.display = ""
            node._svgPath?.style.setProperty("stroke", "none")
          } else if (node._borderForeignObj) {
            node._borderForeignObj.style.display = "none"
            node._svgPath?.style.removeProperty("stroke")
          }

          const anchorRect = rectValue(rect)
          tooltip._trigger = node
          tooltip._placement = {
            side: dir!,
            inside: !!inside,
            anchor: (useCursor || usePin ? anchorMode : "element") as TooltipAnchor,
            anchorRect,
            point: anchorPoint(anchorRect, dir!)
          }
          if (tooltip._dispatched) tooltipMove(tooltip)

          if (!node._observer) {
            const obs = new MutationObserver(() => reloadTooltips())
            obs.observe(node, {
              attributes: true,
              attributeFilter: [
                "data-easy-tooltip",
                "data-easy-tooltip-src",
                "data-easy-tooltip-background",
                "data-easy-tooltip-border",
                "data-easy-tooltip-style",
              ]
            })
            node._observer = obs
          }
          triggers.add(node)

          if (node._source && !node._sourceObserver) {
            const obs = new MutationObserver(() => reloadTooltips())
            obs.observe(node._source, { childList: true, subtree: true, characterData: true })
            node._sourceObserver = obs
          }
        }
      }
    }

    function removeTooltips(node: TooltipElement | undefined, force: boolean = false) {
      while (node && node !== document.body) {
        if (node._tooltip && !node._tooltip._held && (force || !node.matches(":hover"))) {
          tooltipVisibility(node._tooltip, false)
        }
        node = node.parentElement ?? undefined
      }
    }

    let runningTooltip: boolean, nextTooltipEvent: Function | null

    function queueTooltipUpdate(func: Function) {
      if (runningTooltip) {
        nextTooltipEvent = func
        return
      }

      runningTooltip = true
      func()

      queueMicrotask(() => {
        runningTooltip = false
        if (nextTooltipEvent) {
          const next = nextTooltipEvent
          nextTooltipEvent = null
          queueTooltipUpdate(next)
        }
      })
    }

    function reloadTooltips() {
      queueTooltipUpdate(addTooltips)
    }

    function updateTooltipTarget(e: Event, forceRemove: boolean = false) {
      queueTooltipUpdate(() => {
        removeTooltips(lastElement, forceRemove)
        lastElement = (e.target as TooltipElement | null) ?? undefined
        addTooltips()
      })
    }

    let touchedAt = 0

    function setTouchPos(e: TouchEvent) {
      const t = e.touches[0]
      if (!t) return false
      cursorX = t.clientX
      cursorY = t.clientY
      return true
    }

    function releaseHeld() {
      const trigger = heldTrigger
      if (!trigger) return
      heldTrigger = undefined
      const tooltip = trigger._tooltip
      if (!tooltip) return
      tooltip._held = false
      if (!trigger.matches(":hover")) tooltipVisibility(tooltip, false)
    }

    document.addEventListener("pointerdown", e => {
      releaseHeld()
      let node = e.target as TooltipElement | null
      while (node && node !== document.body && !node._tooltip) {
        node = node.parentElement as TooltipElement | null
      }
      if (!node?._tooltip) return
      const hold = node.dataset.easyTooltipHold
      if (hold === "false") return
      if (hold === undefined && !(e.target as Element)?.closest?.(holdControls)) return
      heldTrigger = node
      node._tooltip._held = true
    })

    for (const type of ["pointerup", "pointercancel"]) {
      window.addEventListener(type, releaseHeld)
    }

    document.addEventListener("touchstart", e => {
      touchedAt = performance.now()
      ignoreFocusReturn = false
      lastByPointer = true
      mouseActive = false
      setTouchPos(e)
      if (e.target === lastElement) return
      updateTooltipTarget(e, true)
    })

    document.addEventListener("touchmove", e => {
      touchedAt = performance.now()
      if (setTouchPos(e)) followCursor()
    })

    document.addEventListener("mouseover", e => {
      if (touchedAt && performance.now() - touchedAt < 700) return
      ignoreFocusReturn = false
      lastByPointer = true
      mouseActive = true
      cursorX = e.clientX
      cursorY = e.clientY
      updateTooltipTarget(e)
    })

    function followCursor() {
      let containerRect: DOMRect | undefined
      for (const node of triggers) {
        const mode = node.dataset.easyTooltipAnchor
        if (anchorBaseOf(mode) !== "cursor" || !node._tooltip) continue
        const axis = anchorAxisOf(mode)
        containerRect ??= tooltips.getBoundingClientRect()
        if (axis !== "x") node._tooltip.style.top = `${cursorY - containerRect.top}px`
        if (axis !== "y") node._tooltip.style.left = `${cursorX - containerRect.left}px`
      }
      if (cursorAnchorActive && !cursorRafQueued) {
        cursorRafQueued = true
        requestAnimationFrame(() => {
          cursorRafQueued = false
          reloadTooltips()
        })
      }
    }

    document.addEventListener("mousemove", e => {
      if (touchedAt && performance.now() - touchedAt < 700) return
      mouseActive = true
      cursorX = e.clientX
      cursorY = e.clientY
      followCursor()
    })

    document.addEventListener("focusin", e => {
      if (touchedAt && performance.now() - touchedAt < 700) return
      if (ignoreFocusReturn) {
        ignoreFocusReturn = false
        return
      }
      lastByPointer = false
      mouseActive = false
      updateTooltipTarget(e)
    })

    document.addEventListener("focusout", e => {
      queueTooltipUpdate(() => {
        if (e.target) {
          removeTooltips(e.target as TooltipElement)
        }
      })
    })

    window.addEventListener("blur", () => {
      if (heldTrigger?._tooltip) heldTrigger._tooltip._held = false
      heldTrigger = undefined
      ignoreFocusReturn = document.activeElement !== document.body
      queueTooltipUpdate(() => {
        lastElement = undefined
        for (const node of triggers) {
          if (node._tooltip) tooltipVisibility(node._tooltip, false)
        }
      })
    })

    window.addEventListener("resize", reloadTooltips)
    window.addEventListener("scroll", reloadTooltips, true)
    visualViewport?.addEventListener("resize", reloadTooltips)
    visualViewport?.addEventListener("scroll", reloadTooltips)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTooltips)
  } else {
    initTooltips()
  }
}
