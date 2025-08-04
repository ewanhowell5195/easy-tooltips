const tooltips = document.createElement("div")
tooltips.id = "tooltips"
document.body.append(tooltips)

let lastElement

function tooltipVisibility(tooltip, visible) {
  if (tooltip._animation_duration === undefined) {
    const styles = getComputedStyle(tooltip)
    const raw = styles.getPropertyValue("--tooltip-animation-length").trim()
    tooltip._animation_duration = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000
  }

  if (tooltip.classList.contains("visible") === visible) {
    tooltip._next = undefined
    return
  }

  if (tooltip._timeout === undefined) {
    tooltip._next = undefined
    tooltip.classList.toggle("visible", visible)
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
      if (node.hasAttribute("data-tooltip")) {
        toAdd.push(node)
      }
      node = node.parentElement
    }
    for (let i = toAdd.length - 1; i >= 0; i--) {
      const node = toAdd[i]
      let tooltip = node._tooltip
      let tooltipText = node._tooltipText
      if (!tooltip) {
        tooltip = document.createElement("div")
        tooltip.className = "tooltip"
        node._tooltip = tooltip
        
        if (node.dataset.tooltipId) {
          tooltip.id = node.dataset.tooltipId 
        }
        
        tooltipText = document.createElement("div")
        tooltipText.className = "tooltip-text"
        tooltipText.innerHTML = node.dataset.tooltip
        tooltip.append(tooltipText)
        node._tooltipText = tooltipText
        
        tooltips.append(tooltip)
      } else {
        tooltipText.innerHTML = node.dataset.tooltip

        if (node.dataset.tooltipId) {
          tooltip.id = node.dataset.tooltipId 
        } else {
          tooltip.id = null
        }
      }
      
      const rect = node.getBoundingClientRect()

      const x = Math.round(rect.left + rect.width / 2)
      const y = Math.round(rect.top)

      const tooltipRect = tooltip.getBoundingClientRect()
      const styles = getComputedStyle(tooltip)
      const verticalDistance = parseFloat(styles.getPropertyValue("--tooltip-vertical-distance"))
      const arrowWidth = parseFloat(styles.getPropertyValue("--tooltip-arrow-size"))
      const edgeBuffer = parseFloat(styles.getPropertyValue("--tooltip-arrow-edge-buffer"))
      const padding = parseFloat(styles.getPropertyValue("--tooltip-viewport-padding"))

      tooltipVisibility(tooltip, true)

      const tooltipWidth = tooltipRect.width
      const tooltipHeight = tooltipRect.height

      const totalOffset = tooltipHeight + verticalDistance
      
      tooltip.style.setProperty("left", `${x}px`)
      tooltip.style.removeProperty("translate")
      tooltipText.style.removeProperty("translate")

      if (y - totalOffset > padding) {
        tooltip.classList.remove("below")
        tooltip.classList.remove("inside")
        tooltip.style.setProperty("top", `${y}px`)
      } else if (y + rect.height + tooltipHeight + verticalDistance < document.documentElement.clientHeight - padding) {
        tooltip.classList.add("below")
        tooltip.classList.remove("inside")
        tooltip.style.setProperty("top", `${y + rect.height}px`)
      } else {
        tooltip.classList.remove("below")
        tooltip.classList.add("inside")
      }

      const maxTextShift = (tooltipWidth / 2) - (arrowWidth / 2) - edgeBuffer

      const tooltipLeft = x - tooltipWidth / 2
      const tooltipRight = x + tooltipWidth / 2

      if (tooltipLeft < padding) {
        const overflow = padding - tooltipLeft
        const textShift = Math.min(overflow, maxTextShift)
        tooltipText.style.setProperty("translate", `${textShift}px`)

        if (tooltipLeft + textShift < padding) {
          tooltip.style.setProperty("translate", `${padding - (tooltipLeft + textShift)}px 0`)
        }
      } else if (tooltipRight > document.documentElement.clientWidth - padding) {
        const overflow = tooltipRight - (document.documentElement.clientWidth - padding)
        const textShift = Math.min(overflow, maxTextShift)
        tooltipText.style.setProperty("translate", `-${textShift}px`)

        if (tooltipRight - textShift > document.documentElement.clientWidth - padding) {
          tooltip.style.setProperty("translate", `-${(tooltipRight - textShift) - (document.documentElement.clientWidth - padding)}px 0`)
        }
      }
    }
  }
}

function removeTooltips(nodes) {
  for (let node of nodes) {
    while (node && node !== document.body) {
      if (node._tooltip && !node.matches(":hover")) {
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

document.addEventListener("mouseover", e => {
  queueTooltipUpdate(() => {
    removeTooltips([lastElement])
    lastElement = e.target
    addTooltips()
  })
})

document.addEventListener("touchstart", e => {
  queueTooltipUpdate(() => {
    removeTooltips([lastElement])
    lastElement = e.target
    addTooltips()
  })
})

window.addEventListener("resize", reloadTooltips)
window.addEventListener("scroll", reloadTooltips)