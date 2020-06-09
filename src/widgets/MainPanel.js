const blessed = require('blessed')
const _ = require('lodash')
const fs = require('fs')

const { readLog } = require('../log')
const { formatRows } = require('../utils')

const BaseWidget = require('./BaseWidget')
const LogDetails = require('./LogDetails')
const Picker = require('./Picker')
const config = require('../Config')

// const FIELDS = ['timestamp', 'level', 'message'];
const FIELDS = []
config.get().columns.forEach(column => {
  FIELDS.push(column.key)
})

class MainPanel extends BaseWidget {
  constructor (opts = {}) {
    super(Object.assign({}, { top: '0', height: '99%', handleKeys: true }, opts))

    this.currentPage = opts.currentPage || 1
    this.initialRow = opts.initialRow || 0
    this.colSpacing = opts.colSpacing || 2
    this.wrap = opts.wrap || true
    this.row = 0
    this.rows = []
    this.lastSearchTerm = null
    this.levelFilter = opts.level
    this.filters = []
    this.sort = opts.sort || 'timestamp'
    this.mode = 'normal'
    this.updated = true
    this.watch = false

    if (opts.desc) {
      this.sort = `-${this.sort}`
    }

    this.log('pageWidth', this.pageWidth)
    this.on('resize', () => {
      this.screen.render()
      this.fixCursor()
      this.renderLines()
    })
    this.renderLines()
  }

  get pageHeight () { return this.height - 4 };
  get pageWidth () { return this.width - 2 - 2 };

  loadFile (file) {
    this.file = file
    this.rawLines = readLog(file)
    this.log('loaded', this.lines.length)
    this.renderLines()
    this.fsWait = false
    if (!this.watcher) {
      this.watcher = fs.watch(this.file, (event, filename) => {
        if (!this.watch) {
          return
        }
        if (filename) {
          if (this.fsWait) return
          this.fsWait = setTimeout(() => {
            this.fsWait = false
          }, 100)
          this.loadFile(this.file)

          if (this.sort.startsWith('-')) {
            while (this.row > 0) {
              this.moveUp()
            }
          } else {
            while (this.row < this.lastRow) {
              this.moveDown()
            }
          }

          /*
            this.moveToLine(this.rawLines.length-1);
            this.pageUp();
            this.moveToLastViewportLine();
            */
        }
      })
    }
  }

  get lastRow () {
    return (this.lines || []).length - 1
  }

  get lines () {
    if (this.updated) {
      this.linesCache = this.calcLines()
      this.updated = false
    }
    return this.linesCache
  }

  calcLines () {
    if (!this.rawLines) {
      return []
    }

    this.log('calcLines', this.sort, this.filters, this.levelFilter)

    const sort = (lines) => {
      if (!this.sort) { return lines }

      const sorted = _.chain(lines).sortBy(this.sortKey)
      if (this.sort.startsWith('-')) {
        return sorted.reverse().value()
      }

      return sorted.value()
    }

    const filters = _.cloneDeep(this.filters)
    if (this.levelFilter) {
      filters.push({ key: 'level', value: this.levelFilter })
    }

    if (!filters.length) {
      return sort(this.rawLines)
    }

    this.log('filters', filters)

    return sort(this.rawLines.filter(line => {
      return filters.reduce((bool, filter) => {
        const key = FIELDS.indexOf(filter.key) > -1
          ? filter.key : `data.${filter.key}`
        const value = _.get(line, key)
        if (!value) { return false }
        if (!filter.method) {
          return value && value === filter.value
        }
        if (filter.method === 'contains') {
          return value && value.toString().toLowerCase().indexOf(filter.value.toLowerCase()) > -1
        }
      }, true)
    }))
  }

  renderLines (notify = true) {
    this.resetMode()
    this.rows = this.lines.slice(this.initialRow, this.initialRow + this.height - 2)
    this.update(notify)
  }

