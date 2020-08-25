const Comment = require('./lib/comment')
const { newPullRequest } = require('./lib/github-utils')

/**
 * This is the main entrypoint of static-comments app
 * @param {import('probot').Application} app
 */
module.exports = async app => {
  const router = app.route('/static-comments')
  router.use(require('express').urlencoded({ extended: true }))

  router.post('/new', (req, res) => {
    const logMessageAndReturn = (message, code = 200) => {
      if (code === 200) app.log.info(message.trim())
      else app.log.error(message.trim())
      res.status(code).send(message)
    }

    try {
      const comment = new Comment(req.body)
      newPullRequest(comment, `staticComments-${comment.id}`, app)
        .then(message => logMessageAndReturn(message))
        .catch(error => logMessageAndReturn(error.message, 400))
    } catch (error) {
      logMessageAndReturn(error.message, 400)
    }
  })

  app.log.info('Listening for new comment requests at `POST /static-comments/new`')
}
