const fs = require('fs')
const _ = require('lodash')

const config = require('./Config')

const FIELDS = []
config.get().columns.forEach(column => {
  FIELDS.push(column.key)
})

function transform (entry, _fs = fs) {
  return entry
}

function parse (line) {
  try {
    return transform(JSON.parse(line))
  } catch (e) {
    return null
  }
}

function readLog (file, reader = fs) {
  const contents = reader.readFileSync(file).toString()
  const lines = _.compact(contents.split('\n').filter(line => line).map(parse))

  return lines.map(line => {
    const result = _.pick(line, FIELDS)
    const data = _.omit(line, FIELDS)
    return Object.assign({}, result, { data })
  })
};

module.exports = { readLog, transform }
