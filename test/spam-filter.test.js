const nock = require('nock')
const { Probot } = require('probot')
// actual implementation
const staticComments = require('..')
const { spamCheck, SpamError } = require('../lib/spam-filter')
const { Comment } = require('../lib/comment')
// fixtures
const fs = require('fs')
const path = require('path')

describe('spam-filter module', () => {
  let mockCert
  let probot
  let app
  let comment
  const akismetKey = 'fake'
  const akismetBlog = 'https://fake.blog/'

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
    comment = new Comment({
      config: {
        path: 'data/somefolder',
        repo: 'shaftoe/testing-pr'
      },
      comment: 'some',
      akismet: { key: akismetKey, blog: akismetBlog }
    })
  })

  test('spamCheck returns input comment if content is HAM', async () => {
    nock(`https://${akismetKey}.rest.akismet.com:443`, {
      encodedQueryParams: true
    })
      .post('/1.1/comment-check')
      .reply(200, 'false')

    const result = await spamCheck(comment, '127.0.0.1', app)

    expect(result).toBe(comment)
  })

  test('spamCheck returns input comment if spam filter (Akismet) is not configured', async () => {
    comment.akismet = undefined
    const result = await spamCheck(comment, '127.0.0.1', app)
    expect(result).toBe(comment)
  })

  test('spamCheck picks comment_author and comment_content values from config keys', async () => {
    nock(`https://${akismetKey}.rest.akismet.com:443`, {
      encodedQueryParams: true
    })
      .post('/1.1/comment-check')
      .reply(200, 'false')

    comment.content.comment = { name: 'fake name', body: 'some text' }
    comment.akismet.authorKey = 'name'
    comment.akismet.contentKey = 'body'

    const result = await spamCheck(comment, '127.0.0.1', app)
    expect(result.akismet).toEqual({
      blog: akismetBlog,
      comment_author: 'fake name',
      comment_content: 'some text',
      key: akismetKey,
      user_ip: '127.0.0.1'
    })
  })

  test('spamCheck throws error if `blog` is missing in Akismet config', async () => {
    comment.akismet.blog = undefined
    await expect(() => spamCheck(comment, '127.0.0.1', app))
      .rejects
      .toThrow(SpamError)
  })

  test('spamCheck throws error if `key` is missing in Akismet config', async () => {
    comment.akismet.key = undefined
    await expect(() => spamCheck(comment, '127.0.0.1', app))
      .rejects
      .toThrow(SpamError)
  })

  test('spamCheck throws error if content is SPAM', async () => {
    nock(`https://${akismetKey}.rest.akismet.com:443`, {
      encodedQueryParams: true
    })
      .post('/1.1/comment-check')
      .reply(200, 'true')

    await expect(() => spamCheck(comment, '127.0.0.1', app))
      .rejects
      .toThrow(SpamError)
  })

  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })
})
