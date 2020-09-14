const { Comment, CommentError } = require('./lib/comment')
const { newPullRequest, GithubError } = require('./lib/github-utils')

/**
 * This is the main entrypoint of static-comments app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  const router = app.route('/static-comments')
  router.use(require('express').urlencoded({ extended: true }))

  router.post('/new', (req, res) => {
    const logMessageAndReturn = (message, code, redirect) => {
      if (code === 200) app.log.info(message)
      else app.log.error(message)

      if (redirect) res.redirect(301, redirect)
      else res.status(code).send(message + '\n')
    }

    try {
      const comment = new Comment(req.body)
      newPullRequest(comment, `staticComments-${comment.id}`, app)
        .then(message => logMessageAndReturn(message, 200, comment.redirect))
        .catch(error => logMessageAndReturn(error.message, 400))
    } catch (error) {
      if (error instanceof GithubError || error instanceof CommentError) logMessageAndReturn(error.message, 400)
      else logMessageAndReturn(error.message, 500)
    }
  })

  app.log.info('Listening for new comment requests at `POST /static-comments/new`')
}
