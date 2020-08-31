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
        reject(new Error(`No installation found for user '${user}'`))
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

module.exports = {
  /**
   * @param {import('./comment')} comment
   * @param {string} id
   * @param {import('probot').Application} app
   *
   * @returns {string}
   */
  async newPullRequest (comment, id, app) {
    if (!id) throw TypeError('pull-request: missing `id`')
    if (!app) throw TypeError('pull-request: missing `app`')

    const log = app.log.child({ name: 'github' })

    log.info(`Sending new pull request to ${comment.owner}/${comment.repo}`)

    const branchName = `staticComments-${id}`
    const client = await getAuthorizedGHClient(app, comment.owner)

    const head = await client.git.getRef({
      owner: comment.owner,
      repo: comment.repo,
      ref: comment.ref
    })

    const headTree = await client.git.getTree({
      owner: comment.owner,
      repo: comment.repo,
      tree_sha: head.data.object.sha
    })
    log.debug(`Using ${head.data.object.sha} HEAD (${comment.ref}) as parent`)

    const blob = await client.git.createBlob({
      owner: comment.owner,
      repo: comment.repo,
      content: comment.content,
      encoding: comment.encoding || 'utf-8'
    })
    log.debug(`New blob ${blob.data.sha} created for file ${comment.path}`)

    const tree = await client.git.createTree({
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
    })
    log.debug(`New tree ${tree.data.sha} created`)

    const commit = await client.git.createCommit({
      owner: comment.owner,
      repo: comment.repo,
      message: comment.message,
      tree: tree.data.sha,
      parents: [headTree.data.sha]
    })
    log.debug(`New commit ${commit.data.sha} created`)

    await client.git.createRef({
      owner: comment.owner,
      repo: comment.repo,
      ref: `refs/heads/${branchName}`,
      sha: commit.data.sha
    })
    log.debug(`New branch ${branchName} created`)

    const pullRequest = await client.pulls.create({
      owner: comment.owner,
      repo: comment.repo,
      title: comment.title,
      head: branchName,
      base: 'master'
    })
    return `New pull request ${pullRequest.data.html_url} created`
  }
}