  handleKeyPress (ch, key) {
    this.log('key', ch || (key && key.name))
    if (key.name === 'f1') {
      this.help()
    }

    if (key.name === 'down') {
      this.moveDown()
      return
    }
    if (key.name === 'up') {
      this.moveUp()
      return
    }
    if (ch === 'W') {
      this.watch = !this.watch
      this.update('notify')
      // this.message(`Watch: ${this.watch}`);
      return
    }
    if (key.name === 'w') {
      this.wrap = !this.wrap
      this.update()
      return
    }
    if (key.name === 'pagedown') {
      this.pageDown()
      return
    }
    if (key.name === 'pageup') {
      this.log('pageup triggering...')
      this.pageUp()
      return
    }
    if (key.name === 'enter') {
      this.displayDetails()
      return
    }
    if (ch === '0') {
      this.firstPage()
      return
    }
    if (ch === '$') {
      this.lastPage()
      return
    }
    if (ch === '/') {
      this.openSearch(true)
      return
    }
    if (ch === '?') {
      this.openSearch()
      return
    }
    if (ch === 'n') {
      this.search()
      return
    }
    if (ch === 'l') {
      this.openLevelFilter()
      return
    }
    if (ch === 'g') {
      this.openGoToLine()
      return
    }
    if (ch === 's') {
      this.openSort()
      return
    }
    if (ch === 'f') {
      if (this.filters.length || this.levelFilter) {
        return this.clearFilters()
      }
      this.openFilter()
      return
    }
    if (ch === 'r') {
      this.loadFile(this.file)
      return
    }
    if (ch === 'i') {
      let sort
      if (this.sort.startsWith('-')) {
        sort = this.sort.substring(1)
      } else {
        sort = `-${this.sort}`
      }
      this.setSort(sort)
      return
    }
    if (ch === 'q') {
      process.exit(0)
    }
    if (ch === 'A') {
      this.moveToFirstViewportLine()
      return
    }
    if (ch === 'G') {
      this.moveToLastViewportLine()
      return
    }
    if (ch === 'C') {
      this.moveToCenterViewportLine()
    }
  }

  help () {
    const str = `
    arrows and page up/down to move
    enter - display details

    /   to search
    ?   to search
    n   to search again
    s   to sort
    i   to toggle ascending/descending sort
    f   to filter
    l   to filter by level
    g   to go to line
    0   to go to first line
    $   to go to last line
    A   to first viewport line
    G   to last viewport line
    C   to center viewport line
    w   to wrap toggle
    W   to watch file toggle
    q   to quit
    `
    const prompt = blessed.box({
      parent: this,
      border: 'line',
      height: 'shrink',
      width: 'shrink',
      top: 'center',
      left: 'center',
      label: ' {blue-fg}Prompt{/blue-fg} ',
      content: str,
      tags: true,
      keys: true,
      vi: true,
      padding: 1
    })
    this.screen.append(prompt)
    prompt.focus()
    this.screen.render()
    const that = this
    prompt.key(['escape'], function (ch, key) {
      that.screen.remove(prompt)
      that.renderLines()
    })
  }

  openLevelFilter () {
    const levels = ['all', 'debug', 'info', 'warn', 'error']
    this.openPicker('Log Level', levels, (err, level) => {
      if (!level) { return }
      if (err) { return }

      this.log('selected', level)
      if (level === 'all') {
        return this.clearFilters()
      }
      this.setLevelFilter(level)
    })
  }

  get sortKey () {
    return this.sort && this.sort.replace(/^-/, '')
  }

  get sortAsc () {
    return !/^-/.test(this.sort)
  }

  openSort () {
    this.setMode('sort')
    this.openPicker('Sort by', FIELDS, (err, sort) => {
      if (!sort) { return this.resetMode() }
      if (err) { return }
      if (this.sortKey === sort && this.sortAsc) {
        return this.setSort(`-${sort}`)
      }
      this.setSort(sort)
    })
  }

  setUpdated () {
    this.updated = true
    this.emit('update')
  }

  setMode (mode) {
    this.mode = mode
    this.emit('update')
  }

  resetMode () {
    this.setMode('normal')
  }

  openFilter () {
    this.setMode('filter')
    const fields = ['timestamp', 'level', 'message', 'other']
    this.openPicker('Filter by', fields, (err, field) => {
      if (err || !field) { return this.resetMode() }
      if (field === 'level') {
        return this.openLevelFilter()
      }
      if (field === 'other') {
        return this.openCustomFilter()
      }
      this.openFilterTerm(field)
    })
  }

  openCustomFilter () {
    this.prompt('Field to filter:', '', (field) => {
      if (!field) { return this.resetMode() }
      if (field.indexOf(':') > -1) {
        return this.setFilter(field.split(':')[0], field.split(':')[1], 'contains')
      }
      this.openFilterTerm(field)
    })
  }

  openFilterTerm (field) {
    this.prompt(`Filter ${field} by:`, '', (value) => {
      if (!value) { return this.resetMode() }
      this.setFilter(field, value, 'contains')
    })
  }

  setSort (sort) {
    this.sort = sort
    this.renderLines()
  }

  setLevelFilter (level) {
    this.levelFilter = level
    this.filterChanged()
  }

  filterChanged () {
    this.row = 0
    this.initialRow = 0
    this.setUpdated()
    this.renderLines()
  }

  setFilter (key, value, method) {
    this.filters = [{ key, value, method }]
    this.filterChanged()
  }

  clearFilters () {
    this.levelFilter = null
    this.filters = []
    this.filterChanged()
  }

  openPicker (label, items, callback) {
    const picker = new Picker(this, { label, items, keySelect: true })
    picker.on('select', (err, value) => callback(null, value)) // eslint-disable-line
    picker.setCurrent()
  }

