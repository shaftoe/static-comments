const Comment = require('../lib/comment')

describe('Comment class', () => {
  test('Comment class with valid input', () => {
    const comment = new Comment({
      config: {
        repo: 'username/repository-name',
        path: 'some/folder/path',
        title: 'Some PR title here',
        redirect: 'https://some/where'
      },
      comment: {
        name: 'fancyUser',
        email: 'fake@mail'
      }
    })
    expect(comment.path).toMatch(/some\/folder\/path\/.*\.json$/)
    expect(comment.repo).toBe('repository-name')
    expect(comment.ref).toBe('heads/master')
    expect(comment.owner).toBe('username')
    expect(comment.message).toBe('New comment from static-comments')
    expect(comment.title).toBe('Some PR title here')
    expect(comment.redirect).toBe('https://some/where')
    const content = JSON.parse(comment.content)
    expect(content.id).toMatch(/^[a-z0-9-]+$/)
    expect(content.created).toMatch(new Date().toISOString().slice(0, 16))
    expect(content.comment.name).toBe('fancyUser')
    expect(content.comment.email).toBe('fake@mail')
  })

  test('Comment constructor throws with invalid/missing argument', () => {
    expect(() => new Comment()).toThrow(/Comment: Missing `config` in payload/)
    expect(() => new Comment({})).toThrow(/Comment: Missing `config` in payload/)
    expect(() => new Comment({
      config: null
    })).toThrow(/Comment: Missing `config` in payload/)

    expect(() => new Comment({
      config:
        { repo: null }
    })).toThrow(/Comment: Missing `config\[repo\]` in payload/)

    expect(() => new Comment({
      config: { repo: 'some/repo' }
    })).toThrow(/Comment: Missing `config\[path\]` in payload/)

    expect(() => new Comment({
      config: {
        repo: 'some/repo',
        path: null
      }
    })).toThrow(/Comment: Missing `config\[path\]` in payload/)

    expect(() => new Comment({
      config: {
        repo: 'some/repo',
        path: 'some/path'
      }
    })).toThrow(/Comment: Missing `comment` in payload/)

    expect(() => new Comment({
      config: {
        repo: 'some/repo',
        path: 'some/path'
      },
      comment: null
    })).toThrow(/Comment: Missing `comment` in payload/)

    expect(() => new Comment({
      config: {
        repo: 'wrong-repo',
        path: 'some/path'
      },
      comment: 'some comment'
    })).toThrow(/Comment: Invalid config\[repo\]: wrong-repo/)
  })

  test('Comment keys ending in #md5 have values hashed', () => {
    const comment = new Comment({
      config: {
        repo: 'username/repository-name',
        path: 'some/folder/path'
      },
      comment: {
        'name#md5': 'fancyUser',
        'email#md5': 'fake@mail',
        noHash: 'noHashed'
      }
    })
    const content = JSON.parse(comment.content)
    expect(content.comment['name#md5']).toBe('3fcd668d29b949876ec9599ae5b151df')
    expect(content.comment['email#md5']).toBe('0f7f2f4683d9f7a9b590df1cbd9c125f')
    expect(content.comment.noHash).toBe('noHashed')
  })
})
