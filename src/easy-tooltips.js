{
  function initTooltips() {
    const tooltips = document.createElement("div")
    tooltips.id = "easy-tooltips"
    document.body.append(tooltips)

    let lastElement, lastByPointer, cursorX, cursorY, cursorAnchorActive, cursorRafQueued, cooldownTimer
    let activeCount = 0, visibleCount = 0, zIndexCounter = 0

    function activateTooltip(tooltip) {
      tooltip._activated = true
      activeCount++
      clearTimeout(cooldownTimer)
      tooltips.classList.add("easy-tooltips-active")
      tooltip.style.zIndex = ++zIndexCounter
      startHoverPoll()
    }

    function deactivateTooltip(tooltip) {
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

    const observedNodes = new Set()
    const triggers = new Set()
    const observer = new MutationObserver(() => reloadTooltips())

    function releaseTooltip(node) {
      const t = node._tooltip
      if (t) {
        if (t.classList.contains("easy-tooltip-visible")) visibleCount--
        clearTimeout(t._timeout)
        clearTimeout(t._activateTimer)
        deactivateTooltip(t)
        t.remove()
      }
      observer.unobserve(node)
      observedNodes.delete(node)
      if (node._source) {
        observer.unobserve(node._source)
        observedNodes.delete(node._source)
      }
      triggers.delete(node)
      node._tooltip = node._tooltipText = node._svgPath = node._tooltipClass = node._source = node._anchorPoint = undefined
      if (node === lastElement) lastElement = undefined
    }

    let releaseScheduled
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

    let hoverPollRaf
    function pollHover() {
      hoverPollRaf = 0
      if (cursorX === undefined) return
      const cursorEl = document.elementFromPoint(cursorX, cursorY)
      for (const trigger of triggers) {
        const tip = trigger._tooltip
        if (tip && tip.classList.contains("easy-tooltip-visible") && trigger !== cursorEl && !trigger.contains(cursorEl)) {
          tooltipVisibility(tip, false)
        }
      }
      if (visibleCount > 0) hoverPollRaf = requestAnimationFrame(pollHover)
    }
    function startHoverPoll() {
      if (!hoverPollRaf) hoverPollRaf = requestAnimationFrame(pollHover)
    }

    function ms(value) {
      value = value.trim()
      const n = parseFloat(value)
      return value.endsWith("ms") ? n : n * 1000
    }

    function tooltipVisibility(tooltip, visible) {
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
        if (tooltip._delay && performance.now() < tooltip._start + tooltip._delay) {
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
        let node = lastElement
        while (node && node !== document.body) {
          if (node.dataset.easyTooltip) {
            toAdd.push(node)
          } else if (node.dataset.easyTooltipSrc) {
            const src = node.dataset.easyTooltipSrc
            if (src === "next") {
              node._source = node.nextElementSibling
            } else {
              try { node._source = document.getElementById(src) || document.querySelector(src) } catch {}
            }
            if (node._source) toAdd.push(node)
          }
          node = node.parentElement
        }
        for (let i = toAdd.length; i--;) {
          const node = toAdd[i]
          let tooltip = node._tooltip
          let tooltipText = node._tooltipText
          if (!tooltip) {
            tooltip = document.createElement("div")
            tooltip.className = "easy-tooltip easy-tooltip-setup"
            node._tooltip = tooltip

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.classList.add("easy-tooltip-bg")
            svg.setAttribute("aria-hidden", "true")
            const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
            svg.append(svgPath)
            node._svgPath = svgPath

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
            tooltipText.textContent = node.dataset.easyTooltip
            tooltipText.classList.remove("easy-tooltip-text-html")
          }
          
          const anchorMode = node.dataset.easyTooltipAnchor
          const useCursor = anchorMode === "cursor" && lastByPointer
          const usePin = anchorMode === "pin" && lastByPointer
          if (useCursor) cursorAnchorActive = true
          if (usePin && !tooltip.classList.contains("easy-tooltip-visible")) {
            node._anchorPoint = { x: cursorX + window.scrollX, y: cursorY + window.scrollY }
          }
          const pointRect = (x, y) => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 })
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

          let tooltipWidth, tooltipHeight
          let dir, inside

          if (prefer === "left" || prefer === "right") {
            tooltip.style.minWidth = `${br * 2}px`
            tooltipText.style.width = "min-content"
            tooltipText.style.minWidth = "0"
            const minWidth = tooltip.getBoundingClientRect().width
            tooltipText.style.width = ""
            tooltipText.style.minWidth = ""

            for (const side of [prefer, prefer === "left" ? "right" : "left"]) {
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
            ({ width: tooltipWidth, height: tooltipHeight } = tooltip.getBoundingClientRect())
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
          tooltipVisibility(tooltip, true)

          if (dir === "left" || dir === "right") {
            tooltipText.style.minHeight = `${edgeBufferY * 2 + arrowBase + br * 2}px`
          } else {
            tooltipText.style.minHeight = `${br * 2}px`
          }

          function shift(before, after, size, viewportSize, edgeBuffer, vertical) {
            const maxTextShift = size / 2 - arrowBase / 2 - edgeBuffer - br
            let text = 0, tip = 0
            if (before < padding) {
              text = Math.min(padding - before, maxTextShift)
              if (before + text < padding) tip = padding - (before + text)
            } else if (after > viewportSize - padding) {
              text = -Math.min(after - (viewportSize - padding), maxTextShift)
              if (after + text > viewportSize - padding) tip = -(after + text - (viewportSize - padding))
            }
            if (text) tooltipText.style.translate = vertical ? `0 ${text}px` : `${text}px`
            if (tip) tooltip.style.translate = vertical ? `0 ${tip}px` : `${tip}px 0`
            return text
          }

          function arrowPath(dir, w, h, r, ab, ah, ax, ay, ar) {
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
          node._svgPath.setAttribute("d", arrowPath(dir, bw, bh, br, arrowBase, ah, ax, ay, ar))
          if (textShift) {
            node._svgPath.setAttribute("transform", vertical ? `translate(0 ${textShift})` : `translate(${textShift} 0)`)
          } else {
            node._svgPath.removeAttribute("transform")
          }

          if (!observedNodes.has(node)) {
            observer.observe(node, { attributes: true, attributeFilter: ["data-easy-tooltip", "data-easy-tooltip-src"] })
            observedNodes.add(node)
          }
          triggers.add(node)
          if (node._source && !observedNodes.has(node._source)) {
            observer.observe(node._source, { childList: true, subtree: true, characterData: true })
            observedNodes.add(node._source)
          }
        }
      }
    }

    function removeTooltips(node, force) {
      while (node && node !== document.body) {
        if (node._tooltip && (force || !node.matches(":hover"))) {
          tooltipVisibility(node._tooltip, false)
        }
        node = node.parentElement
      }
    }

    let runningTooltip, nextTooltipEvent

    function queueTooltipUpdate(func) {
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

    function updateTooltipTarget(e, forceRemove) {
      queueTooltipUpdate(() => {
        removeTooltips(lastElement, forceRemove)
        lastElement = e.target
        addTooltips()
      })
    }

    let touchedAt = 0

    function setTouchPos(e) {
      const t = e.touches[0]
      if (!t) return false
      cursorX = t.clientX
      cursorY = t.clientY
      return true
    }

    document.addEventListener("touchstart", e => {
      touchedAt = performance.now()
      lastByPointer = true
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
      lastByPointer = true
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
      cursorX = e.clientX
      cursorY = e.clientY
      followCursor()
    })

    document.addEventListener("focusin", e => {
      if (touchedAt && performance.now() - touchedAt < 700) return
      lastByPointer = false
      updateTooltipTarget(e)
    })

    document.addEventListener("focusout", e => {
      queueTooltipUpdate(() => removeTooltips(e.target))
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