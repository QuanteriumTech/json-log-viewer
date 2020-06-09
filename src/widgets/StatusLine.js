const blessed = require('blessed')

class StatusLine extends blessed.Box {
  constructor (opts = {}) {
    super(Object.assign({}, {
      top: opts.screen.height - 3,
      left: 1,
      width: '99%',
      height: 1,
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue'
      }
    }, opts))

    this.mainPanel = opts.mainPanel
    this.mainPanel.on('update', this.update.bind(this))
    this.on('resize', () => {
      this.position.top = opts.screen.height - 1
      this.update()
    })
    this.update()
  }

  log (...s) {
    this.screen.log(...s)
  }

  get row () { return this.mainPanel.row + 1 }
  get lastRow () { return this.mainPanel.lastRow + 1 };
  get mode () { return this.mainPanel.mode.toUpperCase() }
  get sort () { return this.mainPanel.sort }
  get pageHeight () { return this.mainPanel.pageHeight }
  get filters () {
    const { filters, levelFilter } = this.mainPanel
    if (this.mainPanel.levelFilter) {
      return filters.concat({ key: 'level', value: levelFilter })
    }
    return filters
  }

  update () {
    const mode = `{yellow-bg}{#f0f0f0-fg}{bold} ${this.mode} {/}`
    const line = `{bold}${this.row}{/}/{bold}${this.lastRow}{/}`
    const pageSize = `| {bold}${this.pageHeight}{/}`
    const sort = this.sort ? `| sort: {bold}${this.sort}{/}` : ''
    const filterExpr = this.filters.map(f => `${f.key}:${f.value}`).join(' ')
    const filters = filterExpr ? `| filters: {bold}${filterExpr}{/}` : ''
    this.setContent(` ${mode} ${line} ${pageSize} ${sort} ${filters} W:${this.mainPanel.watch}`)
    this.screen.render()
  }
}

module.exports = StatusLine
