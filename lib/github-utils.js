const { ProbotOctokit } = require('probot')

async function getInstallationToken (app, installationId) {
  const client = await app.auth()
  const result = await client.apps.createInstallationAccessToken({ installation_id: installationId })
  return result?.data?.token
}

function getInstallationIdForUser (app, user) {
  return new Promise((resolve, reject) => {
    app.auth()
      .then(client => client.apps.listInstallations())
      .then(installations => {
        if (installations?.data) {
          Object.keys(installations.data).forEach(key => {
            if (installations.data[key]?.account?.login === user) {
              resolve(installations.data[key].id)
            }
          })
        }
        reject(new Error(`No installation found for user '${user}'`))
      })
  })
}

async function getAuthorizedGHClient (app, user) {
  const id = await getInstallationIdForUser(app, user)
  const token = await getInstallationToken(app, id)
  return new ProbotOctokit({ auth: 'token ' + token })
}

module.exports = {
  async newPullRequest (prData, id, app) {
    if (!prData?.owner) throw TypeError('pull-request: missing `owner` in prData payload')
    if (!prData?.repo) throw TypeError('pull-request: missing `repo` in prData payload')
    if (!id) throw TypeError('pull-request: missing `id`')
    if (!app) throw TypeError('pull-request: missing `app`')

    app.log.info(`Sending new pull request to ${prData.owner}/${prData.repo}`)

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
    app.log.debug(`Using ${head.data.object.sha} HEAD (${ref}) as parent`)

    const blob = await client.git.createBlob({
      owner: prData.owner,
      repo: prData.repo,
      content: prData.content,
      encoding: prData.encoding || 'utf-8'
    })
    app.log.debug(`New blob ${blob.data.sha} created for file ${prData.path}`)

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
    app.log.debug(`New tree ${tree.data.sha} created`)

    const commit = await client.git.createCommit({
      owner: prData.owner,
      repo: prData.repo,
      message: prData.message || 'New comment from static-comments',
      tree: tree.data.sha,
      parents: [headTree.data.sha]
    })
    app.log.debug(`New commit ${commit.data.sha} created`)

    await client.git.createRef({
      owner: prData.owner,
      repo: prData.repo,
      ref: `refs/heads/${branchName}`,
      sha: commit.data.sha
    })
    app.log.debug(`New branch ${branchName} created`)

    const pullRequest = await client.pulls.create({
      owner: prData.owner,
      repo: prData.repo,
      title: prData.title || 'New comment from static-comments',
      head: branchName,
      base: 'master'
    })
    return `New pull request ${pullRequest.data.html_url} created\n`
  }
}
