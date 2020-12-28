const nock = require('nock')
const { Probot, Server, ProbotOctokit } = require('probot')
// actual implementation
const staticComments = require('../app')
const { newPullRequest, GithubError } = require('../lib/github-utils')
const { Comment } = require('../lib/comment')
// fixtures
const fs = require('fs')
const path = require('path')
const fixtures = require('./fixtures/github')

describe('github-utils module', () => {
  let mockCert
  let server
  const comment = new Comment({
    config: {
      path: 'data/somefolder',
      repo: 'shaftoe/testing-pr'
    },
    comment: 'some'
  })

  beforeAll((done) => {
    fs.readFile(path.join(__dirname, 'fixtures/mock-cert.pem'), (err, cert) => {
      if (err) return done(err)
      mockCert = cert
      done()
    })
  })

  beforeEach(async () => {
    nock.disableNetConnect()

    server = new Server({
      Probot: Probot.defaults({
        id: 123,
        githubToken: 'test', // ref: https://github.com/probot/probot/issues/1452#issuecomment-752222670
        Octokit: ProbotOctokit.defaults({
          privateKey: mockCert,
          retry: { enabled: false },
          throttle: { enabled: false }
        })
      })
    })

    await server.load(staticComments)
  })

  it('newPullRequest creates all needed resources on GitHub', async () => {
    nock('https://api.github.com:443', {
      encodedQueryParams: true
    })
      .get('/app/installations')
      .reply(200, ...fixtures['/app/installations'])
      .post('/app/installations/11553724/access_tokens', {})
      .reply(201, fixtures['/app/installations/11553724/access_tokens'])
      .get('/repos/shaftoe/testing-pr/git/ref/heads%2Fmaster')
      .reply(
        200,
        ...fixtures['/repos/shaftoe/testing-pr/git/ref/heads%2Fmaster']
      )
      .get(
        '/repos/shaftoe/testing-pr/git/trees/5baeb51466b0d77e6a333d0db4c27efcad143bee'
      )
      .reply(
        200,
        fixtures[
          '/repos/shaftoe/testing-pr/git/trees/5baeb51466b0d77e6a333d0db4c27efcad143bee'
        ]
      )
      .post('/repos/shaftoe/testing-pr/git/blobs')
      .reply(201, fixtures['/repos/shaftoe/testing-pr/git/blobs'])
      .post('/repos/shaftoe/testing-pr/git/trees')
      .reply(201, '/repos/shaftoe/testing-pr/git/trees')
      .post('/repos/shaftoe/testing-pr/git/commits')
      .reply(201, fixtures['/repos/shaftoe/testing-pr/git/commits'])
      .post('/repos/shaftoe/testing-pr/git/refs')
      .reply(201, fixtures['/repos/shaftoe/testing-pr/git/refs'])
      .post('/repos/shaftoe/testing-pr/pulls')
      .reply(201, fixtures['/repos/shaftoe/testing-pr/pulls'])

    const result = await newPullRequest(comment, '74748e21-0252-41bb-bfb9-82fd7600147f', server.probotApp)

    expect(result).toBe(
      'New pull request https://github.com/shaftoe/testing-pr/pull/19 created'
    )
  })

  it('throws GithubError', async () => {
    nock('https://api.github.com:443', {
      encodedQueryParams: true
    })
      .get('/app/installations')
      .reply(200, [])

    await expect(() => newPullRequest(comment, '74748e21-0252-41bb-bfb9-82fd7600147f', server.probotApp))
      .rejects
      .toThrow(GithubError)
  })

  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })
})
