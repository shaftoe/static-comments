class GithubError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * @param {import('probot').Application} app
 * @param {string} user
 *
 * @returns {Number}
 */
function getInstallationIdForUser (app, user) {
  return new Promise((resolve, reject) => {
    app.auth()
      .then(client => client.paginate(client.apps.listInstallations))
      .then(installations => {
        if (installations.length > 0) {
          installations.forEach(item => {
            if (item?.account?.login === user) {
              resolve(item.id)
            }
          })
        }
        reject(new GithubError(`No installation found for user '${user}'`))
      })
  })
}

/**
 * @param {import('probot').Application} app
 * @param {string} user
 */
async function getAuthorizedGHClient (app, user) {
  const id = await getInstallationIdForUser(app, user)
  return app.auth(id)
}

/**
 * Wrap function execution and throw GithubError if errors
 * @param {*} func - function to be called
 * @param {...any} - function call arguments
 * @param {string} - custom error message to prepend to actual GH error
 */
async function execGithubFunction (func, args, errorMessage) {
  try {
    return await func(args)
  } catch (error) {
    const message = errorMessage ? `${errorMessage}: ${error}` : error
    throw new GithubError(message)
  }
}

module.exports = {
  /**
   * @param {import('./comment')} comment
   * @param {string} id
   * @param {import('probot').Application} app
   *
   * @returns {string}
   */
  async newPullRequest (comment, id, app) {
    if (!comment) throw TypeError('newPullRequest: missing `comment`')
    if (!id) throw TypeError('newPullRequest: missing `id`')
    if (!app) throw TypeError('newPullRequest: missing `app`')

    const log = app.log.child({ name: 'github' })

    log.info(`Sending new pull request to ${comment.owner}/${comment.repo}`)

    const branchName = `staticComments-${id}`

    const client = await getAuthorizedGHClient(app, comment.owner)

    const head = await execGithubFunction(client.git.getRef, {
      owner: comment.owner,
      repo: comment.repo,
      ref: comment.ref
    }, `Failed to fetch reference ${comment.ref} for ${comment.owner}/${comment.repo}`)

    const headTree = await execGithubFunction(client.git.getTree, {
      owner: comment.owner,
      repo: comment.repo,
      tree_sha: head.data.object.sha
    }, `Failed to get tree ${head.data.object.sha} for ${comment.owner}/${comment.repo}`)
    log.debug(`Using ${head.data.object.sha} HEAD (${comment.ref}) as parent`)

    const blob = await execGithubFunction(client.git.createBlob, {
      owner: comment.owner,
      repo: comment.repo,
      content: comment.content,
      encoding: comment.encoding || 'utf-8'
    }, `Failed to create blob for ${comment.owner}/${comment.repo}`)
    log.debug(`New blob ${blob.data.sha} created for file ${comment.path}`)

    const tree = await execGithubFunction(client.git.createTree, {
      owner: comment.owner,
      repo: comment.repo,
      tree: [
        {
          path: comment.path,
          mode: '100644',
          type: 'blob',
          sha: blob.data.sha
        }
      ],
      base_tree: headTree.data.sha
    }, `Failed to create new tree (path ${comment.path}) for ${comment.owner}/${comment.repo}`)
    log.debug(`New tree ${tree.data.sha} created`)

    const commit = await execGithubFunction(client.git.createCommit, {
      owner: comment.owner,
      repo: comment.repo,
      message: comment.message,
      tree: tree.data.sha,
      parents: [headTree.data.sha]
    }, `Failed to create new commit ${tree.data.sha} for ${comment.owner}/${comment.repo}`)
    log.debug(`New commit ${commit.data.sha} created`)

    await client.git.createRef({
      owner: comment.owner,
      repo: comment.repo,
      ref: `refs/heads/${branchName}`,
      sha: commit.data.sha
    }, `Failed to create new ref refs/heads/${branchName} for ${comment.owner}/${comment.repo}`)
    log.debug(`New branch ${branchName} created`)

    const pullRequest = await execGithubFunction(client.pulls.create, {
      owner: comment.owner,
      repo: comment.repo,
      title: comment.title,
      head: branchName,
      base: 'master'
    }, `Failed to create new pull request with head ${branchName} for ${comment.owner}/${comment.repo}`)
    return `New pull request ${pullRequest.data.html_url} created`
  },

  GithubError
}
