const { Comment, CommentError } = require('./lib/comment')
const { newPullRequest, GithubError } = require('./lib/github-utils')
const { spamCheck, SpamError } = require('./lib/spam-filter')

/**
 * This is the main entrypoint of static-comments app
 * @param {import('probot').Application} app
 */
module.exports = ({ app, getRouter }) => {
  const router = getRouter('/static-comments')
  router.use(require('express').urlencoded({ extended: true }))

  router.post('/new', (req, res) => {
    app.log.info(`Processing new request from IP ${req.ip}`)

    const logMessageAndReturn = (message, code, redirect) => {
      if (code === 200) app.log.info(message)
      else app.log.error(message)

      if (redirect) res.redirect(301, redirect)
      else res.status(code).send(message + '\n')
    }

    const handleError = error => {
      if (error instanceof GithubError || error instanceof CommentError || error instanceof SpamError) logMessageAndReturn(error.message, 400)
      else logMessageAndReturn(error.message, 500)
    }

    try {
      const comment = new Comment(req.body)

      spamCheck(comment, req.ip, app)
        .then(comment => newPullRequest(comment, `staticComments-${comment.id}`, app))
        .then(message => logMessageAndReturn(message, 200, comment.redirect))
        .catch(error => handleError(error))
    } catch (error) { handleError(error) }
  })

  app.log.info('Listening for new comment requests at `POST /static-comments/new`')
}
