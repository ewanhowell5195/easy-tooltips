{
  function initTooltips() {
    const tooltips = document.createElement("div")
    tooltips.id = "easy-tooltips"
    document.body.append(tooltips)

    let lastElement

    const observedNodes = new Set()
    const observer = new MutationObserver(() => reloadTooltips())

    function tooltipVisibility(tooltip, visible) {
      const styles = getComputedStyle(tooltip)
      const raw = styles.getPropertyValue("--easy-tooltip-animation-length").trim()
      if (visible) {
        const delayStr = styles.getPropertyValue("--easy-tooltip-delay").trim()
        const delay = delayStr.endsWith("ms") ? parseFloat(delayStr) : parseFloat(delayStr) * 1000
        if (delay) {
          tooltip._start = performance.now()
          tooltip._delay = delay
        }
        tooltip._animation_duration = (raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000) + delay
      } else {
        if (tooltip._delay && performance.now() < tooltip._start + tooltip._delay) {
          tooltip.classList.remove("easy-tooltip-visible")
          clearTimeout(tooltip._timeout)
          delete tooltip._timeout
          delete tooltip._start
          delete tooltip._delay
          return
        }
        tooltip._animation_duration = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000
      }

      if (tooltip.classList.contains("easy-tooltip-visible") === visible) {
        tooltip._next = undefined
        return
      }

      if (tooltip._timeout === undefined) {
        tooltip._next = undefined
        tooltip.classList.toggle("easy-tooltip-visible", visible)
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
            
            const customClass = node.dataset.easyTooltipClass
            if (customClass) {
              tooltip.classList.add(...customClass.trim().split(/\s+/))
              node._tooltipClass = customClass
            }

            tooltipText = document.createElement("div")
            tooltipText.className = "easy-tooltip-text"
            if (node._source) {
              tooltipText.replaceChildren(...node._source.cloneNode(true).childNodes)
              tooltipText.classList.add("easy-tooltip-text-html")
            } else {
              tooltipText.textContent = node.dataset.easyTooltip
            }
            tooltip.append(tooltipText)
            node._tooltipText = tooltipText
            
            tooltips.append(tooltip)
          } else {
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
          }
          
          const rect = node.getBoundingClientRect()

          const styles = getComputedStyle(tooltip)
          const distance = parseFloat(styles.getPropertyValue("--easy-tooltip-distance"))
          const arrowSize = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-size"))
          const edgeBuffer = parseFloat(styles.getPropertyValue("--easy-tooltip-arrow-edge-buffer"))
          const padding = parseFloat(styles.getPropertyValue("--easy-tooltip-viewport-padding"))

          const viewportWidth = document.documentElement.clientWidth
          const viewportHeight = document.documentElement.clientHeight
          const prefer = node.dataset.easyTooltipPrefer

          tooltipVisibility(tooltip, true)

          tooltip.style.removeProperty("translate")
          tooltip.style.removeProperty("--easy-tooltip-left-offset")
          tooltip.style.removeProperty("--easy-tooltip-right-offset")
          tooltipText.style.removeProperty("translate")
          tooltip.classList.remove("easy-tooltip-below", "easy-tooltip-inside", "easy-tooltip-left", "easy-tooltip-right")

          const tooltipRect = tooltip.getBoundingClientRect()
          const tooltipWidth = tooltipRect.width
          const tooltipHeight = tooltipRect.height

          if (prefer === "left" || prefer === "right") {
            const cy = Math.round(rect.top + rect.height / 2)

            tooltipText.style.setProperty("width", "min-content")
            tooltipText.style.setProperty("min-width", "0")
            const minWidth = tooltip.getBoundingClientRect().width
            tooltipText.style.removeProperty("width")
            tooltipText.style.removeProperty("min-width")

            const fitsLeft = rect.left - distance - padding >= minWidth
            const fitsRight = viewportWidth - rect.right - distance - padding >= minWidth

            let placement
            if (prefer === "left") {
              placement = fitsLeft ? "left" : fitsRight ? "right" : "left"
            } else {
              placement = fitsRight ? "right" : fitsLeft ? "left" : "right"
            }

            tooltip.classList.add("easy-tooltip-" + placement)
            tooltip.style.setProperty("top", `${cy}px`)

            if (placement === "right") {
              tooltip.style.setProperty("left", `${Math.round(rect.right)}px`)
              tooltip.style.setProperty("--easy-tooltip-left-offset", `${Math.round(rect.right + distance - padding)}px`)
            } else {
              tooltip.style.setProperty("left", `${Math.round(rect.left)}px`)
              tooltip.style.setProperty("--easy-tooltip-right-offset", `${Math.round(viewportWidth - rect.left + distance - padding)}px`)
            }

            const constrainedHeight = tooltip.getBoundingClientRect().height
            const maxTextShift = (constrainedHeight / 2) - (arrowSize / 2) - edgeBuffer
            const tooltipTop = cy - constrainedHeight / 2
            const tooltipBottom = cy + constrainedHeight / 2

            if (tooltipTop < padding) {
              const overflow = padding - tooltipTop
              const textShift = Math.min(overflow, maxTextShift)
              tooltipText.style.setProperty("translate", `0 ${textShift}px`)

              if (tooltipTop + textShift < padding) {
                tooltip.style.setProperty("translate", `0 ${padding - (tooltipTop + textShift)}px`)
              }
            } else if (tooltipBottom > viewportHeight - padding) {
              const overflow = tooltipBottom - (viewportHeight - padding)
              const textShift = Math.min(overflow, maxTextShift)
              tooltipText.style.setProperty("translate", `0 -${textShift}px`)

              if (tooltipBottom - textShift > viewportHeight - padding) {
                tooltip.style.setProperty("translate", `0 -${(tooltipBottom - textShift) - (viewportHeight - padding)}px`)
              }
            }
          } else {
            const x = Math.round(rect.left + rect.width / 2)
            const y = Math.round(rect.top)
            const totalOffset = tooltipHeight + distance

            tooltip.style.setProperty("left", `${x}px`)

            const fitsAbove = y - totalOffset > padding
            const fitsBelow = y + rect.height + tooltipHeight + distance < viewportHeight - padding

            let placement
            if (prefer === "below") {
              placement = fitsBelow ? "below" : fitsAbove ? "above" : "inside"
            } else {
              placement = fitsAbove ? "above" : fitsBelow ? "below" : "inside"
            }

            if (placement === "above") {
              tooltip.style.setProperty("top", `${y}px`)
            } else if (placement === "below") {
              tooltip.classList.add("easy-tooltip-below")
              tooltip.style.setProperty("top", `${y + rect.height}px`)
            } else {
              tooltip.classList.add("easy-tooltip-inside")
            }

            const maxTextShift = (tooltipWidth / 2) - (arrowSize / 2) - edgeBuffer
            const tooltipLeft = x - tooltipWidth / 2
            const tooltipRight = x + tooltipWidth / 2

            if (tooltipLeft < padding) {
              const overflow = padding - tooltipLeft
              const textShift = Math.min(overflow, maxTextShift)
              tooltipText.style.setProperty("translate", `${textShift}px`)

              if (tooltipLeft + textShift < padding) {
                tooltip.style.setProperty("translate", `${padding - (tooltipLeft + textShift)}px 0`)
              }
            } else if (tooltipRight > viewportWidth - padding) {
              const overflow = tooltipRight - (viewportWidth - padding)
              const textShift = Math.min(overflow, maxTextShift)
              tooltipText.style.setProperty("translate", `-${textShift}px`)

              if (tooltipRight - textShift > viewportWidth - padding) {
                tooltip.style.setProperty("translate", `-${(tooltipRight - textShift) - (viewportWidth - padding)}px 0`)
              }
            }
          }

          if (!observedNodes.has(node)) {
            observer.observe(node, { attributes: true, attributeFilter: ["data-easy-tooltip", "data-easy-tooltip-src"] })
            observedNodes.add(node)
          }
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
      queueTooltipUpdate(() => {
        addTooltips()
      })
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
      if (e.target === lastElement) return
      updateTooltipTarget(e, true)
    })

    document.addEventListener("mouseover", e => {
      if (touched) {
        touched = false
        return
      }
      updateTooltipTarget(e)
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