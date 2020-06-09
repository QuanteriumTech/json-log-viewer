const fs = require('fs')
const path = require('path')
const os = require('os')

class Config {
  constructor () {
    if (!Config.instance) {
      Config.instance = this
    }
    this.contents = 'unloaded'
    this.loadData()
    return Config.instance
  }

  loadData () {
    let transformFile = path.resolve('.json-log-viewer.json')
    if (!fs.existsSync(transformFile)) {
      transformFile = path.join(os.homedir(), '.json-log-viewer.json')
    }
    if (!fs.existsSync(transformFile)) throw new Error('no config found')

    this.contents = JSON.parse(fs.readFileSync(transformFile, 'utf8'))
  }

  get () {
    return this.contents
  }
}

const instance = new Config()
Object.freeze(instance)

module.exports = instance
