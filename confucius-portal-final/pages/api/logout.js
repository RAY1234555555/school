import { serialize } from 'cookie'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    serialize('oauthUsername', '', { path: '/', expires: new Date(0) }),
    serialize('oauthUserId', '', { path: '/', expires: new Date(0) }),
    serialize('oauthFullName', '', { path: '/', expires: new Date(0) }),
    serialize('oauthTrustLevel', '', { path: '/', expires: new Date(0) }),
  ])
  res.writeHead(302, { Location: '/' })
  res.end()
}
