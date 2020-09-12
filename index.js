const Comment = require('./lib/comment')
const { newPullRequest } = require('./lib/github-utils')

/**
 * This is the main entrypoint of static-comments app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  const router = app.route('/static-comments')
  router.use(require('express').urlencoded({ extended: true }))

  router.get('/', (_, res) => res.redirect(301, 'https://github.com/shaftoe/static-comments'))

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
      logMessageAndReturn(error.message, 400)
    }
  })

  app.log.info('Listening for new comment requests at `POST /static-comments/new`')
}
