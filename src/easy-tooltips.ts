import "./easy-tooltips.css"

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
}

{
  function initTooltips() {
    const tooltips = document.createElement("div")
    tooltips.id = "easy-tooltips"
    document.body.append(tooltips)

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

    function activateTooltip(tooltip: TooltipElement) {
      tooltip._activated = true
      activeCount++
      clearTimeout(cooldownTimer)
      tooltips.classList.add("easy-tooltips-active")
      tooltip.style.zIndex = String(++zIndexCounter)
      startHoverPoll()
    }

    function deactivateTooltip(tooltip: TooltipElement) {
      if (!tooltip._activated) return
      tooltip._activated = false
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
      node._tooltip = node._tooltipText = node._svgPath = node._clipPath = node._foreignObj = node._surfaceDiv = node._borderMask = node._borderMaskPath = node._borderForeignObj = node._borderSurfaceDiv = node._tooltipClass = node._source = node._anchorPoint = undefined
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
          if (tip && tip.classList.contains("easy-tooltip-visible") && trigger !== cursorEl && !trigger.contains(cursorEl)) {
            tooltipVisibility(tip, false)
          }
        }
      }
      if (visibleCount > 0) hoverPollRaf = requestAnimationFrame(pollHover)
    }
    function startHoverPoll() {
      if (!hoverPollRaf) hoverPollRaf = requestAnimationFrame(pollHover)
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
            } else {
              try { node._source = (document.getElementById(src) || document.querySelector(src)) ?? undefined } catch {}
            }
            if (oldSource !== node._source && node._sourceObserver) {
              node._sourceObserver.disconnect()
              node._sourceObserver = undefined
            }
            if (node._source) toAdd.push(node)
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
          const useCursor = anchorMode === "cursor" && lastByPointer
          const usePin = anchorMode === "pin" && lastByPointer
          if (useCursor) cursorAnchorActive = true
          if (usePin && !tooltip.classList.contains("easy-tooltip-visible")) {
            node._anchorPoint = { x: cursorX + window.scrollX, y: cursorY + window.scrollY }
          }
          const pointRect = (x: number, y: number) => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 })
          let rect
          if (useCursor) {
            rect = pointRect(cursorX, cursorY)
          } else if (usePin && node._anchorPoint) {
            rect = pointRect(node._anchorPoint.x - window.scrollX, node._anchorPoint.y - window.scrollY)
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

          tooltip.style.minWidth = `${edgeBufferX * 2 + arrowBase + br * 2}px`
          tooltipText.style.minHeight = ""

          const viewportWidth = document.documentElement.clientWidth
          const viewportHeight = document.documentElement.clientHeight
          const prefer = node.dataset.easyTooltipPrefer
          const rightPlacementOffset = Math.round(rect.right + distance - padding)
          const leftPlacementOffset = Math.round(viewportWidth - rect.left + distance - padding)

          tooltip.style.translate = ""
          tooltip.style.removeProperty("--easy-tooltip-left-offset")
          tooltip.style.removeProperty("--easy-tooltip-right-offset")
          tooltipText.style.translate = ""
          tooltip.classList.remove("easy-tooltip-below", "easy-tooltip-inside", "easy-tooltip-left", "easy-tooltip-right")

          let tooltipWidth: number = 0, tooltipHeight: number = 0
          let dir: "above" | "below" | "right" | "left" | undefined, inside

          if (prefer === "left" || prefer === "right") {
            tooltip.style.minWidth = `${br * 2}px`
            tooltipText.style.width = "min-content"
            tooltipText.style.minWidth = "0"
            const minWidth = tooltip.getBoundingClientRect().width
            tooltipText.style.width = ""
            tooltipText.style.minWidth = ""

            for (const side of [prefer, prefer === "left" ? "right" : "left"] as ("right" | "left")[]) {
              if ((side === "left" ? rect.left - distance - padding : viewportWidth - rect.right - distance - padding) < minWidth) continue
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
            const fitsAbove = y - tooltipHeight - distance > padding
            const fitsBelow = y + rect.height + tooltipHeight + distance < viewportHeight - padding

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
          tooltipVisibility(tooltip, show)

          if (dir === "left" || dir === "right") {
            tooltipText.style.minHeight = `${edgeBufferY * 2 + arrowBase + br * 2}px`
          } else {
            tooltipText.style.minHeight = `${br * 2}px`
          }

          function shift(
            before: number,
            after: number,
            size: number,
            viewportSize: number,
            edgeBuffer: number,
            vertical: boolean
          ) {
            const maxTextShift = size / 2 - arrowBase / 2 - edgeBuffer - br
            let text = 0, tip = 0
            if (before < padding) {
              text = Math.min(padding - before, maxTextShift)
              if (before + text < padding) tip = padding - (before + text)
            } else if (after > viewportSize - padding) {
              text = -Math.min(after - (viewportSize - padding), maxTextShift)
              if (after + text > viewportSize - padding) tip = -(after + text - (viewportSize - padding))
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
            tooltip.style.top = `${cy}px`
            if (!inside) {
              tooltip.style.left = `${Math.round(dir === "right" ? rect.right : rect.left)}px`
              if (dir === "right") {
                tooltip.style.setProperty("--easy-tooltip-left-offset", `${rightPlacementOffset}px`)
                tooltip.style.removeProperty("--easy-tooltip-right-offset")
              } else {
                tooltip.style.setProperty("--easy-tooltip-right-offset", `${leftPlacementOffset}px`)
                tooltip.style.removeProperty("--easy-tooltip-left-offset")
              }
            }

            const height = tooltip.getBoundingClientRect().height
            textShift = shift(cy - height / 2, cy + height / 2, height, viewportHeight, edgeBufferY, true)
          } else {
            const x = Math.round(rect.left + rect.width / 2)
            const y = Math.round(rect.top)
            tooltip.style.left = `${x}px`
            if (!inside) {
              tooltip.style.top = dir === "above" ? `${y}px` : `${y + rect.height}px`
            }

            textShift = shift(x - tooltipWidth / 2, x + tooltipWidth / 2, tooltipWidth, viewportWidth, edgeBufferX, false)
          }

          const { width: bw, height: bh } = tooltipText.getBoundingClientRect()
          const ah = arrowSizeParts[1] ? parseFloat(arrowSizeParts[1]) : arrowBase / 2
          const ar = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-radius")) || 0
          const vertical = dir === "left" || dir === "right"
          const ax = vertical ? bw / 2 : bw / 2 - textShift
          const ay = vertical ? bh / 2 - textShift : bh / 2

          const pathData = arrowPath(dir, bw, bh, br, arrowBase, ah, ax, ay, ar)
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

          if (!node._observer) {
            const obs = new MutationObserver(() => reloadTooltips())
            obs.observe(node, {
              attributes: true,
              attributeFilter: ["data-easy-tooltip", "data-easy-tooltip-src", "data-easy-tooltip-background", "data-easy-tooltip-border"]
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
        if (node._tooltip && (force || !node.matches(":hover"))) {
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
      for (const node of triggers) {
        if (node.dataset.easyTooltipAnchor !== "cursor" || !node._tooltip) continue
        node._tooltip.style.top = `${cursorY}px`
        node._tooltip.style.left = `${cursorX}px`
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
      ignoreFocusReturn = document.activeElement !== document.body
      queueTooltipUpdate(() => {
        lastElement = undefined
        for (const node of triggers) {
          if (node._tooltip) tooltipVisibility(node._tooltip, false)
        }
      })
    })

    window.addEventListener("resize", reloadTooltips)
    window.addEventListener("scroll", reloadTooltips)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTooltips)
  } else {
    initTooltips()
  }
}