const { join } = require('path')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const URL = require('url').URL

/**
 * Return true if url argument is a valid url
 *
 * @param {String} url - The url string to be validated
 */
function isUrlValid (url) {
  try { return Boolean(new URL(url)) } catch {}
}

/**
 * Calculates the MD5 hash of a string.
 *
 * @param  {String} string - The string (or buffer).
 * @return {String}        - The MD5 hash.
 */
function md5 (string) {
  return crypto.createHash('md5').update(string).digest('hex')
}

module.exports = class Comment {
  /**
   * Abstraction for a POST comment, validates content and provides facilities
   *
   * @param {Object} postData - the raw urlencoded POST data object
   */
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

    Object.keys(postData.comment).forEach(key => {
      if (key.endsWith('#md5')) postData.comment[key] = md5(postData.comment[key])
    })

    this.ref = postData.config?.ref ? postData.config.ref : 'heads/master'
    this.message = postData.config?.message ? postData.config.message : 'New comment from static-comments'
    this.title = postData.config?.title ? postData.config.title : 'New comment from static-comments'
    this.id = uuidv4()
    this.path = join(postData.config.path, this.id + '.json')
    this.redirect = isUrlValid(postData.config?.redirect) ? postData.config.redirect : null
    this.content = JSON.stringify({
      id: this.id,
      created: new Date().toISOString(),
      comment: postData.comment
    }, null, 4)
  }
}