  prompt (str, value, callback) {
    const prompt = blessed.prompt({
      parent: this,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ' {blue-fg}Prompt{/blue-fg} ',
      tags: true,
      keys: true,
      vi: true,
      padding: 1
    })

    prompt.input(str, value || '', (err, value) => {
      if (err) { return }
      if (value) {
        callback(value)
      } else {
        this.renderLines()
      }
    })
  }

  openSearch (clear = false) {
    this.setMode('search')
    if (clear) {
      this.lastSearchTerm = null
    }
    this.prompt('Search:', this.lastSearchTerm, (value) => this.search(value))
  }

  openGoToLine () {
    this.setMode('GOTO')
    this.prompt('Line:', '', (value) => this.moveToLine(parseInt(value, 10) - 1))
  }

  searchTerm (term, caseSensitive, startRow) {
    const searchTerm = caseSensitive ? term : term.toLowerCase()
    return this.lines.findIndex((json, index) => {
      if (index < startRow) {
        return false
      }
      const l = JSON.stringify(json)
      const match = caseSensitive
        ? l
        : l.toLowerCase()

      return match.indexOf(searchTerm) > -1
    })
  }

  message (str) {
    var msg = blessed.question({
      parent: this,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ' {blue-fg}Message{/blue-fg} ',
      tags: true,
      keys: true,
      hidden: true,
      vi: true,
      padding: 1
    })

    msg.ask(str, (err, value) => { // eslint-disable-line
      this.log('value', value)
      this.renderLines()
    })
  }

  search (term = this.lastSearchTerm) {
    if (!term) {
      return this.message('No previous search')
    }
    this.lastSearchTerm = term
    const pos = this.searchTerm(term, false, this.row + 1)
    if (pos > -1) {
      this.moveToLine(pos)
    } else {
      this.message(`No matches for '${term}'`)
    }
  }

  moveToLine (num) {
    this.row = num
    this.initialRow = num
    this.renderLines()
  }

  isOutsideViewPort () {
    return this.row > this.initialRow + this.pageHeight
  }

  fixCursor () {
    if (this.isOutsideViewPort()) {
      this.initialRow = this.row - this.pageHeight
    }
  }

  moveToFirstViewportLine () {
    this.row = this.initialRow
    this.renderLines()
  }

  moveToCenterViewportLine () {
    this.row = parseInt((this.initialRow + this.pageHeight) / 2, 10)
    this.renderLines()
  }

  moveToLastViewportLine () {
    this.row = this.initialRow + this.pageHeight
    this.renderLines()
  }

  moveUp () {
    this.row = Math.max(0, this.row - 1)
    const outside = this.row < this.initialRow
    if (outside) {
      this.initialRow = this.row
    }
    this.renderLines(outside)
  }

  moveDown () {
    this.row = Math.min(this.lastRow, this.row + 1)
    const outside = this.row > this.lastVisibleLine
    if (outside) {
      this.initialRow += 1
    }
    this.renderLines(outside)
  }

  firstPage () {
    this.row = 0
    this.initialRow = 0
    this.renderLines()
  }

  lastPage () {
    this.row = this.lastRow
    this.initialRow = this.row - this.pageHeight
    this.renderLines()
  }

  pageDown () {
    const relativeRow = this.relativeRow
    this.row = Math.min(this.lastRow, this.row + this.pageHeight)
    this.initialRow = this.row - relativeRow
    this.renderLines()
  }

  pageUp () {
    const relativeRow = this.relativeRow
    if (this.row - this.pageHeight < 0) {
      return
    }
    this.row = Math.max(0, this.row - this.pageHeight)
    this.initialRow = Math.max(0, this.row - relativeRow)
    this.renderLines()
  }

  displayDetails () {
    const details = new LogDetails({ screen: this.screen })
    details.display(this.rows[this.relativeRow])
  }

  get relativeRow () {
    return this.row - this.initialRow
  }

  get lastVisibleLine () {
    return this.initialRow + this.pageHeight
  }

  update (notify = true) {
    this.setLabel(`[{bold} ${this.file} {/}] [{bold} ${this.row + 1}/${this.lastRow + 1} {/}]`)

    const columns = config.get().columns

    const highlight = (row, index) => {
      const str = row.split('\n')[0]
      if (index === this.relativeRow) {
        return `{white-bg}{black-fg}${str}{/}`
      }
      return str
    }

    const content = formatRows(
      this.rows, columns, this.colSpacing, this.pageWidth - 1
    ).map(highlight).join('\n')
    const list = blessed.element({ tags: true, content })
    this.children.forEach(child => this.remove(child))
    this.append(list)
    this.screen.render()
    if (notify) {
      this.setUpdated()
    }
  }
}

module.exports = MainPanel
