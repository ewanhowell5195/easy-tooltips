{
  function initTooltips() {
    const tooltips = document.createElement("div")
    tooltips.id = "easy-tooltips"
    document.body.append(tooltips)

    let lastElement
    let lastByPointer = false
    let cursorX = 0
    let cursorY = 0
    let cursorAnchorActive = false
    let cursorRafQueued = false
    let activeCount = 0
    let cooldownTimer
    let zIndexCounter = 0

    function activateTooltip(tooltip) {
      if (tooltip._activated) return
      tooltip._activated = true
      activeCount++
      clearTimeout(cooldownTimer)
      tooltips.classList.add("easy-tooltips-active")
      tooltip.style.zIndex = ++zIndexCounter
    }

    function deactivateTooltip(tooltip) {
      if (!tooltip._activated) return
      tooltip._activated = false
      activeCount--
      if (activeCount <= 0) {
        activeCount = 0
        clearTimeout(cooldownTimer)
        const cooldown = ms(getComputedStyle(document.documentElement).getPropertyValue("--easy-tooltip-cooldown"))
        if (cooldown > 0) {
          cooldownTimer = setTimeout(() => tooltips.classList.remove("easy-tooltips-active"), cooldown)
        } else {
          tooltips.classList.remove("easy-tooltips-active")
        }
      }
    }

    const observedNodes = new Set()
    const triggers = new Set()
    const observer = new MutationObserver(() => reloadTooltips())

    function releaseTooltip(node) {
      if (node._tooltip) {
        clearTimeout(node._tooltip._timeout)
        clearTimeout(node._tooltip._activateTimer)
        deactivateTooltip(node._tooltip)
        node._tooltip.remove()
      }
      observer.unobserve(node)
      observedNodes.delete(node)
      if (node._source) {
        observer.unobserve(node._source)
        observedNodes.delete(node._source)
      }
      triggers.delete(node)
      delete node._tooltip
      delete node._tooltipText
      delete node._svgPath
      delete node._tooltipClass
      delete node._source
      delete node._anchorPoint
      if (node === lastElement) lastElement = undefined
    }

    let releaseScheduled
    function scheduleRelease() {
      if (releaseScheduled) return
      releaseScheduled = true
      queueMicrotask(() => {
        releaseScheduled = false
        for (const node of triggers) {
          if (!node.isConnected) releaseTooltip(node)
        }
      })
    }

    new MutationObserver(records => {
      for (const record of records) {
        if (record.removedNodes.length) {
          scheduleRelease()
          return
        }
      }
    }).observe(document.body, { childList: true, subtree: true })

    function ms(value) {
      value = value.trim()
      return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000
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
          tooltip.classList.remove("easy-tooltip-visible")
          clearTimeout(tooltip._timeout)
          clearTimeout(tooltip._activateTimer)
          delete tooltip._timeout
          delete tooltip._activateTimer
          delete tooltip._start
          delete tooltip._delay
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
            if (src === "next" && node.nextElementSibling) {
              node._source = node.nextElementSibling
            } else {
              node._source = document.getElementById(src)
              if (!node._source) {
                try {
                  node._source = document.querySelector(src)
                } catch {}
              }
            }
            if (node._source) {
              toAdd.push(node)
            }
          }
          node = node.parentElement
        }
        for (let i = toAdd.length - 1; i >= 0; i--) {
          const node = toAdd[i]
          let tooltip = node._tooltip
          let tooltipText = node._tooltipText
          if (!tooltip) {
            tooltip = document.createElement("div")
            tooltip.className = "easy-tooltip"
            node._tooltip = tooltip

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.classList.add("easy-tooltip-bg")
            svg.setAttribute("aria-hidden", "true")
            const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
            svg.append(svgPath)
            tooltip.append(svg)
            node._svgPath = svgPath

            tooltipText = document.createElement("div")
            tooltipText.className = "easy-tooltip-text"
            tooltip.append(tooltipText)
            node._tooltipText = tooltipText

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
          let rect
          if (useCursor) {
            rect = { left: cursorX, right: cursorX, top: cursorY, bottom: cursorY, width: 0, height: 0 }
          } else if (usePin && node._anchorPoint) {
            const px = node._anchorPoint.x - window.scrollX
            const py = node._anchorPoint.y - window.scrollY
            rect = { left: px, right: px, top: py, bottom: py, width: 0, height: 0 }
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

          tooltip.style.minWidth = `${edgeBufferX * 2 + arrowBase}px`
          tooltipText.style.removeProperty("min-height")

          const viewportWidth = document.documentElement.clientWidth
          const viewportHeight = document.documentElement.clientHeight
          const prefer = node.dataset.easyTooltipPrefer
          const rightPlacementOffset = Math.round(rect.right + distance - padding)
          const leftPlacementOffset = Math.round(viewportWidth - rect.left + distance - padding)

          tooltipVisibility(tooltip, true)

          tooltip.style.removeProperty("translate")
          tooltip.style.removeProperty("--easy-tooltip-left-offset")
          tooltip.style.removeProperty("--easy-tooltip-right-offset")
          tooltipText.style.removeProperty("translate")
          tooltip.classList.remove("easy-tooltip-below", "easy-tooltip-inside", "easy-tooltip-left", "easy-tooltip-right")

          const tooltipRect = tooltip.getBoundingClientRect()
          const tooltipWidth = tooltipRect.width
          const tooltipHeight = tooltipRect.height

          let dir
          let inside = false

          if (prefer === "left" || prefer === "right") {
            tooltipText.style.setProperty("width", "min-content")
            tooltipText.style.setProperty("min-width", "0")
            const minWidth = tooltip.getBoundingClientRect().width
            tooltipText.style.removeProperty("width")
            tooltipText.style.removeProperty("min-width")

            for (const side of (prefer === "left" ? ["left", "right"] : ["right", "left"])) {
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
          tooltip.style.removeProperty("top")
          tooltip.style.removeProperty("left")

          if (dir === "below") tooltip.classList.add("easy-tooltip-below")
          else if (dir === "left") tooltip.classList.add("easy-tooltip-left")
          else if (dir === "right") tooltip.classList.add("easy-tooltip-right")
          if (inside) tooltip.classList.add("easy-tooltip-inside")

          if (dir === "left" || dir === "right") {
            tooltipText.style.minHeight = `${edgeBufferY * 2 + arrowBase}px`
          }

          function shift(before, after, size, viewportSize, edgeBuffer, vertical) {
            const maxTextShift = size / 2 - parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-size")) / 2 - edgeBuffer
            let text = 0
            let tip = 0
            if (before < padding) {
              text = Math.min(padding - before, maxTextShift)
              if (before + text < padding) tip = padding - (before + text)
            } else if (after > viewportSize - padding) {
              text = -Math.min(after - (viewportSize - padding), maxTextShift)
              if (after + text > viewportSize - padding) tip = -(after + text - (viewportSize - padding))
            }
            if (text) tooltipText.style.setProperty("translate", vertical ? `0 ${text}px` : `${text}px`)
            if (tip) tooltip.style.setProperty("translate", vertical ? `0 ${tip}px` : `${tip}px 0`)
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

          let textShift = 0

          if (dir === "left" || dir === "right") {
            const cy = Math.round(rect.top + rect.height / 2)
            tooltip.style.setProperty("top", `${cy}px`)
            if (!inside) {
              if (dir === "right") {
                tooltip.style.setProperty("left", `${Math.round(rect.right)}px`)
                tooltip.style.setProperty("--easy-tooltip-left-offset", `${rightPlacementOffset}px`)
              } else {
                tooltip.style.setProperty("left", `${Math.round(rect.left)}px`)
                tooltip.style.setProperty("--easy-tooltip-right-offset", `${leftPlacementOffset}px`)
              }
            }

            const height = tooltip.getBoundingClientRect().height
            textShift = shift(cy - height / 2, cy + height / 2, height, viewportHeight, parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-edge-buffer-y")), true)
          } else {
            const x = Math.round(rect.left + rect.width / 2)
            const y = Math.round(rect.top)
            tooltip.style.setProperty("left", `${x}px`)
            if (!inside) {
              tooltip.style.setProperty("top", dir === "above" ? `${y}px` : `${y + rect.height}px`)
            }

            textShift = shift(x - tooltipWidth / 2, x + tooltipWidth / 2, tooltipWidth, viewportWidth, parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-edge-buffer-x")), false)
          }

          const bodyRect = tooltipText.getBoundingClientRect()
          const bw = bodyRect.width
          const bh = bodyRect.height
          const br = parseFloat(styles.getPropertyValue("--easy-tooltip-border-radius")) || 0
          const ab = arrowBase
          const ah = arrowSizeParts[1] ? parseFloat(arrowSizeParts[1]) : ab / 2
          const ar = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-radius")) || 0
          const vertical = dir === "left" || dir === "right"
          const ax = vertical ? bw / 2 : bw / 2 - textShift
          const ay = vertical ? bh / 2 - textShift : bh / 2
          node._svgPath.setAttribute("d", arrowPath(dir, bw, bh, br, ab, ah, ax, ay, ar))
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

    function removeTooltips(nodes, force = false) {
      for (let node of nodes) {
        while (node && node !== document.body) {
          if (node._tooltip && (force || !node.matches(":hover"))) {
            tooltipVisibility(node._tooltip, false)
          }
          node = node.parentElement
        }
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

    function updateTooltipTarget(e, forceRemove = false) {
      queueTooltipUpdate(() => {
        removeTooltips([lastElement], forceRemove)
        lastElement = e.target
        addTooltips()
      })
    }

    let touched = false

    document.addEventListener("touchstart", e => {
      touched = true
      lastByPointer = true
      const t = e.touches[0]
      if (t) {
        cursorX = t.clientX
        cursorY = t.clientY
      }
      if (e.target === lastElement) return
      updateTooltipTarget(e, true)
    })

    document.addEventListener("touchmove", e => {
      const t = e.touches[0]
      if (!t) return
      cursorX = t.clientX
      cursorY = t.clientY
      followCursor()
    })

    document.addEventListener("mouseover", e => {
      if (touched) {
        touched = false
        return
      }
      lastByPointer = true
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
      cursorX = e.clientX
      cursorY = e.clientY
      followCursor()
    })

    document.addEventListener("focusin", e => {
      lastByPointer = false
      updateTooltipTarget(e)
    })

    document.addEventListener("focusout", e => {
      queueTooltipUpdate(() => removeTooltips([e.target]))
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