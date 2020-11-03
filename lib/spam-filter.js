class SpamError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = {
  /**
   * Check comment for spam. Resolve with input Comment object if content is HAM,
   * reject if SPAM.
   *
   * At the moment Akismet is the only backend supported. For details refer to the
   * official documentation: https://akismet.com/development/api/#comment-check
   *
   * @param {import('./comment')} comment
   * @param {string} ip - user agent IP address
   * @param {import('probot').Application} app
   */
  async spamCheck (comment, ip, app) {
    const log = app.log.child({ name: 'spamCheck' })
    const akismet = comment?.akismet

    if (akismet === undefined) {
      log.info('No Akismet config found in comment, ignoring spam check')
      return comment
    }
    if (akismet?.key === undefined) throw new SpamError('Missing required "key" in Akismet config')
    if (akismet?.blog === undefined) throw new SpamError('Missing required "blog" in Akismet config')

    akismet.user_ip = ip

    if (!akismet.comment_author && akismet.authorKey) {
      akismet.comment_author = comment.content.comment[akismet.authorKey]
      delete akismet.authorKey
    }

    if (!akismet.comment_content && akismet.contentKey) {
      akismet.comment_content = comment.content.comment[akismet.contentKey]
      delete akismet.contentKey
    } else {
      akismet.comment_content = comment.content.comment
    }

    log.info('Validating comment content via Akismet service')

    const res = await require('axios').post(
      `https://${akismet.key}.rest.akismet.com/1.1/comment-check`,
      require('querystring').stringify(akismet)
    )

    if (`${res.data}` === 'false') {
      log.info('Akismet marked comment as HAM')
      return comment
    } else if (`${res.data}` === 'true') throw new SpamError('Akismet marked comment as SPAM')
    else throw new SpamError('Akismet error: ' + res.data)
  },

  SpamError
}
