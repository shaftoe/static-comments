const { ProbotOctokit } = require('probot')

/**
 * @param {import('probot').Application} app
 * @param {Number} installationId
 *
 * @returns {string}
 */
async function getInstallationToken (app, installationId) {
  const client = await app.auth()
  const result = await client.apps.createInstallationAccessToken({ installation_id: installationId })
  return result?.data?.token
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
  const token = await getInstallationToken(app, id)
  return new ProbotOctokit({ auth: 'token ' + token })
}

module.exports = {
  /**
   * @param {Object} prData
   * @param {string} id
   * @param {import('probot').Application} app
   *
   * @returns {string}
   */
  async newPullRequest (prData, id, app) {
    if (!prData?.owner) throw TypeError('pull-request: missing `owner` in prData payload')
    if (!prData?.repo) throw TypeError('pull-request: missing `repo` in prData payload')
    if (!id) throw TypeError('pull-request: missing `id`')
    if (!app) throw TypeError('pull-request: missing `app`')

    const log = app.log.child({ name: 'github' })

    log.info(`Sending new pull request to ${prData.owner}/${prData.repo}`)

    const branchName = `staticComments-${id}`
    const client = await getAuthorizedGHClient(app, prData.owner)
    const ref = prData.ref ? prData.ref : 'heads/master'

    const head = await client.git.getRef({
      owner: prData.owner,
      repo: prData.repo,
      ref: ref
    })

    const headTree = await client.git.getTree({
      owner: prData.owner,
      repo: prData.repo,
      tree_sha: head.data.object.sha
    })
    log.debug(`Using ${head.data.object.sha} HEAD (${ref}) as parent`)

    const blob = await client.git.createBlob({
      owner: prData.owner,
      repo: prData.repo,
      content: prData.content,
      encoding: prData.encoding || 'utf-8'
    })
    log.debug(`New blob ${blob.data.sha} created for file ${prData.path}`)

    const tree = await client.git.createTree({
      owner: prData.owner,
      repo: prData.repo,
      tree: [
        {
          path: prData.path,
          mode: '100644',
          type: 'blob',
          sha: blob.data.sha
        }
      ],
      base_tree: headTree.data.sha
    })
    log.debug(`New tree ${tree.data.sha} created`)

    const commit = await client.git.createCommit({
      owner: prData.owner,
      repo: prData.repo,
      message: prData.message || 'New comment from static-comments',
      tree: tree.data.sha,
      parents: [headTree.data.sha]
    })
    log.debug(`New commit ${commit.data.sha} created`)

    await client.git.createRef({
      owner: prData.owner,
      repo: prData.repo,
      ref: `refs/heads/${branchName}`,
      sha: commit.data.sha
    })
    log.debug(`New branch ${branchName} created`)

    const pullRequest = await client.pulls.create({
      owner: prData.owner,
      repo: prData.repo,
      title: prData.title || 'New comment from static-comments',
      head: branchName,
      base: 'master'
    })
    return `New pull request ${pullRequest.data.html_url} created`
  }
}
