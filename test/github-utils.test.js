const nock = require('nock')
const { Probot } = require('probot')
// actual implementation
const staticComments = require('..')
const { newPullRequest } = require('../lib/github-utils')
const Comment = require('../lib/comment')
// fixtures
const fs = require('fs')
const path = require('path')
const fixtures = require('./fixtures/github')

describe('github-utils module', () => {
  let mockCert
  let probot
  let app

  beforeAll((done) => {
    fs.readFile(path.join(__dirname, 'fixtures/mock-cert.pem'), (err, cert) => {
      if (err) return done(err)
      mockCert = cert
      done()
    })
  })

  beforeEach(() => {
    nock.disableNetConnect()
    probot = new Probot({ id: 123, privateKey: mockCert })
    // Load our app into probot
    app = probot.load(staticComments)
  })

  test('newPullRequest creates all needed resources on GitHub', async () => {
    nock('https://api.github.com:443', {
      encodedQueryParams: true
    })
      .get('/app/installations')
      .reply(200, ...fixtures['/app/installations'])
      .post('/app/installations/11553724/access_tokens', {})
      .reply(201, fixtures['/app/installations/11553724/access_tokens'])
      .get('/repos/shaftoe/testing-pr/git/refs/heads%2Fmaster')
      .reply(
        200,
        ...fixtures['/repos/shaftoe/testing-pr/git/refs/heads%2Fmaster']
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

    const result = await newPullRequest(
      new Comment({
        config: {
          path: 'data/somefolder',
          repo: 'shaftoe/testing-pr'
        },
        comment: 'some'
      }),
      '74748e21-0252-41bb-bfb9-82fd7600147f',
      app
    )

    expect(result).toBe(
      'New pull request https://github.com/shaftoe/testing-pr/pull/19 created'
    )
  })

  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })
})
