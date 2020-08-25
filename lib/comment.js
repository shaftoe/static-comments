const { join } = require('path')
const { v4: uuidv4 } = require('uuid')

module.exports = class Comment {
  constructor (postData) {
    if (!postData?.config) throw TypeError('Comment: Missing `config` in payload')
    if (!postData?.config?.repo) throw TypeError('Comment: Missing `config[repo]` in payload')
    if (!postData?.config?.path) throw TypeError('Comment: Missing `config[path]` in payload')
    if (!postData?.comment) throw TypeError('Comment: Missing `comment` in payload')

    if (typeof (postData.config.path) !== 'string') {
      throw TypeError('Comment: Invalid config[path]: ' + postData.config.path)
    }

    try {
      const splitted = postData.config.repo.split('/')
      if (splitted.length !== 2 ||
        splitted[0].length === 0 ||
        splitted[1].length === 0) throw Error
      this.owner = splitted[0]
      this.repo = splitted[1]
    } catch {
      throw TypeError('Comment: Invalid config[repo]: ' + postData.config.repo)
    }

    this.id = uuidv4()
    this.path = join(postData.config.path, this.id + '.json')
    this.content = JSON.stringify({
      id: this.id,
      created: new Date().toISOString(),
      comment: postData.comment
    }, null, 4)
  }
}
